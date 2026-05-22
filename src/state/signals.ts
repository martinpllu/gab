import { signal, computed, effect } from '@preact/signals';
import type {
  AuthState,
  RunState,
  Route,
  Chat,
  AgentDefinition,
  AgentId,
  Message,
  Run,
  ChatSpec,
} from '../types';
import { MODELS } from '../types';
import { fingerprintDefinition, snapshotDefinition } from '../engine/fingerprint';
import { parseHash, navigate } from '../router';

const SCHEMA_VERSION = 3;

const K = {
  schemaVersion: 'gab.schema_version',
  key: 'gab.openrouter_key',
  via: 'gab.openrouter_via',
  chats: 'gab.chats',
  runs: 'gab.runs',
  verifier: 'gab.pkce_verifier',
} as const;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadString(key: string): string | null {
  return localStorage.getItem(key);
}

export function uid(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function newAgentId(): AgentId {
  return crypto.randomUUID() as AgentId;
}

// Schema bump: spec-shaped data is incompatible with the old Chat/Run shape.
// Old data is throwaway prototype data — clear it rather than migrate.
function ensureSchema() {
  const version = Number(localStorage.getItem(K.schemaVersion) ?? '0');
  if (version === SCHEMA_VERSION) return;
  localStorage.removeItem(K.chats);
  localStorage.removeItem(K.runs);
  localStorage.setItem(K.schemaVersion, String(SCHEMA_VERSION));
}

ensureSchema();

export const openRouterKey = signal<string | null>(loadString(K.key));
export const openRouterVia = signal<'oauth' | 'manual' | null>(
  loadString(K.via) as 'oauth' | 'manual' | null,
);
export const chats = signal<Chat[]>(loadJSON<Chat[]>(K.chats, []));
export const runs = signal<Run[]>(loadJSON<Run[]>(K.runs, []));
export const runState = signal<RunState>('idle');
export const route = signal<Route>(parseHash(location.hash));

// UI-only convenience: pre-fill the model for newly added agents (decision Q1).
export const lastUsedModel = signal<string>('google/gemini-3.1-flash-lite');

window.addEventListener('hashchange', () => {
  route.value = parseHash(location.hash);
});

export const authState = computed<AuthState>(() => {
  if (openRouterKey.value && openRouterVia.value) {
    return { kind: 'authed', via: openRouterVia.value };
  }
  return { kind: 'anonymous' };
});

export const currentChatId = computed<string | null>(() => {
  const r = route.value;
  return 'chatId' in r ? r.chatId : null;
});

export const currentRunId = computed<string | null>(() => {
  const r = route.value;
  return r.kind === 'run' ? r.runId : null;
});

export const currentChat = computed<Chat | null>(() => {
  const id = currentChatId.value;
  if (!id) return null;
  return chats.value.find((c) => c.id === id) ?? null;
});

export const currentRun = computed<Run | null>(() => {
  const id = currentRunId.value;
  if (!id) return null;
  return runs.value.find((r) => r.id === id) ?? null;
});

export const runsForCurrentChat = computed<Run[]>(() => {
  const cid = currentChatId.value;
  if (!cid) return [];
  return runs.value
    .filter((r) => r.chatId === cid)
    .sort((a, b) => b.createdAt - a.createdAt);
});

export const pendingExpandDefFor = signal<string | null>(null);

effect(() => {
  const r = route.value;
  if (r.kind === 'runs' || r.kind === 'run') {
    if (!chats.value.some((c) => c.id === r.chatId)) {
      navigate({ kind: 'list' }, { replace: true });
      return;
    }
  }
  if (r.kind === 'run') {
    const run = runs.value.find((x) => x.id === r.runId);
    if (!run || run.chatId !== r.chatId) {
      navigate({ kind: 'runs', chatId: r.chatId }, { replace: true });
    }
  }
});

function debounce<T>(fn: (v: T) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (v: T) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(v), ms);
  };
}

const writeChats = debounce<Chat[]>(
  (v) => localStorage.setItem(K.chats, JSON.stringify(v)),
  200,
);
effect(() => writeChats(chats.value));

const writeRuns = debounce<Run[]>(
  (v) => localStorage.setItem(K.runs, JSON.stringify(v)),
  200,
);
effect(() => writeRuns(runs.value));

effect(() => {
  const v = openRouterKey.value;
  if (v == null) localStorage.removeItem(K.key);
  else localStorage.setItem(K.key, v);
});
effect(() => {
  const v = openRouterVia.value;
  if (v == null) localStorage.removeItem(K.via);
  else localStorage.setItem(K.via, v);
});
export function setVerifier(v: string) {
  localStorage.setItem(K.verifier, v);
}
export function takeVerifier(): string | null {
  const v = localStorage.getItem(K.verifier);
  localStorage.removeItem(K.verifier);
  return v;
}

export function signOut() {
  openRouterKey.value = null;
  openRouterVia.value = null;
  navigate({ kind: 'login' });
}

// ---------------------------------------------------------------------------
// Spec construction + chat CRUD
// ---------------------------------------------------------------------------

function blankSpec(): ChatSpec {
  const now = new Date().toISOString();
  return {
    metadata: {
      id: crypto.randomUUID() as ChatSpec['metadata']['id'],
      title: 'Untitled chat',
      specVersion: 1,
      createdAt: now,
      updatedAt: now,
    },
    agents: [],
    chat: {
      participants: [],
      kickoff: { type: 'seed', message: "Let's begin." },
      defaultMessageScope: { type: 'broadcast' },
    },
    flow: {
      main: {
        policy: { type: 'round-robin' },
        stop: [{ type: 'max-rounds', rounds: 3 }],
      },
    },
  };
}

export function createChat(): Chat {
  const now = Date.now();
  const c: Chat = {
    id: uid(),
    spec: blankSpec(),
    createdAt: now,
    updatedAt: now,
  };
  chats.value = [c, ...chats.value];
  return c;
}

/**
 * Create a chat from an existing ChatSpec (e.g. a built-in example).
 * Deep-clones the spec, assigns a fresh scenario id + timestamps, and remaps
 * every agent's model to a wired OpenRouter model so the demo runs immediately.
 */
export function createChatFromSpec(source: ChatSpec): Chat {
  const wired = MODELS;
  const clone: ChatSpec = JSON.parse(JSON.stringify(source));
  const now = new Date().toISOString();
  clone.metadata = {
    ...clone.metadata,
    id: crypto.randomUUID() as ChatSpec['metadata']['id'],
    createdAt: now,
    updatedAt: now,
  };
  clone.agents = clone.agents.map((a, i) => ({ ...a, model: wired[i % wired.length] }));

  const ts = Date.now();
  const c: Chat = { id: uid(), spec: clone, createdAt: ts, updatedAt: ts };
  chats.value = [c, ...chats.value];
  return c;
}

/** Patch a chat's wrapper fields (rarely needed directly). */
export function updateChat(id: string, patch: Partial<Omit<Chat, 'id'>>) {
  chats.value = chats.value.map((c) =>
    c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
  );
}

/** Apply a transform to a chat's spec, bumping updatedAt and spec.metadata.updatedAt. */
export function updateSpec(id: string, fn: (spec: ChatSpec) => ChatSpec) {
  chats.value = chats.value.map((c) => {
    if (c.id !== id) return c;
    const next = fn(c.spec);
    next.metadata = { ...next.metadata, updatedAt: new Date().toISOString() };
    return { ...c, spec: next, updatedAt: Date.now() };
  });
}

export function deleteChat(id: string) {
  chats.value = chats.value.filter((c) => c.id !== id);
  runs.value = runs.value.filter((r) => r.chatId !== id);
  if (currentChatId.value === id) navigate({ kind: 'list' }, { replace: true });
}

// ---------------------------------------------------------------------------
// Agent CRUD (operate on spec.agents)
// ---------------------------------------------------------------------------

export function addAgent(chatId: string): AgentDefinition {
  const id = newAgentId();
  const agent: AgentDefinition = {
    id,
    name: '',
    model: lastUsedModel.value,
    systemPrompt: '',
  };
  updateSpec(chatId, (spec) => {
    const n = spec.agents.length + 1;
    return {
      ...spec,
      agents: [...spec.agents, { ...agent, name: `Agent ${n}` }],
      // New agents join the room by default.
      chat: { ...spec.chat, participants: [...spec.chat.participants, id] },
    };
  });
  return agent;
}

export function updateAgent(
  chatId: string,
  agentId: AgentId,
  patch: Partial<AgentDefinition>,
) {
  if (patch.model) lastUsedModel.value = patch.model;
  updateSpec(chatId, (spec) => ({
    ...spec,
    agents: spec.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a)),
  }));
}

export function deleteAgent(chatId: string, agentId: AgentId) {
  updateSpec(chatId, (spec) => ({
    ...spec,
    agents: spec.agents.filter((a) => a.id !== agentId),
    chat: {
      ...spec.chat,
      participants: spec.chat.participants.filter((p) => p !== agentId),
    },
  }));
}

// ---------------------------------------------------------------------------
// Run CRUD
// ---------------------------------------------------------------------------

export function createRun(chatId: string): Run {
  const c = chats.value.find((x) => x.id === chatId);
  if (!c) throw new Error('chat not found');
  const snap = snapshotDefinition(c.spec);
  const now = Date.now();
  const r: Run = {
    id: uid(),
    chatId,
    specSnapshot: snap,
    fingerprint: fingerprintDefinition(snap),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  runs.value = [r, ...runs.value];
  return r;
}

export function addMessageToRun(runId: string, m: Message) {
  runs.value = runs.value.map((r) =>
    r.id === runId
      ? { ...r, messages: [...r.messages, m], updatedAt: Date.now() }
      : r,
  );
}

export function setRunReason(runId: string, reason: Run['reason']) {
  runs.value = runs.value.map((r) =>
    r.id === runId ? { ...r, reason, updatedAt: Date.now() } : r,
  );
}

export function deleteRun(runId: string) {
  const run = runs.value.find((r) => r.id === runId);
  runs.value = runs.value.filter((r) => r.id !== runId);
  if (currentRunId.value === runId && run) {
    navigate({ kind: 'runs', chatId: run.chatId }, { replace: true });
  }
}

export function clearRunMessages(runId: string) {
  runs.value = runs.value.map((r) =>
    r.id === runId ? { ...r, messages: [], reason: undefined, updatedAt: Date.now() } : r,
  );
}

import { signal, computed, effect } from '@preact/signals';
import type { AuthState, RunState, Route, Chat, Agent, Message, Model, Run, ChatDefinition } from '../types';
import { fingerprintDefinition, snapshotDefinition } from '../engine/fingerprint';
import { parseHash, navigate } from '../router';

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

function migrateV1ToV2() {
  const version = Number(localStorage.getItem(K.schemaVersion) ?? '1');
  if (version >= 2) return;
  const rawChats = loadJSON<any[]>(K.chats, []);
  const existingRuns = loadJSON<Run[]>(K.runs, []);
  const newRuns: Run[] = [];
  const cleanedChats: Chat[] = [];
  for (const c of rawChats) {
    const def: ChatDefinition = {
      name: c.name,
      chatPrompt: c.chatPrompt,
      defaultModel: c.defaultModel,
      agents: Array.isArray(c.agents) ? c.agents : [],
      randomize: !!c.randomize,
      turnsRequested: c.turnsRequested ?? null,
    };
    const messages: Message[] = Array.isArray(c.messages) ? c.messages : [];
    if (messages.length > 0) {
      const snap = snapshotDefinition(def);
      newRuns.push({
        id: uid(),
        chatId: c.id,
        chatSnapshot: snap,
        fingerprint: fingerprintDefinition(snap),
        messages,
        createdAt: c.createdAt ?? Date.now(),
        updatedAt: c.updatedAt ?? Date.now(),
      });
    }
    cleanedChats.push({
      id: c.id,
      ...def,
      createdAt: c.createdAt ?? Date.now(),
      updatedAt: c.updatedAt ?? Date.now(),
    });
  }
  localStorage.setItem(K.chats, JSON.stringify(cleanedChats));
  localStorage.setItem(K.runs, JSON.stringify([...existingRuns, ...newRuns]));
  localStorage.setItem(K.schemaVersion, '2');
}

migrateV1ToV2();

export const openRouterKey = signal<string | null>(loadString(K.key));
export const openRouterVia = signal<'oauth' | 'manual' | null>(
  loadString(K.via) as 'oauth' | 'manual' | null,
);
export const chats = signal<Chat[]>(loadJSON<Chat[]>(K.chats, []));
export const runs = signal<Run[]>(loadJSON<Run[]>(K.runs, []));
export const runState = signal<RunState>('idle');
export const route = signal<Route>(parseHash(location.hash));

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

effect(() => {
  const r = route.value;
  if (r.kind === 'edit' || r.kind === 'runs' || r.kind === 'run') {
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

export function createChat(): Chat {
  const now = Date.now();
  const c: Chat = {
    id: uid(),
    name: 'Untitled chat',
    chatPrompt: '',
    defaultModel: 'google/gemini-3.1-flash-lite' as Model,
    agents: [],
    randomize: false,
    turnsRequested: 6,
    createdAt: now,
    updatedAt: now,
  };
  chats.value = [c, ...chats.value];
  return c;
}

export function updateChat(id: string, patch: Partial<Chat>) {
  chats.value = chats.value.map((c) =>
    c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
  );
}

export function deleteChat(id: string) {
  chats.value = chats.value.filter((c) => c.id !== id);
  runs.value = runs.value.filter((r) => r.chatId !== id);
  if (currentChatId.value === id) navigate({ kind: 'list' }, { replace: true });
}

export function addAgent(chatId: string): Agent {
  const c = chats.value.find((x) => x.id === chatId);
  if (!c) throw new Error('chat not found');
  const maxOrder = c.agents
    .filter((a) => !a.afterEach)
    .reduce((m, a) => Math.max(m, a.order), -1);
  const agent: Agent = {
    id: uid(),
    name: `Agent ${c.agents.length + 1}`,
    personaPrompt: '',
    model: null,
    afterEach: false,
    order: maxOrder + 1,
  };
  updateChat(chatId, { agents: [...c.agents, agent] });
  return agent;
}

export function updateAgent(chatId: string, agentId: string, patch: Partial<Agent>) {
  const c = chats.value.find((x) => x.id === chatId);
  if (!c) return;
  updateChat(chatId, {
    agents: c.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a)),
  });
}

export function deleteAgent(chatId: string, agentId: string) {
  const c = chats.value.find((x) => x.id === chatId);
  if (!c) return;
  updateChat(chatId, { agents: c.agents.filter((a) => a.id !== agentId) });
}

export function reorderMainAgents(chatId: string, orderedIds: string[]) {
  const c = chats.value.find((x) => x.id === chatId);
  if (!c) return;
  const orderMap = new Map(orderedIds.map((id, i) => [id, i] as const));
  updateChat(chatId, {
    agents: c.agents.map((a) =>
      a.afterEach ? a : { ...a, order: orderMap.get(a.id) ?? a.order },
    ),
  });
}

export function createRun(chatId: string): Run {
  const c = chats.value.find((x) => x.id === chatId);
  if (!c) throw new Error('chat not found');
  const def: ChatDefinition = {
    name: c.name,
    chatPrompt: c.chatPrompt,
    defaultModel: c.defaultModel,
    agents: c.agents,
    randomize: c.randomize,
    turnsRequested: c.turnsRequested,
  };
  const snap = snapshotDefinition(def);
  const now = Date.now();
  const r: Run = {
    id: uid(),
    chatId,
    chatSnapshot: snap,
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

export function deleteRun(runId: string) {
  const run = runs.value.find((r) => r.id === runId);
  runs.value = runs.value.filter((r) => r.id !== runId);
  if (currentRunId.value === runId && run) {
    navigate({ kind: 'runs', chatId: run.chatId }, { replace: true });
  }
}

export function clearRunMessages(runId: string) {
  runs.value = runs.value.map((r) =>
    r.id === runId ? { ...r, messages: [], updatedAt: Date.now() } : r,
  );
}

import { signal, computed, effect } from '@preact/signals';
import type { AuthState, RunState, Route, Chat, Agent, Message, Model } from '../types';

const K = {
  schemaVersion: 'gab.schema_version',
  key: 'gab.openrouter_key',
  via: 'gab.openrouter_via',
  chats: 'gab.chats',
  currentId: 'gab.current_chat_id',
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

localStorage.setItem(K.schemaVersion, '1');

export const openRouterKey = signal<string | null>(loadString(K.key));
export const openRouterVia = signal<'oauth' | 'manual' | null>(
  loadString(K.via) as 'oauth' | 'manual' | null,
);
export const chats = signal<Chat[]>(loadJSON<Chat[]>(K.chats, []));
export const currentChatId = signal<string | null>(loadString(K.currentId));
export const runState = signal<RunState>('idle');
export const route = signal<Route>('login');

export const authState = computed<AuthState>(() => {
  if (openRouterKey.value && openRouterVia.value) {
    return { kind: 'authed', via: openRouterVia.value };
  }
  return { kind: 'anonymous' };
});

export const currentChat = computed<Chat | null>(() => {
  const id = currentChatId.value;
  if (!id) return null;
  return chats.value.find((c) => c.id === id) ?? null;
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
effect(() => {
  const v = currentChatId.value;
  if (v == null) localStorage.removeItem(K.currentId);
  else localStorage.setItem(K.currentId, v);
});

export function uid(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

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
  route.value = 'login';
}

function replaceChats(next: Chat[]) {
  chats.value = next;
}

export function createChat(): Chat {
  const now = Date.now();
  const c: Chat = {
    id: uid(),
    name: 'Untitled chat',
    chatPrompt: '',
    defaultModel: 'google/gemini-3.1-flash-lite' as Model,
    agents: [],
    messages: [],
    randomize: false,
    turnsRequested: 6,
    createdAt: now,
    updatedAt: now,
  };
  replaceChats([c, ...chats.value]);
  return c;
}

export function updateChat(id: string, patch: Partial<Chat>) {
  replaceChats(
    chats.value.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
    ),
  );
}

export function deleteChat(id: string) {
  replaceChats(chats.value.filter((c) => c.id !== id));
  if (currentChatId.value === id) currentChatId.value = null;
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

export function addMessage(chatId: string, m: Message) {
  const c = chats.value.find((x) => x.id === chatId);
  if (!c) return;
  updateChat(chatId, { messages: [...c.messages, m] });
}

export function clearMessages(chatId: string) {
  updateChat(chatId, { messages: [] });
}

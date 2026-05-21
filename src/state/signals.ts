import { signal, computed, effect } from '@preact/signals';
import type { AuthState, RunState, Route, Scenario, Agent, Utterance, Model } from '../types';

const K = {
  schemaVersion: 'gab.schema_version',
  key: 'gab.openrouter_key',
  via: 'gab.openrouter_via',
  scenarios: 'gab.scenarios',
  currentId: 'gab.current_scenario_id',
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
export const scenarios = signal<Scenario[]>(loadJSON<Scenario[]>(K.scenarios, []));
export const currentScenarioId = signal<string | null>(loadString(K.currentId));
export const runState = signal<RunState>('idle');
export const route = signal<Route>('login');

export const authState = computed<AuthState>(() => {
  if (openRouterKey.value && openRouterVia.value) {
    return { kind: 'authed', via: openRouterVia.value };
  }
  return { kind: 'anonymous' };
});

export const currentScenario = computed<Scenario | null>(() => {
  const id = currentScenarioId.value;
  if (!id) return null;
  return scenarios.value.find((s) => s.id === id) ?? null;
});

function debounce<T>(fn: (v: T) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (v: T) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(v), ms);
  };
}

const writeScenarios = debounce<Scenario[]>(
  (v) => localStorage.setItem(K.scenarios, JSON.stringify(v)),
  200,
);
effect(() => writeScenarios(scenarios.value));

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
  const v = currentScenarioId.value;
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

function replaceScenarios(next: Scenario[]) {
  scenarios.value = next;
}

export function createScenario(): Scenario {
  const now = Date.now();
  const s: Scenario = {
    id: uid(),
    name: 'Untitled gab',
    scenarioPrompt: '',
    defaultModel: 'google/gemini-3.1-flash-lite' as Model,
    agents: [],
    utterances: [],
    randomize: false,
    turnsRequested: 6,
    createdAt: now,
    updatedAt: now,
  };
  replaceScenarios([s, ...scenarios.value]);
  return s;
}

export function updateScenario(id: string, patch: Partial<Scenario>) {
  replaceScenarios(
    scenarios.value.map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
    ),
  );
}

export function deleteScenario(id: string) {
  replaceScenarios(scenarios.value.filter((s) => s.id !== id));
  if (currentScenarioId.value === id) currentScenarioId.value = null;
}

export function addAgent(scenarioId: string): Agent {
  const s = scenarios.value.find((x) => x.id === scenarioId);
  if (!s) throw new Error('scenario not found');
  const maxOrder = s.agents
    .filter((a) => !a.afterEach)
    .reduce((m, a) => Math.max(m, a.order), -1);
  const agent: Agent = {
    id: uid(),
    name: `Agent ${s.agents.length + 1}`,
    personaPrompt: '',
    model: null,
    afterEach: false,
    order: maxOrder + 1,
  };
  updateScenario(scenarioId, { agents: [...s.agents, agent] });
  return agent;
}

export function updateAgent(scenarioId: string, agentId: string, patch: Partial<Agent>) {
  const s = scenarios.value.find((x) => x.id === scenarioId);
  if (!s) return;
  updateScenario(scenarioId, {
    agents: s.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a)),
  });
}

export function deleteAgent(scenarioId: string, agentId: string) {
  const s = scenarios.value.find((x) => x.id === scenarioId);
  if (!s) return;
  updateScenario(scenarioId, { agents: s.agents.filter((a) => a.id !== agentId) });
}

export function reorderMainAgents(scenarioId: string, orderedIds: string[]) {
  const s = scenarios.value.find((x) => x.id === scenarioId);
  if (!s) return;
  const orderMap = new Map(orderedIds.map((id, i) => [id, i] as const));
  updateScenario(scenarioId, {
    agents: s.agents.map((a) =>
      a.afterEach ? a : { ...a, order: orderMap.get(a.id) ?? a.order },
    ),
  });
}

export function addUtterance(scenarioId: string, u: Utterance) {
  const s = scenarios.value.find((x) => x.id === scenarioId);
  if (!s) return;
  updateScenario(scenarioId, { utterances: [...s.utterances, u] });
}

export function clearUtterances(scenarioId: string) {
  updateScenario(scenarioId, { utterances: [] });
}

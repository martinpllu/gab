export const MODELS = ['google/gemini-3.1-flash-lite', 'moonshotai/kimi-k2.6'] as const;
export type Model = (typeof MODELS)[number];

export const MODEL_LABELS: Record<Model, string> = {
  'google/gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'moonshotai/kimi-k2.6': 'Kimi K2.6',
};

export interface Agent {
  id: string;
  name: string;
  personaPrompt: string;
  model: Model | null;
  afterEach: boolean;
  order: number;
}

export interface Utterance {
  id: string;
  turn: number;
  agentId: string;
  agentNameSnapshot: string;
  content: string;
  model: Model;
  timestamp: number;
}

export interface Scenario {
  id: string;
  name: string;
  scenarioPrompt: string;
  defaultModel: Model;
  agents: Agent[];
  utterances: Utterance[];
  randomize: boolean;
  turnsRequested: number | null;
  createdAt: number;
  updatedAt: number;
}

export type AuthState =
  | { kind: 'anonymous' }
  | { kind: 'authed'; via: 'oauth' | 'manual' };

export type RunState = 'idle' | 'running' | 'stopping';

export type Route = 'login' | 'list' | 'edit' | 'run';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

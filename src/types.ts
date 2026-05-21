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

export interface Message {
  id: string;
  agentId: string;
  agentNameSnapshot: string;
  content: string;
  model: Model;
  timestamp: number;
}

export interface Chat {
  id: string;
  name: string;
  chatPrompt: string;
  defaultModel: Model;
  agents: Agent[];
  messages: Message[];
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

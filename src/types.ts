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

export interface ChatDefinition {
  name: string;
  chatPrompt: string;
  defaultModel: Model;
  agents: Agent[];
  randomize: boolean;
  turnsRequested: number | null;
}

export interface Chat extends ChatDefinition {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface Run {
  id: string;
  chatId: string;
  chatSnapshot: ChatDefinition;
  fingerprint: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export type AuthState =
  | { kind: 'anonymous' }
  | { kind: 'authed'; via: 'oauth' | 'manual' };

export type RunState = 'idle' | 'running' | 'stopping';

export type Route =
  | { kind: 'login' }
  | { kind: 'list' }
  | { kind: 'runs'; chatId: string }
  | { kind: 'run'; chatId: string; runId: string };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Spec types are the source of truth for the orchestration layer.
// Re-exported here so the rest of the app imports scenario types from `./types`.
export type {
  AgentId,
  ScenarioId,
  MessageId,
  ModelParams,
  AgentDefinition,
  MessageScope,
  DefaultableScope,
  Kickoff,
  ChatDefinition,
  SelectionContext,
  TurnPolicy,
  StopCondition,
  PhaseStep,
  Flow,
  ScenarioMetadata,
  ChatSpec,
} from './spec/types';

import type { AgentId, ChatSpec, MessageId, MessageScope } from './spec/types';

// Suggested models for the picker. Not a closed set — `model` is a free string
// (any OpenRouter ID). Display falls back to the raw ID for unknown models.
export const MODELS = ['google/gemini-3.1-flash-lite', 'moonshotai/kimi-k2.6'] as const;

export const MODEL_LABELS: Record<string, string> = {
  'google/gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'moonshotai/kimi-k2.6': 'Kimi K2.6',
};

// ---------------------------------------------------------------------------
// Message — the spec's Message shape plus Gab extensions.
//
// Extensions over spec/types Message:
//  - fromNameSnapshot: sender's display name frozen at write time. Required for
//    cache-stable history — rendered labels must never change on later turns, so
//    history is rendered from this, never from the live spec name.
//  - toNamesSnapshot: recipient display names frozen at write time (for direct /
//    multicast scope labels), same cache-stability reason.
//  - model: which model produced the message (transcript display only).
// ---------------------------------------------------------------------------

export type MessageSender = AgentId | 'user' | 'system' | 'seed';

export interface Message {
  id: MessageId;
  from: MessageSender;
  role: 'user' | 'assistant' | 'system';
  content: string;
  scope: MessageScope;
  at: number;
  /** Sender display name frozen at write time. Absent for synthetic senders. */
  fromNameSnapshot?: string;
  /** Recipient display names frozen at write time, in scope order (direct/multicast). */
  toNamesSnapshot?: string[];
  /** Model that produced this message (display only). */
  model?: string;
  /** Cost of the completion that produced this message, in USD. */
  cost?: number;
  /** Wall-clock latency of the completion that produced this message, in ms. */
  latencyMs?: number;
  /**
   * Verbatim assistant completion that produced this turn, before directive
   * parsing. Set only on the first message of a turn (a turn can split into
   * several messages); the displayed `content` is a parsed slice of this.
   * Display only — surfaced behind a disclosure toggle in the transcript.
   */
  raw?: string;
}

// ---------------------------------------------------------------------------
// Chat (editable template) and Run (immutable snapshot) — Gab extensions.
// A Chat wraps an editable ChatSpec; a Run freezes a copy of it plus messages.
// ---------------------------------------------------------------------------

export interface Chat {
  id: string;
  spec: ChatSpec;
  createdAt: number;
  updatedAt: number;
}

export type RunReason =
  | 'stop-condition'
  | 'policy-returned-null'
  | 'no-participants'
  | 'stopped'
  | 'error';

export interface Run {
  id: string;
  chatId: string;
  specSnapshot: ChatSpec;
  fingerprint: string;
  messages: Message[];
  reason?: RunReason;
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

// ---------------------------------------------------------------------------
// Wire shape for OpenRouter chat completions.
// Extended in Phase 2 to carry tool calls; kept minimal here.
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** OpenRouter request params we pass through from AgentDefinition.params. */
export interface CompletionParams {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  [extra: string]: unknown;
}

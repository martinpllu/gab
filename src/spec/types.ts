/**
 * A declarative language for multi-agent chat scenarios.
 *
 * Core concepts:
 *  - Agents have stable IDs and mutable display names.
 *  - Every utterance is a Message with an addressing scope:
 *      self      — visible only to the sender on future turns (scratchpad).
 *      direct    — to one named recipient.
 *      multicast — to an explicit set of recipients.
 *      broadcast — to every participant.
 *    An agent's view of the chat is the filtered subset addressed to it,
 *    its own messages, plus broadcasts. Omnipotent agents see everything.
 *  - Turn policies are structural — they describe rotation patterns, not
 *    roles. Whether an agent acts as judge, translator, summariser, or
 *    quality-checker is a property of its prompt, not the framework.
 */

// ---------------------------------------------------------------------------
// IDs — opaque, stable
// ---------------------------------------------------------------------------

export type AgentId = string & { readonly __brand: "AgentId" };
export type ScenarioId = string & { readonly __brand: "ScenarioId" };
export type MessageId = string & { readonly __brand: "MessageId" };

// ---------------------------------------------------------------------------
// 1. Agents
// ---------------------------------------------------------------------------

export interface ModelParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  extra?: Record<string, unknown>;
}

export interface AgentDefinition {
  /** Stable opaque ID. Referenced from chat and flow. Never shown directly. */
  id: AgentId;
  /** Mutable display label. */
  name: string;
  /** OpenRouter model ID. */
  model: string;
  /** System prompt sent at the start of every request for this agent. */
  systemPrompt: string;
  /**
   * Optional public description shown to other agents in the roster.
   * Lets agents know who their peers are without an intro round.
   * If absent, peers see only the name.
   */
  publicDescription?: string;
  params?: ModelParams;

  /**
   * Default scope this agent's messages take when it doesn't declare one
   * via structured output. If omitted, the chat-level default is used.
   */
  defaultMessageScope?: DefaultableScope;

  /**
   * Omnipotent agents see all messages regardless of addressing.
   * Use sparingly — typically for referee/observer agents. Default: false.
   */
  omnipotent?: boolean;
}

// ---------------------------------------------------------------------------
// 2. Message addressing
// ---------------------------------------------------------------------------

/**
 * Addressing scope for a message.
 *
 * `direct` is modelled as a discrete variant rather than "multicast with one
 * recipient" so the UI and validators can treat the common case naturally.
 */
export type MessageScope =
  | { type: "self" }
  | { type: "direct"; to: AgentId }
  | { type: "multicast"; to: AgentId[] }
  | { type: "broadcast" };

/**
 * The scope an agent can declare as its default. Excludes `direct` and
 * `multicast` because those require knowing who the recipients are at the
 * moment of sending — they only make sense per-message.
 */
export type DefaultableScope =
  | { type: "self" }
  | { type: "broadcast" };

export interface Message {
  id: MessageId;
  /** Sender — agent ID or one of the synthetic senders. */
  from: AgentId | "user" | "system" | "seed";
  /** OpenAI-style role used when assembling per-agent contexts. */
  role: "user" | "assistant" | "system";
  content: string;
  /** Addressing scope. Determines visibility. */
  scope: MessageScope;
  /** Wall-clock timestamp (ms since epoch). */
  at: number;
}

// ---------------------------------------------------------------------------
// 3. Chat
// ---------------------------------------------------------------------------

export type Kickoff =
  | { type: "user" }
  | { type: "seed"; message: string; role?: "user" | "system" }
  | { type: "agent"; agentId: AgentId };

export interface ChatDefinition {
  /** Shared "rules of the room" prepended to every agent's context. */
  sharedPrompt?: string;
  /** Participating agent IDs. Must all exist in the agents map. */
  participants: AgentId[];
  kickoff: Kickoff;
  /**
   * Default addressing scope for messages whose agent didn't specify one
   * and whose agent has no `defaultMessageScope`. Defaults to broadcast.
   */
  defaultMessageScope?: DefaultableScope;
}

// ---------------------------------------------------------------------------
// 4. Selection context (for selectors and predicates)
// ---------------------------------------------------------------------------

/**
 * Context passed to function-valued selectors and predicates.
 * The full message log is provided — the runtime, like the orchestrator,
 * sees everything. Visibility filtering only applies to what each agent
 * receives in its prompt.
 */
export interface SelectionContext {
  /** Full message log so far (unfiltered). */
  log: Message[];
  /** Last agent that sent a message, or null. */
  lastSpeaker: AgentId | null;
  /** All participants in the chat. */
  participants: AgentId[];
  /** Current turn number (1-indexed, counts agent turns only). */
  turn: number;
}

// ---------------------------------------------------------------------------
// 5. Turn policies — all structural, no role assumptions
// ---------------------------------------------------------------------------

export type TurnPolicy =
  /** Cycle through `order` (defaults to chat.participants). */
  | { type: "round-robin"; order?: AgentId[] }

  /** Random pick from `pool`. */
  | { type: "random"; pool?: AgentId[]; avoidRepeat?: boolean }

  /**
   * Interleave pattern: after each agent in `rotation` speaks, the
   * `interleaver` agent speaks. Sequence: A → I → B → I → C → I → A → …
   *
   * This is a structural pattern, not a role. The interleaver may be acting
   * as a judge, translator, summariser, fact-checker, etc. — that's defined
   * entirely by its prompt, not by the framework.
   */
  | { type: "interleave"; interleaver: AgentId; rotation: AgentId[] }

  /**
   * A selector agent picks the next speaker. The selector reads what it can
   * see (per its own visibility) and replies with a participant ID or name.
   */
  | { type: "agent-select"; selectorAgent: AgentId }

  /**
   * Fully programmatic selection. Function-valued — not UI-buildable.
   */
  | {
      type: "custom";
      select: (ctx: SelectionContext) => Promise<AgentId | null> | AgentId | null;
    };

// ---------------------------------------------------------------------------
// 6. Stop conditions
// ---------------------------------------------------------------------------

export type StopCondition =
  | { type: "max-turns"; turns: number }
  | { type: "max-rounds"; rounds: number }
  | {
      type: "signal";
      phrase: string;
      caseSensitive?: boolean;
      fromAgent?: AgentId;
    }
  | { type: "timeout-ms"; ms: number }
  /** Function-valued — not UI-buildable. */
  | { type: "predicate"; check: (ctx: SelectionContext) => boolean }
  | { type: "any"; of: StopCondition[] }
  | { type: "all"; of: StopCondition[] };

// ---------------------------------------------------------------------------
// 7. Flow — opening / main / closing phases
// ---------------------------------------------------------------------------

export interface PhaseStep {
  agentId: AgentId;
  /** Optional user-role prompt injected before the agent speaks. */
  promptOverride?: string;
  /**
   * Override the scope for this single turn. Useful when a phase-step
   * message should reach everyone regardless of the agent's default
   * (e.g. an opening framing message broadcast even though the agent
   * usually speaks privately to one peer).
   */
  scopeOverride?: MessageScope;
}

export interface Flow {
  opening?: PhaseStep[];
  main: {
    policy: TurnPolicy;
    /** Required — at least one stop condition. No infinite loops. */
    stop: StopCondition[];
  };
  closing?: PhaseStep[];
}

// ---------------------------------------------------------------------------
// 8. Top-level spec
// ---------------------------------------------------------------------------

export interface ScenarioMetadata {
  id: ScenarioId;
  title: string;
  description?: string;
  specVersion: 1;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSpec {
  metadata: ScenarioMetadata;
  /** Agents in this scenario. IDs are unique within the array. */
  agents: AgentDefinition[];
  chat: ChatDefinition;
  flow: Flow;
}

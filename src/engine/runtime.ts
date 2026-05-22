import type {
  AgentDefinition,
  AgentId,
  ChatMessage,
  ChatSpec,
  CompletionParams,
  Message,
  MessageId,
  MessageScope,
  PhaseStep,
} from "../types";
import { getAgent, visibleTo } from "./visibility";
import { buildSystemPrompt, renderMessageForViewer } from "./prompt";
import { parseTurn } from "./protocol";
import { evaluateStops, type StopContext } from "./stop";
import { initialPolicyState, pickNext, type PolicyState } from "./policy";
import { chatCompletion } from "../api/openrouter";

export interface RuntimeOptions {
  /** Initial user message — required only when kickoff.type === "user". */
  initialUserMessage?: string;
  /** Called after each message is appended to the log. Useful for streaming UI. */
  onMessage?: (m: Message) => void;
  /** Cooperative cancellation — checked before each main-loop turn. */
  shouldStop?: () => boolean;
  /** Called when an agent's completion starts/ends. Drives the "thinking" UI. */
  onAgentStart?: (agent: AgentDefinition) => void;
  onAgentEnd?: (agent: AgentDefinition) => void;
  /**
   * Existing messages to resume from. When provided, the runner skips kickoff
   * and the opening phase and re-enters the main loop with this history in
   * place — used to continue (extend) a stopped run.
   */
  resumeFrom?: Message[];
}

export interface RunResult {
  log: Message[];
  reason:
    | "stop-condition"
    | "policy-returned-null"
    | "no-participants"
    | "stopped";
}

type AppendInput = Omit<Message, "id" | "at">;

export class ChatRunner {
  private readonly spec: ChatSpec;
  private readonly opts: RuntimeOptions;
  private readonly log: Message[] = [];
  /**
   * Cost of a selector completion that produced no message of its own. Folded
   * into the next agent turn's recorded cost so `agent-select` overhead isn't
   * lost from the totals.
   */
  private pendingSelectorCost = 0;

  constructor(spec: ChatSpec, opts: RuntimeOptions = {}) {
    this.spec = spec;
    this.opts = opts;
    // Resuming: preload prior history (without re-emitting via onMessage) and
    // skip kickoff/opening so we re-enter the main loop where we left off.
    if (opts.resumeFrom?.length) this.log.push(...opts.resumeFrom);
  }

  async run(): Promise<RunResult> {
    const resuming = (this.opts.resumeFrom?.length ?? 0) > 0;

    if (!resuming) {
      await this.kickoff();

      if (this.spec.flow.opening) {
        for (const step of this.spec.flow.opening) {
          await this.runPhaseStep(step);
        }
      }
    }

    const reason = await this.runMainLoop();

    if (this.spec.flow.closing) {
      for (const step of this.spec.flow.closing) {
        await this.runPhaseStep(step);
      }
    }

    return { log: this.log, reason };
  }

  // -------------------------------------------------------------------------
  // Kickoff
  // -------------------------------------------------------------------------

  private async kickoff(): Promise<void> {
    const k = this.spec.chat.kickoff;
    switch (k.type) {
      case "seed":
        this.append({
          from: "seed",
          role: k.role ?? "user",
          content: k.message,
          scope: { type: "broadcast" },
        });
        return;
      case "user":
        if (!this.opts.initialUserMessage) {
          throw new Error(
            "Kickoff is `user` but no `initialUserMessage` was supplied to the runtime.",
          );
        }
        this.append({
          from: "user",
          role: "user",
          content: this.opts.initialUserMessage,
          scope: { type: "broadcast" },
        });
        return;
      case "agent": {
        const agent = getAgent(this.spec.agents, k.agentId);
        await this.runAgentTurn(agent, {});
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase steps (opening / closing)
  // -------------------------------------------------------------------------

  private async runPhaseStep(step: PhaseStep): Promise<void> {
    const agent = getAgent(this.spec.agents, step.agentId);
    await this.runAgentTurn(agent, {
      promptOverride: step.promptOverride,
      forcedScope: step.scopeOverride,
    });
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  private async runMainLoop(): Promise<RunResult["reason"]> {
    const policyState: PolicyState = initialPolicyState();
    const participants = this.spec.chat.participants;
    if (participants.length === 0) return "no-participants";

    // When resuming, advance the rotation past whoever spoke last so the
    // round-robin/interleave continues from the right place rather than the top.
    if (this.opts.resumeFrom?.length) this.seedPolicyState(policyState, participants);

    const loopStartedAt = Date.now();
    let turnsTaken = 0;
    let roundsCompleted = 0;
    let turnsInCurrentRound = 0;

    while (true) {
      if (this.opts.shouldStop?.()) return "stopped";

      const stopCtx: StopContext = {
        log: this.log,
        participants,
        turnsTaken,
        roundsCompleted,
        loopStartedAt,
      };
      if (evaluateStops(this.spec.flow.main.stop, stopCtx)) {
        return "stop-condition";
      }

      const selectionCtx = {
        log: this.log,
        lastSpeaker: policyState.lastPick,
        participants,
        turn: turnsTaken + 1,
      };

      const nextId = await pickNext(
        this.spec.flow.main.policy,
        policyState,
        selectionCtx,
        this.spec.agents,
        (selector) => this.runSelector(selector),
        (reply, fallbackName) => this.appendSelectFallback(reply, fallbackName),
      );
      if (nextId === null) return "policy-returned-null";

      const agent = getAgent(this.spec.agents, nextId);
      await this.runAgentTurn(agent, {});
      turnsTaken += 1;
      turnsInCurrentRound += 1;
      if (turnsInCurrentRound >= participants.length) {
        roundsCompleted += 1;
        turnsInCurrentRound = 0;
      }
    }
  }

  /**
   * Seed policy state from the resumed log so a continued run picks up the
   * rotation where it left off. We look at the last agent that spoke and set
   * the round-robin index to the slot *after* it; `lastPick` is set so
   * `random.avoidRepeat` also behaves.
   */
  private seedPolicyState(state: PolicyState, participants: AgentId[]): void {
    const policy = this.spec.flow.main.policy;
    const order = policy.type === "round-robin" ? policy.order ?? participants : participants;

    let lastAgent: AgentId | null = null;
    for (let i = this.log.length - 1; i >= 0; i--) {
      const from = this.log[i].from;
      if (participants.includes(from as AgentId)) {
        lastAgent = from as AgentId;
        break;
      }
    }
    if (!lastAgent) return;

    state.lastPick = lastAgent;
    const idx = order.indexOf(lastAgent);
    if (idx >= 0) state.roundRobinIdx = idx + 1;
  }

  // -------------------------------------------------------------------------
  // A single agent turn
  // -------------------------------------------------------------------------

  private async runAgentTurn(
    agent: AgentDefinition,
    opts: { promptOverride?: string; forcedScope?: MessageScope },
  ): Promise<void> {
    const messages = this.buildChatMessages(agent, opts.promptOverride);

    this.opts.onAgentStart?.(agent);
    let result;
    try {
      result = await chatCompletion({
        model: agent.model,
        messages,
        user: agent.id,
        params: this.completionParams(agent),
      });
    } finally {
      this.opts.onAgentEnd?.(agent);
    }

    const peers = this.spec.agents.filter((a) => a.id !== agent.id);
    const parsed = parseTurn(result.content, agent.id, peers);

    // Drain any selector overhead accrued since the last recorded message and
    // fold it into this turn's cost.
    const selectorCost = this.pendingSelectorCost;
    this.pendingSelectorCost = 0;
    const turnCost =
      result.cost !== undefined || selectorCost > 0
        ? (result.cost ?? 0) + selectorCost
        : undefined;

    if (parsed.length === 0) {
      // Empty reply — nothing to record. Leave a faint self-note so the turn
      // isn't silently lost from the agent's own perspective.
      this.appendFromAgent(agent, "[no message produced this turn]", { type: "self" }, turnCost, result.latencyMs);
      return;
    }

    // A phase/opening step can force a scope; when forced, the whole turn goes
    // to that scope regardless of any @-directives the agent wrote.
    // One completion can yield several messages; attribute its full cost and
    // latency to the first one recorded so the turn isn't double-counted.
    let costForTurn: number | undefined = turnCost;
    let latencyForTurn: number | undefined = result.latencyMs;
    for (const msg of parsed) {
      if (!msg.ok) {
        // Surface the error privately so the agent self-corrects next turn.
        this.appendFromAgent(agent, `[addressing error] ${msg.error}`, { type: "self" }, costForTurn, latencyForTurn);
        costForTurn = undefined;
        latencyForTurn = undefined;
        continue;
      }
      this.appendFromAgent(agent, msg.content, opts.forcedScope ?? msg.scope, costForTurn, latencyForTurn);
      costForTurn = undefined;
      latencyForTurn = undefined;
    }
  }

  /**
   * Run the selector agent for `agent-select`. Given its normal view of the
   * chat and asked to reply with a participant name. No tools — its plain-text
   * reply is the selection.
   */
  private async runSelector(selector: AgentDefinition): Promise<string> {
    const messages = this.buildChatMessages(
      selector,
      "Reply with the display name of the participant who should speak next. " +
        "Reply with the name only, on a single line. Do not use any tools.",
    );
    this.opts.onAgentStart?.(selector);
    let result;
    try {
      result = await chatCompletion({
        model: selector.model,
        messages,
        user: selector.id,
        params: this.completionParams(selector),
      });
    } finally {
      this.opts.onAgentEnd?.(selector);
    }
    if (result.cost !== undefined) this.pendingSelectorCost += result.cost;
    return result.content.trim();
  }

  // -------------------------------------------------------------------------
  // Building the per-agent chat messages array (cache-stable)
  // -------------------------------------------------------------------------

  private buildChatMessages(
    agent: AgentDefinition,
    extraUserPrompt?: string,
  ): ChatMessage[] {
    const system = buildSystemPrompt(agent, this.spec.chat, this.spec.agents);
    const out: ChatMessage[] = [{ role: "system", content: system }];

    // One ChatMessage per visible log entry — append-only, byte-stable prefix.
    const visible = visibleTo(agent, this.log);
    for (const m of visible) {
      out.push(renderMessageForViewer(m, agent.id));
    }

    if (extraUserPrompt) {
      out.push({ role: "user", content: extraUserPrompt });
    }

    return out;
  }

  // -------------------------------------------------------------------------
  // Append helpers
  // -------------------------------------------------------------------------

  /** Append a message from an agent, snapshotting sender + recipient names. */
  private appendFromAgent(
    agent: AgentDefinition,
    content: string,
    scope: MessageScope,
    cost?: number,
    latencyMs?: number,
  ): void {
    this.append({
      from: agent.id,
      role: "assistant",
      content,
      scope,
      fromNameSnapshot: agent.name,
      toNamesSnapshot: this.recipientNames(scope),
      model: agent.model,
      ...(cost !== undefined && { cost }),
      ...(latencyMs !== undefined && { latencyMs }),
    });
  }

  private appendSelectFallback(reply: string, fallbackName: string): void {
    this.append({
      from: "system",
      role: "system",
      content:
        `[selector fallback] "${reply}" didn't match a participant; ` +
        `picked ${fallbackName} by round-robin.`,
      scope: { type: "broadcast" },
    });
  }

  /** Resolve recipient display names in the same order as the scope's IDs. */
  private recipientNames(scope: MessageScope): string[] | undefined {
    switch (scope.type) {
      case "direct":
        return [getAgent(this.spec.agents, scope.to).name];
      case "multicast":
        return scope.to.map((id) => getAgent(this.spec.agents, id).name);
      default:
        return undefined;
    }
  }

  private append(partial: AppendInput): Message {
    const m: Message = {
      ...partial,
      id: crypto.randomUUID() as MessageId,
      at: Date.now(),
    };
    this.log.push(m);
    this.opts.onMessage?.(m);
    return m;
  }

  private completionParams(agent: AgentDefinition): CompletionParams | undefined {
    const p = agent.params;
    if (!p) return undefined;
    return {
      ...(p.temperature !== undefined && { temperature: p.temperature }),
      ...(p.topP !== undefined && { top_p: p.topP }),
      ...(p.topK !== undefined && { top_k: p.topK }),
      ...(p.maxTokens !== undefined && { max_tokens: p.maxTokens }),
      ...(p.frequencyPenalty !== undefined && { frequency_penalty: p.frequencyPenalty }),
      ...(p.presencePenalty !== undefined && { presence_penalty: p.presencePenalty }),
      ...(p.stop !== undefined && { stop: p.stop }),
      ...(p.extra ?? {}),
    };
  }
}

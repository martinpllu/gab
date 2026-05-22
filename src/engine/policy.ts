import type {
  AgentDefinition,
  AgentId,
  SelectionContext,
  TurnPolicy,
} from "../types";
import { findAgentByName, getAgent } from "./visibility";

/**
 * State the policies maintain across turns. We hide this inside the runtime
 * so policies remain pure functions of (policy, state, context).
 */
export interface PolicyState {
  /** Index into a round-robin order list. */
  roundRobinIdx: number;
  /** Last selected agent (for `random.avoidRepeat` and interleave). */
  lastPick: AgentId | null;
  /** For `interleave`: whether the next turn should be the interleaver. */
  interleaveNextIsInterleaver: boolean;
  /** For `interleave`: index into the rotation list. */
  interleaveRotationIdx: number;
}

export function initialPolicyState(): PolicyState {
  return {
    roundRobinIdx: 0,
    lastPick: null,
    interleaveNextIsInterleaver: false,
    interleaveRotationIdx: 0,
  };
}

/**
 * Pick the next speaker. Returns null to signal that the main loop should end
 * (only `custom` can do this; structural policies always pick someone).
 */
export async function pickNext(
  policy: TurnPolicy,
  state: PolicyState,
  ctx: SelectionContext,
  agents: AgentDefinition[],
  selectorRunner: SelectorRunner,
  onSelectFallback?: (reply: string, fallbackName: string) => void,
): Promise<AgentId | null> {
  switch (policy.type) {
    case "round-robin": {
      const order = policy.order ?? ctx.participants;
      if (order.length === 0) return null;
      const pick = order[state.roundRobinIdx % order.length];
      state.roundRobinIdx += 1;
      state.lastPick = pick;
      return pick;
    }

    case "random": {
      const pool = policy.pool ?? ctx.participants;
      if (pool.length === 0) return null;
      const candidates =
        policy.avoidRepeat && state.lastPick && pool.length > 1
          ? pool.filter((id) => id !== state.lastPick)
          : pool;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      state.lastPick = pick;
      return pick;
    }

    case "interleave": {
      if (state.interleaveNextIsInterleaver) {
        state.interleaveNextIsInterleaver = false;
        state.lastPick = policy.interleaver;
        return policy.interleaver;
      }
      if (policy.rotation.length === 0) return null;
      const pick = policy.rotation[state.interleaveRotationIdx % policy.rotation.length];
      state.interleaveRotationIdx += 1;
      state.interleaveNextIsInterleaver = true;
      state.lastPick = pick;
      return pick;
    }

    case "agent-select": {
      const selector = getAgent(agents, policy.selectorAgent);
      const replyText = await selectorRunner(selector);
      const pick = findAgentByName(agents, replyText.trim());
      if (!pick || !ctx.participants.includes(pick.id)) {
        // Selector picked nobody valid — fall back to round-robin behaviour
        // for stability rather than crashing.
        const pool = ctx.participants;
        if (pool.length === 0) return null;
        const fallback = pool[state.roundRobinIdx % pool.length];
        state.roundRobinIdx += 1;
        state.lastPick = fallback;
        const fallbackAgent = agents.find((a) => a.id === fallback);
        onSelectFallback?.(replyText.trim(), fallbackAgent?.name ?? fallback);
        return fallback;
      }
      state.lastPick = pick.id;
      return pick.id;
    }

    case "custom": {
      const pick = await policy.select(ctx);
      if (pick) state.lastPick = pick;
      return pick;
    }
  }
}

/**
 * A small function the policy can call to run the selector agent.
 * The runtime supplies this — we don't want the policy module to know
 * anything about OpenAI/OpenRouter clients.
 */
export type SelectorRunner = (selector: AgentDefinition) => Promise<string>;

import type {
  AgentDefinition,
  Message,
  SelectionContext,
  StopCondition,
} from "../types";

/**
 * Evaluate whether any of the given stop conditions has fired.
 * Returns the first matching condition (useful for logging) or null.
 *
 * The list at the top level is OR'd; use `any` / `all` variants for explicit
 * boolean composition within.
 */
export function evaluateStops(
  conditions: StopCondition[],
  ctx: StopContext,
): StopCondition | null {
  for (const cond of conditions) {
    if (evaluate(cond, ctx)) return cond;
  }
  return null;
}

export interface StopContext {
  log: Message[];
  participants: AgentDefinition["id"][];
  /** Number of agent turns taken in the main loop so far. */
  turnsTaken: number;
  /** Number of complete rounds (every participant has spoken once). */
  roundsCompleted: number;
  /** Wall-clock time the main loop started (ms since epoch). */
  loopStartedAt: number;
}

function evaluate(cond: StopCondition, ctx: StopContext): boolean {
  switch (cond.type) {
    case "max-turns":
      return ctx.turnsTaken >= cond.turns;

    case "max-rounds":
      return ctx.roundsCompleted >= cond.rounds;

    case "timeout-ms":
      return Date.now() - ctx.loopStartedAt >= cond.ms;

    case "signal": {
      const needle = cond.caseSensitive ? cond.phrase : cond.phrase.toLowerCase();
      for (const m of ctx.log) {
        if (cond.fromAgent && m.from !== cond.fromAgent) continue;
        const haystack = cond.caseSensitive ? m.content : m.content.toLowerCase();
        if (haystack.includes(needle)) return true;
      }
      return false;
    }

    case "predicate":
      return cond.check(toSelectionContext(ctx));

    case "any":
      return cond.of.some((c) => evaluate(c, ctx));

    case "all":
      return cond.of.length > 0 && cond.of.every((c) => evaluate(c, ctx));
  }
}

function toSelectionContext(ctx: StopContext): SelectionContext {
  const lastAgentMsg = [...ctx.log].reverse().find((m) =>
    m.from !== "user" && m.from !== "system" && m.from !== "seed",
  );
  return {
    log: ctx.log,
    lastSpeaker: lastAgentMsg ? (lastAgentMsg.from as AgentDefinition["id"]) : null,
    participants: ctx.participants,
    turn: ctx.turnsTaken,
  };
}

import type { ChatSpec, Run, StopCondition } from "../types";
import { ChatRunner } from "./runtime";
import { addMessageToRun, runState, setRunReason, clearRunMessages } from "../state/signals";

const SOFT_TURN_CAP = 50;

/** True if the spec already bounds the main loop by turns/rounds/time. */
function hasHardBound(stops: StopCondition[]): boolean {
  const bounded = (c: StopCondition): boolean => {
    switch (c.type) {
      case "max-turns":
      case "max-rounds":
      case "timeout-ms":
        return true;
      case "all":
        return c.of.every(bounded);
      case "any":
        return c.of.some(bounded);
      default:
        return false;
    }
  };
  return stops.some(bounded);
}

/** Ensure the main loop can't run unbounded — inject a soft cap if needed. */
function withSoftCap(spec: ChatSpec): ChatSpec {
  if (hasHardBound(spec.flow.main.stop)) return spec;
  return {
    ...spec,
    flow: {
      ...spec.flow,
      main: {
        ...spec.flow.main,
        stop: [...spec.flow.main.stop, { type: "max-turns", turns: SOFT_TURN_CAP }],
      },
    },
  };
}

export interface StartRunOptions {
  /** Required when the spec's kickoff is `user`. */
  initialUserMessage?: string;
}

/**
 * Run a previously-created Run to completion against its frozen spec snapshot.
 * Streams each message into the store via onMessage and persists the stop reason.
 * Starts from empty — clears any existing messages first (continuation is not
 * yet supported).
 */
export async function startRun(run: Run, opts: StartRunOptions = {}): Promise<void> {
  if (runState.value !== "idle") return;
  runState.value = "running";

  if (run.messages.length > 0) clearRunMessages(run.id);

  const spec = withSoftCap(run.specSnapshot);

  try {
    const runner = new ChatRunner(spec, {
      initialUserMessage: opts.initialUserMessage,
      onMessage: (m) => addMessageToRun(run.id, m),
      shouldStop: () => runState.value === "stopping",
    });
    const result = await runner.run();
    setRunReason(run.id, result.reason);
  } catch (e) {
    setRunReason(run.id, "error");
    throw e;
  } finally {
    runState.value = "idle";
  }
}

export function requestStop() {
  if (runState.value === "running") runState.value = "stopping";
}

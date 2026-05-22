import type { Run } from './types';

/** Sum of per-message costs in USD. Messages without a cost contribute nothing. */
export function runCost(run: Run): number {
  return run.messages.reduce((sum, m) => sum + (m.cost ?? 0), 0);
}

/** Total cost across a set of runs in USD. */
export function totalCost(runs: Run[]): number {
  return runs.reduce((sum, r) => sum + runCost(r), 0);
}

/** Cost across all runs belonging to a chat, in USD. */
export function chatCost(chatId: string, runs: Run[]): number {
  return totalCost(runs.filter((r) => r.chatId === chatId));
}

/**
 * Format a USD cost with adaptive precision: enough significant digits to stay
 * meaningful for sub-cent per-message costs while staying readable for totals.
 * Returns null for a zero/absent cost so callers can omit the label entirely.
 */
export function formatCost(usd: number | undefined): string | null {
  if (!usd || usd <= 0) return null;
  let decimals: number;
  if (usd >= 1) decimals = 2;
  else if (usd >= 0.01) decimals = 3;
  else decimals = 5;
  return `$${usd.toFixed(decimals)}`;
}

/** Format a latency in ms as "320ms" or "1.4s". Returns null when absent. */
export function formatLatency(ms: number | undefined): string | null {
  if (ms == null || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

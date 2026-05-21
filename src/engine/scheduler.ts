import type { Agent, ChatDefinition, Message, Run } from '../types';
import { addMessageToRun, runState, runs, uid } from '../state/signals';
import { buildMessagesForAgent } from './history';
import { chatCompletion } from '../api/openrouter';

const SOFT_TURN_CAP = 50;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pickNextAgent(
  def: ChatDefinition,
  messageCount: number,
  seedKey: string,
): Agent | null {
  const mainAgents = def.agents
    .filter((a) => !a.afterEach)
    .sort((a, b) => a.order - b.order);
  const afterAgents = def.agents
    .filter((a) => a.afterEach)
    .sort((a, b) => a.order - b.order);

  if (mainAgents.length === 0) return null;

  const block = 1 + afterAgents.length;
  const subIdx = messageCount % block;
  const mainStepIndex = Math.floor(messageCount / block);
  const cycleNum = Math.floor(mainStepIndex / mainAgents.length);
  const mainPos = mainStepIndex % mainAgents.length;

  if (subIdx === 0) {
    const cycleOrder = def.randomize
      ? shuffle(mainAgents, mulberry32(hashString(seedKey + ':' + cycleNum)))
      : mainAgents;
    return cycleOrder[mainPos]!;
  }
  return afterAgents[subIdx - 1]!;
}

export async function runLoop(runId: string, turnsOverride?: number | null): Promise<void> {
  if (runState.value !== 'idle') return;
  runState.value = 'running';
  try {
    const startN = runs.value.find((r) => r.id === runId)?.messages.length ?? 0;
    let executed = 0;
    while (runState.value === 'running') {
      const r: Run | undefined = runs.value.find((x) => x.id === runId);
      if (!r) break;

      const requested =
        turnsOverride !== undefined ? turnsOverride : r.chatSnapshot.turnsRequested;
      const limit = requested ?? SOFT_TURN_CAP;
      if (executed >= limit) break;
      if (requested == null && r.messages.length - startN >= SOFT_TURN_CAP) break;

      const agent = pickNextAgent(r.chatSnapshot, r.messages.length, r.id);
      if (!agent) break;

      const messages = buildMessagesForAgent(r.chatSnapshot, r.messages, agent);
      const model = agent.model ?? r.chatSnapshot.defaultModel;
      const content = await chatCompletion({ model, messages, user: agent.id });

      const m: Message = {
        id: uid(),
        agentId: agent.id,
        agentNameSnapshot: agent.name,
        content,
        model,
        timestamp: Date.now(),
      };
      addMessageToRun(runId, m);
      executed++;
    }
  } finally {
    runState.value = 'idle';
  }
}

export function requestStop() {
  if (runState.value === 'running') runState.value = 'stopping';
}

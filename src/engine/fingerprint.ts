import type { ChatDefinition } from '../types';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = canonicalize(obj[k]);
    return out;
  }
  return value;
}

function fnv1aHex(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function fingerprintDefinition(def: ChatDefinition): string {
  const normalized = {
    name: def.name,
    chatPrompt: def.chatPrompt,
    defaultModel: def.defaultModel,
    randomize: def.randomize,
    turnsRequested: def.turnsRequested,
    agents: [...def.agents]
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        personaPrompt: a.personaPrompt,
        model: a.model,
        afterEach: a.afterEach,
        order: a.order,
      })),
  };
  return fnv1aHex(JSON.stringify(canonicalize(normalized)));
}

export function snapshotDefinition(def: ChatDefinition): ChatDefinition {
  return {
    name: def.name,
    chatPrompt: def.chatPrompt,
    defaultModel: def.defaultModel,
    randomize: def.randomize,
    turnsRequested: def.turnsRequested,
    agents: def.agents.map((a) => ({ ...a })),
  };
}

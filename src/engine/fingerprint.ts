import type { ChatSpec } from '../types';

function canonicalize(value: unknown): unknown {
  if (typeof value === 'function') return undefined;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      const v = canonicalize(obj[k]);
      if (v !== undefined) out[k] = v;
    }
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

/**
 * Fingerprint the run-affecting parts of a spec: agents, chat, flow.
 * Excludes `metadata` entirely (title/description/timestamps don't change
 * what a run does). Function-valued policy/stop fields are dropped by
 * canonicalize — they're programmatic-only and never UI-authored.
 */
export function fingerprintDefinition(spec: ChatSpec): string {
  const normalized = {
    agents: spec.agents,
    chat: spec.chat,
    flow: spec.flow,
  };
  return fnv1aHex(JSON.stringify(canonicalize(normalized)));
}

/** Deep structural copy of a spec, dropping any function-valued fields. */
export function snapshotDefinition(spec: ChatSpec): ChatSpec {
  return structuredClone(spec);
}

import type { AgentDefinition, MessageScope } from "../types";
import { findAgentByName } from "./visibility";

/**
 * An informal, prompt-baked addressing protocol — no native tool calling, so it
 * runs on any model OpenRouter exposes.
 *
 * An agent's turn is plain text, optionally split into addressed blocks by
 * leading @-directive lines:
 *
 *   @all          broadcast to everyone (the default)
 *   @Name         direct message to one participant
 *   @Name @Other  multicast to several
 *   @self         a private note only the sender sees later
 *
 * A block is a directive line plus the text that follows it (on the same line
 * and/or subsequent lines) until the next directive line. Text with no leading
 * directive is treated as a single broadcast — so a model that just writes prose
 * still "says" it to the group.
 */

export type ParsedMessage =
  | { ok: true; scope: MessageScope; content: string }
  | { ok: false; error: string };

const RESERVED = new Set(["all", "self"]);

/** A line is a directive line if, after trimming, it starts with `@token`. */
function leadingDirectives(line: string): { tokens: string[]; rest: string } | null {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith("@")) return null;
  // Consume a run of @tokens from the front; the remainder is inline body.
  const tokens: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    while (i < trimmed.length && (trimmed[i] === " " || trimmed[i] === "\t")) i++;
    if (trimmed[i] !== "@") break;
    i++; // skip @
    let start = i;
    while (i < trimmed.length && !/\s/.test(trimmed[i]!)) i++;
    const tok = trimmed.slice(start, i);
    if (tok.length === 0) return null; // a bare "@" is not a directive
    tokens.push(tok);
  }
  if (tokens.length === 0) return null;
  return { tokens, rest: trimmed.slice(i).trimStart() };
}

interface RawBlock {
  tokens: string[] | null; // null = no directive (default broadcast)
  body: string;
}

function splitIntoBlocks(text: string): RawBlock[] {
  const lines = text.split("\n");
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  for (const line of lines) {
    const dir = leadingDirectives(line);
    if (dir) {
      if (current) blocks.push(current);
      current = { tokens: dir.tokens, body: dir.rest };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      // Leading text before any directive — collect as a default block.
      current = { tokens: null, body: line };
    }
  }
  if (current) blocks.push(current);
  return blocks
    .map((b) => ({ ...b, body: b.body.trim() }))
    .filter((b) => b.body.length > 0 || b.tokens !== null);
}

function resolveScope(
  tokens: string[] | null,
  selfId: AgentDefinition["id"],
  peers: AgentDefinition[],
): MessageScope | { error: string } {
  if (tokens === null) return { type: "broadcast" };

  const lower = tokens.map((t) => t.toLowerCase());
  const hasAll = lower.includes("all");
  const hasSelf = lower.includes("self");
  const names = tokens.filter((t) => !RESERVED.has(t.toLowerCase()));

  if (hasAll && (hasSelf || names.length > 0)) {
    return { error: "@all cannot be combined with other recipients." };
  }
  if (hasSelf && (hasAll || names.length > 0)) {
    return { error: "@self cannot be combined with other recipients." };
  }
  if (hasAll) return { type: "broadcast" };
  if (hasSelf) return { type: "self" };

  const resolved: AgentDefinition["id"][] = [];
  for (const name of names) {
    const peer = findAgentByName(peers, name);
    if (!peer) {
      return {
        error: `Unknown or ambiguous recipient: "@${name}". Known participants: ${peers
          .map((p) => p.name)
          .join(", ")}.`,
      };
    }
    if (peer.id === selfId) continue;
    if (!resolved.includes(peer.id)) resolved.push(peer.id);
  }
  if (resolved.length === 0) {
    return { error: "No valid recipient other than yourself." };
  }
  if (resolved.length === 1) return { type: "direct", to: resolved[0]! };
  return { type: "multicast", to: resolved };
}

/**
 * Parse one agent turn into an ordered list of addressed messages.
 *
 * `selfId` is the speaking agent; `peers` are everyone it may address.
 * Each block becomes one ParsedMessage. Unresolvable blocks become errors that
 * the runtime surfaces back to the agent (as a private note) so it can correct.
 */
export function parseTurn(
  text: string,
  selfId: AgentDefinition["id"],
  peers: AgentDefinition[],
): ParsedMessage[] {
  const blocks = splitIntoBlocks(text);
  if (blocks.length === 0) return [];

  return blocks.map((block) => {
    const scope = resolveScope(block.tokens, selfId, peers);
    if ("error" in scope) return { ok: false, error: scope.error };
    return { ok: true, scope, content: block.body };
  });
}

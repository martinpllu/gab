import type {
  AgentDefinition,
  ChatDefinition,
  ChatMessage,
  Message,
} from "../types";
import { getAgent } from "./visibility";

/**
 * The framework-supplied core system prompt. Identical for every agent.
 * It explains the multi-agent setting and how the messaging tools work.
 */
const CORE_PROMPT = `You are participating in a multi-agent conversation. \
Several other AI agents are taking turns alongside you. Each agent has its \
own name, role, and instructions. You will only be able to see messages that \
were addressed to you, that you sent, or that were broadcast to the whole group.

When it is your turn, you address messages using @-directives. Begin a message \
with one of:
  @all          speak to the whole group (this is the default)
  @Name         send privately to one participant
  @Name @Other  send to a specific subset of participants
  @self         write a private note only you will see on later turns

The directive applies to the text that follows it, up to the next directive. To \
send several messages in one turn, use several directive lines, for example:

  @all I think we should start with the onboarding flow.
  @self Remember to circle back to pricing if Bob pushes on cost.

If you write text with no @-directive, it is sent to everyone as a broadcast. \
Address participants by the display names shown in the roster below.

Incoming messages are labelled with the sender's name and who could see them:
  [Alice → all]            a broadcast from Alice (everyone saw it)
  [Alice → you]            a private message Alice sent only to you
  [Alice → you, Bob]       a message Alice sent to you and Bob (and maybe others)
  [you → ...]              a message you previously sent
  [you ↻ self]             a private note you wrote to yourself

When you see [Alice → you], remember that other participants may not have seen \
what Alice told you — keep that context private unless you choose to share it.`;

/**
 * Build the full system prompt for one agent on one turn.
 *
 * Layers, in order:
 *  1. Core prompt (framework).
 *  2. Chat shared prompt (the rules of the room), if any.
 *  3. The agent's own system prompt (its persona / role).
 *  4. The roster of other participants.
 *
 * NOTE on caching: this string must stay byte-identical for a given agent
 * across turns so the per-agent prompt prefix is cache-stable. It depends only
 * on the spec (frozen for the duration of a run), not on the message log, so
 * it is stable by construction.
 */
export function buildSystemPrompt(
  agent: AgentDefinition,
  chat: ChatDefinition,
  allAgents: AgentDefinition[],
): string {
  const parts: string[] = [CORE_PROMPT];

  if (chat.sharedPrompt && chat.sharedPrompt.trim().length > 0) {
    parts.push(`# Shared context\n\n${chat.sharedPrompt.trim()}`);
  }

  parts.push(`# Your role\n\nYour name is ${agent.name}.\n\n${agent.systemPrompt.trim()}`);

  const peers = chat.participants
    .map((id) => getAgent(allAgents, id))
    .filter((p) => p.id !== agent.id);

  if (peers.length > 0) {
    const lines = peers.map((p) => {
      const desc = p.publicDescription?.trim();
      return desc ? `  • ${p.name} — ${desc}` : `  • ${p.name}`;
    });
    parts.push(`# Other participants\n\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
}

/**
 * Render one historical message as a single role-tagged chat message from the
 * viewer's perspective.
 *
 * This is the cache-stability-critical path. Each log entry becomes ITS OWN
 * ChatMessage (assistant for the viewer's own messages, user for everything
 * else), so the per-agent prefix grows append-only and byte-identically across
 * turns — the property OpenRouter prompt caching needs. Labels are rendered
 * from the names snapshotted onto the message at write time, never from the
 * live spec, so renaming an agent mid-run does not rewrite history.
 */
export function renderMessageForViewer(
  message: Message,
  viewerId: AgentDefinition["id"],
): ChatMessage {
  const isSelf = message.from === viewerId;
  const label = isSelf
    ? selfLabel(message)
    : incomingLabel(message, viewerId);
  return {
    role: isSelf ? "assistant" : "user",
    content: `${label}\n${message.content}`,
  };
}

function senderName(message: Message): string {
  if (message.from === "system" || message.from === "user" || message.from === "seed") {
    return message.from;
  }
  return message.fromNameSnapshot ?? message.from;
}

function selfLabel(message: Message): string {
  switch (message.scope.type) {
    case "self":
      return `[you ↻ self]`;
    case "broadcast":
      return `[you → all]`;
    case "direct":
      return `[you → ${message.toNamesSnapshot?.[0] ?? "?"}]`;
    case "multicast":
      return `[you → ${(message.toNamesSnapshot ?? []).join(", ")}]`;
  }
}

function incomingLabel(message: Message, viewerId: AgentDefinition["id"]): string {
  const name = senderName(message);
  switch (message.scope.type) {
    case "broadcast":
      return `[${name} → all]`;
    case "direct":
      return message.scope.to === viewerId
        ? `[${name} → you]`
        : `[${name} → ${message.toNamesSnapshot?.[0] ?? "?"}]`;
    case "multicast": {
      const names = message.scope.to.map((id, i) =>
        id === viewerId ? "you" : message.toNamesSnapshot?.[i] ?? "?",
      );
      return `[${name} → ${names.join(", ")}]`;
    }
    case "self":
      // Only an omnipotent viewer sees someone else's self-note.
      return `[${name} ↻ self]`;
  }
}

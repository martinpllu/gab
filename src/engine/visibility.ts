import type { AgentDefinition, AgentId, Message } from "../types";

/**
 * Returns true if `agent` can see `message`.
 *
 * Visibility rules:
 *  - Omnipotent agents see everything.
 *  - An agent always sees its own messages.
 *  - Broadcasts are seen by everyone.
 *  - Self-scoped messages are seen only by the sender.
 *  - Direct and multicast messages are seen by listed recipients.
 *  - System / seed / user messages are visible to everyone (no scope on those).
 */
export function canSee(agent: AgentDefinition, message: Message): boolean {
  if (agent.omnipotent) return true;
  if (message.from === agent.id) return true;

  // Synthetic senders have no MessageScope on them in practice — treat as broadcast.
  if (message.from === "system" || message.from === "seed" || message.from === "user") {
    return true;
  }

  switch (message.scope.type) {
    case "broadcast":
      return true;
    case "self":
      return message.from === agent.id;
    case "direct":
      return message.scope.to === agent.id;
    case "multicast":
      return message.scope.to.includes(agent.id);
  }
}

/** Filter a message log down to what `agent` can see, preserving order. */
export function visibleTo(agent: AgentDefinition, log: Message[]): Message[] {
  return log.filter((m) => canSee(agent, m));
}

/** Look up an agent by ID. Throws if not found — caller validated the spec. */
export function getAgent(agents: AgentDefinition[], id: AgentId): AgentDefinition {
  const a = agents.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown agent ID: ${id}`);
  return a;
}

/** Find an agent by display name. Case-insensitive. Returns null if not found / ambiguous. */
export function findAgentByName(
  agents: AgentDefinition[],
  name: string,
): AgentDefinition | null {
  const norm = name.trim().toLowerCase();
  const matches = agents.filter((a) => a.name.toLowerCase() === norm);
  return matches.length === 1 ? matches[0] : null;
}

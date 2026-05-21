import type { Agent, ChatMessage, Chat } from '../types';
import { GLOBAL_SYSTEM_PROMPT } from '../prompts';

export function buildMessagesForAgent(chat: Chat, agent: Agent): ChatMessage[] {
  const system =
    GLOBAL_SYSTEM_PROMPT +
    '\n\n--- Chat ---\n' +
    chat.chatPrompt +
    '\n\n--- Your persona ---\nYou are ' +
    agent.name +
    '. ' +
    agent.personaPrompt;

  const messages: ChatMessage[] = [{ role: 'system', content: system }];

  for (const m of chat.messages) {
    if (m.agentId === agent.id) {
      messages.push({ role: 'assistant', content: m.content });
    } else {
      messages.push({
        role: 'user',
        content: '[' + m.agentNameSnapshot + '] ' + m.content,
      });
    }
  }

  return messages;
}

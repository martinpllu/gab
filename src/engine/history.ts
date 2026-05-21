import type { Agent, ChatMessage, Scenario } from '../types';
import { GLOBAL_SYSTEM_PROMPT } from '../prompts';

export function buildMessagesForAgent(scenario: Scenario, agent: Agent): ChatMessage[] {
  const system =
    GLOBAL_SYSTEM_PROMPT +
    '\n\n--- Scenario ---\n' +
    scenario.scenarioPrompt +
    '\n\n--- Your persona ---\nYou are ' +
    agent.name +
    '. ' +
    agent.personaPrompt;

  const messages: ChatMessage[] = [{ role: 'system', content: system }];

  for (const u of scenario.utterances) {
    if (u.agentId === agent.id) {
      messages.push({ role: 'assistant', content: u.content });
    } else {
      messages.push({
        role: 'user',
        content: '[' + u.agentNameSnapshot + '] ' + u.content,
      });
    }
  }

  return messages;
}

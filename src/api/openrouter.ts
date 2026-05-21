import type { ChatMessage, Model } from '../types';
import { openRouterKey } from '../state/signals';

const URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`OpenRouter ${status}: ${body.slice(0, 200)}`);
    this.status = status;
    this.body = body;
  }
}

export interface ChatCompletionArgs {
  model: Model;
  messages: ChatMessage[];
  user: string;
  signal?: AbortSignal;
}

export async function chatCompletion(args: ChatCompletionArgs): Promise<string> {
  const key = openRouterKey.value;
  if (!key) throw new Error('Not authenticated');
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Gab',
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      user: args.user,
      stream: false,
    }),
    signal: args.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new OpenRouterError(res.status, text);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('OpenRouter response missing content');
  return content;
}

import type { ChatMessage, CompletionParams } from '../types';
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
  model: string;
  messages: ChatMessage[];
  user: string;
  params?: CompletionParams;
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  /** Assistant text content (verbatim, before any directive parsing). */
  content: string;
  /** Cost of this completion in USD, from OpenRouter's usage accounting. */
  cost?: number;
  /** Wall-clock time for the request, in milliseconds. */
  latencyMs: number;
}

export async function chatCompletion(args: ChatCompletionArgs): Promise<ChatCompletionResult> {
  const key = openRouterKey.value;
  if (!key) throw new Error('Not authenticated');

  const body: Record<string, unknown> = {
    model: args.model,
    messages: args.messages,
    user: args.user,
    stream: false,
    usage: { include: true },
    ...(args.params ?? {}),
  };

  const startedAt = performance.now();
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Gab',
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new OpenRouterError(res.status, text);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { cost?: number | null };
  };
  const latencyMs = Math.round(performance.now() - startedAt);
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('OpenRouter response missing message');
  const cost = data.usage?.cost;
  return {
    content: typeof message.content === 'string' ? message.content : '',
    cost: typeof cost === 'number' ? cost : undefined,
    latencyMs,
  };
}

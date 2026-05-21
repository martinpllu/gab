# Gab

A single-page sandbox for getting AI agents to gab to each other.

Define two or more agents — each with their own persona — drop them into a chat, and watch what emerges. Pure client-side SPA: your OpenRouter key, your chats, your messages all live in the browser.

## What you can do

- Create chats with a shared chat prompt that every agent sees
- Add as many agents as you like, each with their own persona prompt and (optionally) their own model
- Set the turn order by dragging, or randomize it per cycle
- Mark an agent as **after each** to make it react after every other agent's turn (think narrator, moderator, chorus)
- Run for a fixed number of turns or until you hit Stop
- Sign in with your OpenRouter account (PKCE OAuth) or paste an API key

## Stack

- Preact + Vite + TypeScript + [`@preact/signals`](https://github.com/preactjs/signals)
- No backend. State persists in `localStorage`.
- Browser talks directly to `https://openrouter.ai/api/v1/chat/completions`.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173.

OpenRouter accepts localhost callback URLs without pre-registration, so OAuth works out of the box in dev.

## Terminology

- **Chat** — the thing you create. Has a chat prompt, agents, settings, and a list of messages.
- **Message** — one thing an agent said. Stored in the chat's `messages` array.
- **Turn** — an opportunity for an agent to speak. The scheduler picks whose turn it is; the turn produces a message.

## How history is built

Each agent gets a **first-person view** of the chat:

- Its own messages appear as `role: assistant`
- Other agents' messages appear as `role: user`, prefixed with `[Name] ...`

The system message concatenates three layers in a fixed order:

1. `GLOBAL_SYSTEM_PROMPT` (in [`src/prompts.ts`](src/prompts.ts)) — explains the "agents gabbing to agents" framing
2. The chat prompt
3. The agent's persona prompt

Agent names are snapshotted into each message at write time, so renaming an agent later doesn't shift historical messages. Within a single agent's view, the prefix grows append-only and byte-identical — which is the property OpenRouter's prompt caching needs.

## Turn scheduling

Two partitions of the agent list:

- **Main agents** — `!afterEach`, ordered (drag to reorder, or shuffled per cycle if randomize is on)
- **After-each agents** — fire once after every main-agent turn, in declared order

A "block" is one main-agent turn followed by every after-each agent. For main=[A,B,C], afterEach=[R]:

```
A R B R C R A R B R C R …
```

See [`src/engine/scheduler.ts`](src/engine/scheduler.ts) for the exact algorithm.

## Models

Two are wired in:

- `google/gemini-3.1-flash-lite`
- `moonshotai/kimi-k2.6`

Each chat has a default model; each agent can override it. Edit [`src/types.ts`](src/types.ts) to add more.

## File layout

```
src/
├── main.tsx                    — entry; handles OAuth ?code= on boot
├── types.ts                    — Chat, Agent, Message, Model
├── prompts.ts                  — GLOBAL_SYSTEM_PROMPT
├── state/signals.ts            — module-scope signals + localStorage persistence
├── auth/pkce.ts                — OpenRouter PKCE OAuth
├── api/openrouter.ts           — chat completions client
├── engine/
│   ├── history.ts              — buildMessagesForAgent
│   └── scheduler.ts            — pickNextAgent, runLoop
└── components/                 — App, screens, widgets
```

## Caveats

- **Run cost**: indefinite runs are soft-capped at 50 turns. Watch your usage anyway.
- **Cache hit rate**: the message shape *enables* per-agent prompt caching, but actual hit rate depends on the provider's minimum-prefix-length threshold. Short chats may not cache.
- **No streaming**: turns are sequential. Add SSE if it feels slow.
- **Edits during a run** are disabled to keep history cache-stable.

---
name: open-app
description: Open the Gab app in the browser, already authenticated. Starts the Vite dev server if needed, then injects the OpenRouter API key from .env into localStorage so the login screen is bypassed. Use when asked to open, launch, view, or screenshot the Gab app, or to test it in the browser as an agent.
---

# Open the Gab app (authenticated)

Gab is a client-side Preact + Vite app. Its login screen offers two ways in:

- **Sign in with OpenRouter (OAuth)** — opens OpenRouter's auth flow and requires
  the human's account. **Not usable by an agent.**
- **Paste an API key** — the manual path. This skill uses it.

Auth state is driven entirely by two `localStorage` keys (see `src/state/signals.ts`):

- `gab.openrouter_key` — the API key string
- `gab.openrouter_via` — `"manual"` or `"oauth"`

When both are present, `authState` becomes `authed` and the login screen is skipped.
So rather than driving the textarea/button UI, set those keys directly and reload.

## Step 1 — Ensure the dev server is running on :5173

```sh
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```

If it returns `200`, the server is already up. Otherwise start `pnpm dev` (this project
uses pnpm — note `pnpm-lock.yaml`) with `run_in_background: true`, then poll the curl
above until it returns `200`.

## Step 2 — Read the API key from .env

```sh
grep -E '^OPENROUTER_API_KEY=' .env | cut -d= -f2-
```

The key is the `sk-or-...` value. `.env` is gitignored — never commit, echo in full,
or paste the key anywhere it could be logged or shared externally.

## Step 3 — Open and authenticate

Use whatever browser-automation tool you have available (e.g. the chrome-devtools MCP,
or another browser driver). The sequence is the same regardless of tool:

1. Navigate to `http://localhost:5173/`.
2. Set both `localStorage` keys on that origin. With a JS-eval capable tool, substitute
   the real key for `<KEY>`:

   ```js
   () => {
     localStorage.setItem('gab.openrouter_key', '<KEY>');
     localStorage.setItem('gab.openrouter_via', 'manual');
   }
   ```

   (Tools with a direct localStorage API can set the two keys without eval.)
3. Reload `http://localhost:5173/` so the app re-reads auth state on boot.
4. Confirm you're past login — see the check below. Take a snapshot/screenshot if useful.

## Notes

- If the key is rejected at runtime (401 from OpenRouter), the key in `.env` is stale —
  tell the human; don't try to work around it.
- To reset to a signed-out state, clear `gab.openrouter_key` and `gab.openrouter_via`
  from localStorage and reload.

## Troubleshooting

- **Authenticated check:** the authed app shows a "Sign out" button and a "Chats" heading.
  If you still see "Sign in with OpenRouter", either the keys aren't set on origin
  `http://localhost:5173`, or the snapshot raced the reload — wait for the "Chats" text to
  appear, then re-check.

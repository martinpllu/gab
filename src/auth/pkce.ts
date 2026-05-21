import { openRouterKey, openRouterVia, setVerifier, takeVerifier, route } from '../state/signals';

const AUTH_URL = 'https://openrouter.ai/auth';
const EXCHANGE_URL = 'https://openrouter.ai/api/v1/auth/keys';

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
}

export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64url(bytes);
  const challenge = base64url(await sha256(verifier));
  return { verifier, challenge };
}

export async function startLogin(): Promise<void> {
  const { verifier, challenge } = await generatePkcePair();
  setVerifier(verifier);
  const callback = window.location.origin + '/auth/callback';
  const url =
    AUTH_URL +
    '?callback_url=' +
    encodeURIComponent(callback) +
    '&code_challenge=' +
    encodeURIComponent(challenge) +
    '&code_challenge_method=S256';
  window.location.assign(url);
}

export async function handleCallback(code: string): Promise<void> {
  const verifier = takeVerifier();
  if (!verifier) throw new Error('Missing PKCE verifier; restart sign-in');
  const res = await fetch(EXCHANGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      code_challenge_method: 'S256',
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { key?: string };
  if (!data.key) throw new Error('Token exchange response missing "key"');
  openRouterKey.value = data.key;
  openRouterVia.value = 'oauth';
  route.value = 'list';
  history.replaceState(null, '', '/');
}

export function setManualKey(key: string) {
  openRouterKey.value = key.trim();
  openRouterVia.value = 'manual';
  route.value = 'list';
}

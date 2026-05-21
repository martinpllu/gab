import type { Route } from './types';

export function formatHash(route: Route): string {
  switch (route.kind) {
    case 'login': return '#/login';
    case 'list': return '#/chats';
    case 'runs': return `#/chats/${route.chatId}/runs`;
    case 'run': return `#/chats/${route.chatId}/runs/${route.runId}`;
  }
}

export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const path = raw.startsWith('/') ? raw.slice(1) : raw;
  if (path === '' || path === 'chats') return { kind: 'list' };
  if (path === 'login') return { kind: 'login' };

  const parts = path.split('/');
  if (parts[0] === 'chats' && parts[1]) {
    const chatId = parts[1];
    if (parts.length === 2) return { kind: 'runs', chatId };
    if (parts[2] === 'edit' && parts.length === 3) return { kind: 'runs', chatId };
    if (parts[2] === 'runs') {
      if (parts.length === 3) return { kind: 'runs', chatId };
      if (parts.length === 4 && parts[3]) {
        return { kind: 'run', chatId, runId: parts[3] };
      }
    }
  }
  return { kind: 'list' };
}

export function navigate(route: Route, opts?: { replace?: boolean }) {
  const target = formatHash(route);
  if (location.hash === target) return;
  if (opts?.replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = target;
  }
}

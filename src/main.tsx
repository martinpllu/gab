import { render } from 'preact';
import { App } from './components/App';
import { authState, route } from './state/signals';
import { handleCallback } from './auth/pkce';

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    try {
      await handleCallback(code);
    } catch (e) {
      console.error('OAuth callback failed:', e);
      alert('Sign-in failed: ' + (e instanceof Error ? e.message : String(e)));
      history.replaceState(null, '', '/');
    }
  } else if (authState.value.kind === 'authed' && route.value === 'login') {
    route.value = 'list';
  }
  render(<App />, document.getElementById('app')!);
}

boot();

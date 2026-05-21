import { useState } from 'preact/hooks';
import { startLogin, setManualKey } from '../auth/pkce';

export function LoginScreen() {
  const [showManual, setShowManual] = useState(false);
  const [manualKey, setManualKeyValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    setError(null);
    try {
      await startLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onSaveManual() {
    if (!manualKey.trim()) return;
    setManualKey(manualKey);
  }

  return (
    <div class="screen login">
      <h1>Gab</h1>
      <p class="subtitle">Watch AI agents talk to each other.</p>
      <button class="primary big" onClick={onSignIn}>
        Sign in with OpenRouter
      </button>
      {error && <div class="error">{error}</div>}
      <button class="link" onClick={() => setShowManual((v) => !v)}>
        {showManual ? 'Hide' : 'Or paste an API key'}
      </button>
      {showManual && (
        <div class="manual-key">
          <textarea
            placeholder="sk-or-..."
            value={manualKey}
            onInput={(e) => setManualKeyValue((e.target as HTMLTextAreaElement).value)}
            rows={2}
          />
          <button class="primary" onClick={onSaveManual} disabled={!manualKey.trim()}>
            Save key
          </button>
        </div>
      )}
    </div>
  );
}

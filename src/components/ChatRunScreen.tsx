import { useState } from 'preact/hooks';
import { currentChat, route, runState, clearMessages } from '../state/signals';
import { runLoop, requestStop } from '../engine/scheduler';
import { Transcript } from './widgets';

export function ChatRunScreen() {
  const c = currentChat.value;
  const [error, setError] = useState<string | null>(null);
  if (!c) {
    route.value = 'list';
    return null;
  }
  const canRun =
    runState.value === 'idle' &&
    c.agents.filter((a) => !a.afterEach).length > 0;

  async function onRun() {
    setError(null);
    try {
      await runLoop(c!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div class="screen run">
      <header class="topbar">
        <button class="link" onClick={() => (route.value = 'edit')}>← Edit</button>
        <h2>{c.name}</h2>
        <div class="spacer" />
        <span class="turn-counter">{c.messages.length} messages</span>
        {runState.value === 'idle' ? (
          <button class="primary" onClick={onRun} disabled={!canRun}>
            ▶ Run
          </button>
        ) : (
          <button class="danger" onClick={requestStop} disabled={runState.value === 'stopping'}>
            {runState.value === 'stopping' ? 'Stopping…' : '■ Stop'}
          </button>
        )}
        <button
          onClick={() => {
            if (confirm('Clear all messages?')) clearMessages(c.id);
          }}
          disabled={runState.value !== 'idle'}
        >
          Clear
        </button>
      </header>

      {!canRun && runState.value === 'idle' && (
        <div class="hint">Add at least one main-order agent to run.</div>
      )}
      {error && <div class="error">{error}</div>}
      <Transcript chat={c} agents={c.agents} />
    </div>
  );
}

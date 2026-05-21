import { useState } from 'preact/hooks';
import { currentScenario, route, runState, clearUtterances } from '../state/signals';
import { runLoop, requestStop } from '../engine/scheduler';
import { Transcript } from './widgets';

export function ScenarioRunScreen() {
  const s = currentScenario.value;
  const [error, setError] = useState<string | null>(null);
  if (!s) {
    route.value = 'list';
    return null;
  }
  const canRun =
    runState.value === 'idle' &&
    s.agents.filter((a) => !a.afterEach).length > 0;

  async function onRun() {
    setError(null);
    try {
      await runLoop(s!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div class="screen run">
      <header class="topbar">
        <button class="link" onClick={() => (route.value = 'edit')}>← Edit</button>
        <h2>{s.name}</h2>
        <div class="spacer" />
        <span class="turn-counter">{s.utterances.length} utterances</span>
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
            if (confirm('Clear all utterances?')) clearUtterances(s.id);
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
      <Transcript scenario={s} agents={s.agents} />
    </div>
  );
}

import { useState } from 'preact/hooks';
import {
  currentRun,
  currentChat,
  runState,
  clearRunMessages,
  deleteRun,
} from '../state/signals';
import { runLoop, requestStop } from '../engine/scheduler';
import { Transcript, ConfirmButton, Breadcrumbs, formatDateTime } from './widgets';
import { fingerprintDefinition } from '../engine/fingerprint';
import { navigate } from '../router';
import { MODEL_LABELS } from '../types';
import type { Run } from '../types';

export function ChatRunScreen() {
  const r = currentRun.value;
  const c = currentChat.value;
  const [error, setError] = useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [turns, setTurns] = useState<string>(
    r?.chatSnapshot.turnsRequested != null
      ? String(r.chatSnapshot.turnsRequested)
      : '',
  );
  if (!r) {
    if (c) navigate({ kind: 'runs', chatId: c.id }, { replace: true });
    else navigate({ kind: 'list' }, { replace: true });
    return null;
  }
  const def = r.chatSnapshot;
  const parsedTurns = turns === '' ? null : Number(turns);
  const turnsValid =
    parsedTurns === null || (Number.isFinite(parsedTurns) && parsedTurns >= 1);
  const canRun =
    runState.value === 'idle' &&
    def.agents.filter((a) => !a.afterEach).length > 0 &&
    turnsValid;

  const liveFingerprint = c ? fingerprintDefinition(c) : null;
  const drift = liveFingerprint != null && liveFingerprint !== r.fingerprint;

  async function onRun() {
    setError(null);
    try {
      await runLoop(r!.id, parsedTurns);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const runLabel = formatRunLabel(r.createdAt);

  return (
    <div class="screen run">
      <header class="page-header">
        <div class="page-header-top">
          <Breadcrumbs
            items={[
              { label: 'Chats', route: { kind: 'list' } },
              { label: def.name, route: { kind: 'runs', chatId: r.chatId } },
              { label: runLabel, title: new Date(r.createdAt).toISOString() },
            ]}
          />
          <button
            class="fingerprint"
            title={drift ? 'Snapshot differs from current chat definition' : 'Chat definition fingerprint'}
            onClick={() => setSnapshotOpen((v) => !v)}
          >
            {r.fingerprint}
            {drift ? ' *' : ''}
          </button>
        </div>
        <div class="page-header-actions">
          <span class="turn-counter">{r.messages.length} messages</span>
          <div class="spacer" />
          <ConfirmButton
            label="Clear"
            confirmLabel="Click again to clear"
            disabled={runState.value !== 'idle'}
            onConfirm={() => clearRunMessages(r.id)}
          />
          {runState.value === 'idle' ? (
            <>
              <input
                class="turns-input"
                type="number"
                min={1}
                placeholder="∞"
                title="Turns to run (one-shot; doesn't change the snapshot)"
                value={turns}
                onInput={(e) => setTurns((e.target as HTMLInputElement).value)}
              />
              <button class="primary" onClick={onRun} disabled={!canRun}>
                ▶ Run
              </button>
            </>
          ) : (
            <button class="danger" onClick={requestStop} disabled={runState.value === 'stopping'}>
              {runState.value === 'stopping' ? 'Stopping…' : '■ Stop'}
            </button>
          )}
        </div>
      </header>

      {snapshotOpen && <SnapshotPanel run={r} />}

      {!canRun && runState.value === 'idle' && def.agents.filter((a) => !a.afterEach).length === 0 && (
        <div class="hint">This snapshot has no main-order agents.</div>
      )}
      {error && <div class="error">{error}</div>}
      <Transcript messages={r.messages} agents={def.agents} />

      <div class="danger-zone">
        <ConfirmButton
          label="Delete run"
          confirmLabel="Click again to delete run"
          disabled={runState.value !== 'idle'}
          onConfirm={() => deleteRun(r.id)}
        />
      </div>
    </div>
  );
}

function formatRunLabel(iso: string): string {
  return `Run · ${formatDateTime(iso)}`;
}

function SnapshotPanel(props: { run: Run }) {
  const r = props.run;
  const def = r.chatSnapshot;
  return (
    <div class="snapshot-panel">
      <div class="snapshot-row">
        <strong>Fingerprint:</strong> <code>{r.fingerprint}</code>
      </div>
      <div class="snapshot-row">
        <strong>Default model:</strong> {MODEL_LABELS[def.defaultModel] ?? def.defaultModel}
      </div>
      <div class="snapshot-row">
        <strong>Turns requested:</strong> {def.turnsRequested ?? '∞'}
      </div>
      <div class="snapshot-row">
        <strong>Randomize order:</strong> {def.randomize ? 'yes' : 'no'}
      </div>
      {def.chatPrompt && (
        <div class="snapshot-row">
          <strong>Chat prompt:</strong>
          <pre class="snapshot-prompt">{def.chatPrompt}</pre>
        </div>
      )}
      <div class="snapshot-row">
        <strong>Agents:</strong>
        <ul class="snapshot-agents">
          {def.agents.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong>
              {a.afterEach ? ' (after each)' : ` (order ${a.order})`}
              {a.model ? ` · ${MODEL_LABELS[a.model] ?? a.model}` : ''}
              {a.personaPrompt && <pre class="snapshot-prompt">{a.personaPrompt}</pre>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

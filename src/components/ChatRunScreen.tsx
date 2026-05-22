import { useState } from 'preact/hooks';
import {
  currentRun,
  currentChat,
  runState,
  activeAgent,
  clearRunMessages,
  deleteRun,
} from '../state/signals';
import { startRun, continueRun, requestStop } from '../engine/run-controller';
import { Transcript, ConfirmButton, Breadcrumbs, formatDateTime } from './widgets';
import { fingerprintDefinition } from '../engine/fingerprint';
import { navigate } from '../router';
import { MODEL_LABELS } from '../types';
import type { Run } from '../types';

export function ChatRunScreen() {
  const r = currentRun.value;
  const c = currentChat.value;
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!r) {
    if (c) navigate({ kind: 'runs', chatId: c.id }, { replace: true });
    else navigate({ kind: 'list' }, { replace: true });
    return null;
  }
  const spec = r.specSnapshot;
  const needsUserKickoff = spec.chat.kickoff.type === 'user';

  const liveFingerprint = c ? fingerprintDefinition(c.spec) : null;
  const drift = liveFingerprint != null && liveFingerprint !== r.fingerprint;

  const runLabel = `Run · ${formatDateTime(r.createdAt)}`;
  const idle = runState.value === 'idle';
  const canRun = idle && spec.chat.participants.length > 0;
  const canContinue = canRun && r.messages.length > 0;

  async function onRun() {
    setError(null);
    let initialUserMessage: string | undefined;
    if (needsUserKickoff) {
      const entered = window.prompt('This chat opens with a user message. What should it say?');
      if (entered == null) return;
      initialUserMessage = entered;
    }
    try {
      await startRun(r!, { initialUserMessage });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onContinue() {
    setError(null);
    try {
      await continueRun(r!);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div class="screen run">
      <header class="page-header">
        <div class="page-header-top">
          <Breadcrumbs
            items={[
              { label: 'Chats', route: { kind: 'list' } },
              { label: spec.metadata.title, route: { kind: 'runs', chatId: r.chatId } },
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
              <button
                class="secondary"
                onClick={onContinue}
                disabled={!canContinue}
                title={
                  canContinue
                    ? 'Resume this run from where it stopped'
                    : 'Nothing to continue yet — start a run first'
                }
              >
                ⊕ Continue
              </button>
              <button class="primary" onClick={onRun} disabled={!canRun}>
                ▶ Run
              </button>
            </>
          ) : (
            <button
              class="danger"
              onClick={requestStop}
              disabled={runState.value === 'stopping'}
            >
              {runState.value === 'stopping' ? 'Stopping…' : '■ Stop'}
            </button>
          )}
        </div>
      </header>

      {snapshotOpen && <SnapshotPanel run={r} />}
      {error && <div class="error">{error}</div>}
      {r.reason && <div class="hint">Stopped: {r.reason}</div>}

      <Transcript messages={r.messages} agents={spec.agents} activeAgent={activeAgent.value} />

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

function SnapshotPanel(props: { run: Run }) {
  const r = props.run;
  const spec = r.specSnapshot;
  return (
    <div class="snapshot-panel">
      <div class="snapshot-row">
        <strong>Fingerprint:</strong> <code>{r.fingerprint}</code>
      </div>
      <div class="snapshot-row">
        <strong>Policy:</strong> {spec.flow.main.policy.type}
      </div>
      <div class="snapshot-row">
        <strong>Kickoff:</strong> {spec.chat.kickoff.type}
      </div>
      {spec.chat.sharedPrompt && (
        <div class="snapshot-row">
          <strong>Shared prompt:</strong>
          <pre class="snapshot-prompt">{spec.chat.sharedPrompt}</pre>
        </div>
      )}
      <div class="snapshot-row">
        <strong>Agents:</strong>
        <ul class="snapshot-agents">
          {spec.agents.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong>
              {` · ${MODEL_LABELS[a.model] ?? a.model}`}
              {a.systemPrompt && <pre class="snapshot-prompt">{a.systemPrompt}</pre>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

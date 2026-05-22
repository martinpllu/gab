import { useState, useEffect } from 'preact/hooks';
import {
  currentChat,
  runsForCurrentChat,
  createRun,
  updateSpec,
  deleteChat,
  runState,
  pendingExpandDefFor,
} from '../state/signals';
import { fingerprintDefinition } from '../engine/fingerprint';
import { ConfirmButton, Breadcrumbs, formatDateTime } from './widgets';
import { AgentsView } from './editor/AgentsView';
import { ChatView } from './editor/ChatView';
import { FlowView } from './editor/FlowView';
import { navigate } from '../router';

type Tab = 'agents' | 'chat' | 'flow' | 'runs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'agents', label: 'Agents' },
  { id: 'chat', label: 'Chat' },
  { id: 'flow', label: 'Flow' },
  { id: 'runs', label: 'Runs' },
];

export function RunsListScreen() {
  const c = currentChat.value;
  // New chats land on Agents (you have nothing to run yet); existing on Runs.
  const [tab, setTab] = useState<Tab>(
    c && pendingExpandDefFor.value === c.id ? 'agents' : 'runs',
  );
  useEffect(() => {
    if (c && pendingExpandDefFor.value === c.id) {
      pendingExpandDefFor.value = null;
    }
  }, [c?.id]);

  if (!c) {
    navigate({ kind: 'list' }, { replace: true });
    return null;
  }

  const currentFingerprint = fingerprintDefinition(c.spec);
  const disabled = runState.value !== 'idle';
  const runCount = runsForCurrentChat.value.length;

  function onNewRun() {
    const r = createRun(c!.id);
    navigate({ kind: 'run', chatId: c!.id, runId: r.id });
  }

  return (
    <div class="screen list">
      <header class="page-header">
        <div class="page-header-top">
          <Breadcrumbs
            items={[
              { label: 'Chats', route: { kind: 'list' } },
              { label: c.spec.metadata.title },
            ]}
          />
          <span class="fingerprint" title="Current chat definition fingerprint">
            {currentFingerprint}
          </span>
        </div>
        <div class="page-header-actions">
          <input
            class="title-input"
            type="text"
            value={c.spec.metadata.title}
            disabled={disabled}
            placeholder="Untitled chat"
            onInput={(e) =>
              updateSpec(c.id, (s) => ({
                ...s,
                metadata: { ...s.metadata, title: (e.target as HTMLInputElement).value },
              }))
            }
          />
          <div class="spacer" />
          <button class="primary" onClick={onNewRun} disabled={c.spec.agents.length === 0}>
            New run
          </button>
        </div>
      </header>

      <div class="tabstrip" role="tablist">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            class={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'agents' && c.spec.agents.length > 0 && (
              <span class="tab-count">{c.spec.agents.length}</span>
            )}
            {t.id === 'runs' && runCount > 0 && <span class="tab-count">{runCount}</span>}
          </button>
        ))}
      </div>

      <div class="tab-panel">
        {tab === 'agents' && <AgentsView chatId={c.id} spec={c.spec} disabled={disabled} />}
        {tab === 'chat' && <ChatView chatId={c.id} spec={c.spec} disabled={disabled} />}
        {tab === 'flow' && <FlowView chatId={c.id} spec={c.spec} disabled={disabled} />}
        {tab === 'runs' && (
          <RunsTab chatId={c.id} currentFingerprint={currentFingerprint} />
        )}
      </div>

      <div class="danger-zone">
        <ConfirmButton
          disabled={disabled}
          label="Delete chat"
          confirmLabel="Click again to delete chat"
          onConfirm={() => deleteChat(c.id)}
        />
      </div>
    </div>
  );
}

function RunsTab(props: { chatId: string; currentFingerprint: string }) {
  const list = runsForCurrentChat.value;
  return (
    <div class="chat-list">
      {list.length === 0 && (
        <div class="hint">No runs yet. Click "New run" to snapshot the current definition and start one.</div>
      )}
      {list.map((r) => {
        const drift = r.fingerprint !== props.currentFingerprint;
        return (
          <button
            type="button"
            class="chat-row chat-row-button"
            key={r.id}
            onClick={() => navigate({ kind: 'run', chatId: props.chatId, runId: r.id })}
          >
            <div class="chat-main">
              <div class="chat-name">
                Run · {formatDateTime(r.createdAt)}
                {' '}
                <span
                  class="fingerprint"
                  title={drift ? 'Snapshot differs from current chat definition' : 'Matches current chat definition'}
                >
                  {r.fingerprint}
                  {drift ? ' *' : ''}
                </span>
              </div>
              <div class="chat-meta">
                {r.messages.length} message{r.messages.length === 1 ? '' : 's'} ·
                {' '}{r.specSnapshot.agents.length} agent{r.specSnapshot.agents.length === 1 ? '' : 's'} ·
                {' '}updated {formatDateTime(r.updatedAt)}
              </div>
            </div>
            <span class="chat-row-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}

import { useState, useEffect } from 'preact/hooks';
import {
  currentChat,
  runsForCurrentChat,
  createRun,
  updateChat,
  deleteChat,
  addAgent,
  runState,
  pendingExpandDefFor,
} from '../state/signals';
import { fingerprintDefinition } from '../engine/fingerprint';
import { ModelPicker, TurnOrderList, ConfirmButton, Breadcrumbs, formatDateTime } from './widgets';
import { navigate } from '../router';
import type { Model } from '../types';

export function RunsListScreen() {
  const c = currentChat.value;
  if (!c) {
    navigate({ kind: 'list' }, { replace: true });
    return null;
  }
  const initialExpand = pendingExpandDefFor.value === c.id;
  const [defOpen, setDefOpen] = useState(initialExpand);
  useEffect(() => {
    if (pendingExpandDefFor.value === c.id) {
      pendingExpandDefFor.value = null;
    }
  }, [c.id]);

  const list = runsForCurrentChat.value;
  const currentFingerprint = fingerprintDefinition(c);
  const disabled = runState.value !== 'idle';
  const turnsValue = c.turnsRequested ?? '';

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
              { label: c.name },
            ]}
          />
          <span class="fingerprint" title="Current chat definition fingerprint">
            {currentFingerprint}
          </span>
        </div>
        <div class="page-header-actions">
          <div class="spacer" />
          <button class="primary" onClick={onNewRun}>New run</button>
        </div>
      </header>

      <section class="chat-def">
        <button
          type="button"
          class="chat-def-header"
          aria-expanded={defOpen}
          onClick={() => setDefOpen((v) => !v)}
        >
          <span class={`chevron ${defOpen ? 'open' : ''}`}>▸</span>
          <span>Chat definition</span>
          <span class="chat-def-summary">
            {c.agents.length} agent{c.agents.length === 1 ? '' : 's'} ·
            {' '}default {c.defaultModel}
          </span>
        </button>
        {defOpen && (
          <div class="chat-def-body">
            <div class="field">
              <label>Name</label>
              <input
                type="text"
                value={c.name}
                disabled={disabled}
                onInput={(e) =>
                  updateChat(c.id, { name: (e.target as HTMLInputElement).value })
                }
              />
            </div>

            <div class="field">
              <label>Chat prompt</label>
              <textarea
                rows={4}
                placeholder="Describe the setting and what the agents are doing — shared across all agents in this chat."
                value={c.chatPrompt}
                disabled={disabled}
                onInput={(e) =>
                  updateChat(c.id, {
                    chatPrompt: (e.target as HTMLTextAreaElement).value,
                  })
                }
              />
            </div>

            <div class="row">
              <div class="field">
                <label>Default model</label>
                <ModelPicker
                  value={c.defaultModel}
                  disabled={disabled}
                  onChange={(m: Model) => updateChat(c.id, { defaultModel: m })}
                />
              </div>
              <div class="field">
                <label>Turns to run</label>
                <input
                  type="number"
                  min={1}
                  placeholder="∞"
                  value={turnsValue as number | ''}
                  disabled={disabled}
                  onInput={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    updateChat(c.id, { turnsRequested: v === '' ? null : Number(v) });
                  }}
                />
              </div>
              <label class="checkbox">
                <input
                  type="checkbox"
                  checked={c.randomize}
                  disabled={disabled}
                  onChange={(e) =>
                    updateChat(c.id, {
                      randomize: (e.target as HTMLInputElement).checked,
                    })
                  }
                />
                Randomize main order
              </label>
            </div>

            <h3>Agents</h3>
            <TurnOrderList chat={c} disabled={disabled} />
            <div class="row chat-def-actions">
              <button class="primary" disabled={disabled} onClick={() => addAgent(c.id)}>
                + Add agent
              </button>
              <div class="spacer" />
              <ConfirmButton
                disabled={disabled}
                label="Delete chat"
                confirmLabel="Click again to delete chat"
                onConfirm={() => deleteChat(c.id)}
              />
            </div>
          </div>
        )}
      </section>

      <div class="chat-list">
        {list.length === 0 && (
          <div class="hint">No runs yet. Click "New run" to start one.</div>
        )}
        {list.map((r) => {
          const drift = r.fingerprint !== currentFingerprint;
          return (
            <button
              type="button"
              class="chat-row chat-row-button"
              key={r.id}
              onClick={() => navigate({ kind: 'run', chatId: c!.id, runId: r.id })}
            >
              <div class="chat-main">
                <div class="chat-name">
                  Run · {formatDateTime(r.createdAt)}
                  {' '}
                  <span class="fingerprint" title={drift ? 'Snapshot differs from current chat definition' : 'Matches current chat definition'}>
                    {r.fingerprint}
                    {drift ? ' *' : ''}
                  </span>
                </div>
                <div class="chat-meta">
                  {r.messages.length} message{r.messages.length === 1 ? '' : 's'} ·
                  {' '}{r.chatSnapshot.agents.length} agent{r.chatSnapshot.agents.length === 1 ? '' : 's'} ·
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
    </div>
  );
}

import {
  currentChat,
  runsForCurrentChat,
  createRun,
  deleteRun,
} from '../state/signals';
import { fingerprintDefinition } from '../engine/fingerprint';
import { navigate } from '../router';

export function RunsListScreen() {
  const c = currentChat.value;
  if (!c) {
    navigate({ kind: 'list' }, { replace: true });
    return null;
  }
  const list = runsForCurrentChat.value;
  const currentFingerprint = fingerprintDefinition(c);

  function onNewRun() {
    const r = createRun(c!.id);
    navigate({ kind: 'run', chatId: c!.id, runId: r.id });
  }

  function onOpen(id: string) {
    navigate({ kind: 'run', chatId: c!.id, runId: id });
  }

  return (
    <div class="screen list">
      <header class="topbar">
        <button class="link" onClick={() => navigate({ kind: 'list' })}>← Chats</button>
        <h2>{c.name}</h2>
        <span class="fingerprint" title="Current chat definition fingerprint">
          {currentFingerprint}
        </span>
        <div class="spacer" />
        <button onClick={() => navigate({ kind: 'edit', chatId: c.id })}>Edit chat</button>
        <button class="primary" onClick={onNewRun}>New run</button>
      </header>
      <div class="chat-list">
        {list.length === 0 && (
          <div class="hint">No runs yet. Click "New run" to start one.</div>
        )}
        {list.map((r) => {
          const drift = r.fingerprint !== currentFingerprint;
          return (
            <div class="chat-row" key={r.id}>
              <div class="chat-main">
                <div class="chat-name">
                  Run {new Date(r.createdAt).toLocaleString()}
                  {' '}
                  <span class="fingerprint" title={drift ? 'Snapshot differs from current chat definition' : 'Matches current chat definition'}>
                    {r.fingerprint}
                    {drift ? ' *' : ''}
                  </span>
                </div>
                <div class="chat-meta">
                  {r.messages.length} message{r.messages.length === 1 ? '' : 's'} ·
                  {' '}{r.chatSnapshot.agents.length} agent{r.chatSnapshot.agents.length === 1 ? '' : 's'} ·
                  {' '}updated {new Date(r.updatedAt).toLocaleString()}
                </div>
              </div>
              <div class="row">
                <button class="primary" onClick={() => onOpen(r.id)}>Open</button>
                <button
                  class="danger"
                  onClick={() => {
                    if (confirm('Delete this run?')) deleteRun(r.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { chats, runs, createChat, deleteChat, signOut } from '../state/signals';
import { navigate } from '../router';

export function ChatListScreen() {
  function onNew() {
    const c = createChat();
    navigate({ kind: 'edit', chatId: c.id });
  }

  function onEdit(id: string) {
    navigate({ kind: 'edit', chatId: id });
  }

  function onRuns(id: string) {
    navigate({ kind: 'runs', chatId: id });
  }

  return (
    <div class="screen list">
      <header class="topbar">
        <h2>Chats</h2>
        <div class="spacer" />
        <button class="primary" onClick={onNew}>New chat</button>
        <button class="link" onClick={signOut}>Sign out</button>
      </header>
      <div class="chat-list">
        {chats.value.length === 0 && (
          <div class="hint">No chats yet. Click "New chat" to make one.</div>
        )}
        {chats.value.map((c) => {
          const runCount = runs.value.filter((r) => r.chatId === c.id).length;
          return (
            <div class="chat-row" key={c.id}>
              <div class="chat-main">
                <div class="chat-name">{c.name}</div>
                <div class="chat-meta">
                  {c.agents.length} agent{c.agents.length === 1 ? '' : 's'} ·
                  {' '}{runCount} run{runCount === 1 ? '' : 's'} ·
                  {' '}updated {new Date(c.updatedAt).toLocaleString()}
                </div>
              </div>
              <div class="row">
                <button onClick={() => onEdit(c.id)}>Edit</button>
                <button class="primary" onClick={() => onRuns(c.id)}>Runs</button>
                <button
                  class="danger"
                  onClick={() => {
                    const msg =
                      runCount > 0
                        ? `Delete "${c.name}" and its ${runCount} run${runCount === 1 ? '' : 's'}?`
                        : `Delete "${c.name}"?`;
                    if (confirm(msg)) deleteChat(c.id);
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

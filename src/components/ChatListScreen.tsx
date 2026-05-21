import { chats, currentChatId, route, createChat, deleteChat, signOut } from '../state/signals';

export function ChatListScreen() {
  function onNew() {
    const c = createChat();
    currentChatId.value = c.id;
    route.value = 'edit';
  }

  function onEdit(id: string) {
    currentChatId.value = id;
    route.value = 'edit';
  }

  function onRun(id: string) {
    currentChatId.value = id;
    route.value = 'run';
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
        {chats.value.map((c) => (
          <div class="chat-row" key={c.id}>
            <div class="chat-main">
              <div class="chat-name">{c.name}</div>
              <div class="chat-meta">
                {c.agents.length} agent{c.agents.length === 1 ? '' : 's'} ·
                {' '}{c.messages.length} message{c.messages.length === 1 ? '' : 's'} ·
                {' '}updated {new Date(c.updatedAt).toLocaleString()}
              </div>
            </div>
            <div class="row">
              <button onClick={() => onEdit(c.id)}>Edit</button>
              <button class="primary" onClick={() => onRun(c.id)}>Run</button>
              <button
                class="danger"
                onClick={() => {
                  if (confirm(`Delete "${c.name}"?`)) deleteChat(c.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

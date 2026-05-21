import { chats, runs, createChat, signOut, pendingExpandDefFor } from '../state/signals';
import { navigate } from '../router';

export function ChatListScreen() {
  function onNew() {
    const c = createChat();
    pendingExpandDefFor.value = c.id;
    navigate({ kind: 'runs', chatId: c.id });
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
            <button
              type="button"
              class="chat-row chat-row-button"
              key={c.id}
              onClick={() => navigate({ kind: 'runs', chatId: c.id })}
            >
              <div class="chat-main">
                <div class="chat-name">{c.name}</div>
                <div class="chat-meta">
                  {c.agents.length} agent{c.agents.length === 1 ? '' : 's'} ·
                  {' '}{runCount} run{runCount === 1 ? '' : 's'} ·
                  {' '}updated {new Date(c.updatedAt).toLocaleString()}
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

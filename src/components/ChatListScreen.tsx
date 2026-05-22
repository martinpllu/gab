import { useState } from 'preact/hooks';
import { chats, runs, createChat, createChatFromSpec, signOut, pendingExpandDefFor } from '../state/signals';
import { navigate } from '../router';
import { formatDateTime } from './widgets';
import { chatCost, totalCost, formatCost } from '../cost';
import type { ChatSpec } from '../types';
import { roundRobin, interleaved, agentSelected, negotiation, wordAssociation } from '../spec/examples';

const EXAMPLES: { spec: ChatSpec; blurb: string }[] = [
  { spec: wordAssociation, blurb: 'Two players swap single-word replies — a minimal testbed.' },
  { spec: roundRobin, blurb: 'Three contributors take turns broadcasting to all.' },
  { spec: interleaved, blurb: 'A moderator alternates turns with three debaters.' },
  { spec: agentSelected, blurb: 'A coordinator picks the next expert each turn.' },
  { spec: negotiation, blurb: 'Private channels, scratchpads, and an omnipotent observer.' },
];

export function ChatListScreen() {
  const [menuOpen, setMenuOpen] = useState(false);

  function onNew() {
    const c = createChat();
    pendingExpandDefFor.value = c.id;
    navigate({ kind: 'runs', chatId: c.id });
  }

  function onLoadExample(spec: ChatSpec) {
    const c = createChatFromSpec(spec);
    setMenuOpen(false);
    navigate({ kind: 'runs', chatId: c.id });
  }

  return (
    <div class="screen list">
      <header class="page-header">
        <div class="page-header-top">
          <h2>Chats</h2>
          {formatCost(totalCost(runs.value)) && (
            <span class="total-cost" title="Total cost across all chats and runs">
              {formatCost(totalCost(runs.value))} total
            </span>
          )}
        </div>
        <div class="page-header-actions">
          <div class="spacer" />
          <button class="link" onClick={signOut}>Sign out</button>
          <div class="menu-wrap">
            <button onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
              Load example ▾
            </button>
            {menuOpen && (
              <>
                <div class="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div class="menu">
                  {EXAMPLES.map(({ spec, blurb }) => (
                    <button
                      type="button"
                      class="menu-item"
                      key={spec.metadata.id}
                      onClick={() => onLoadExample(spec)}
                    >
                      <span class="menu-item-title">{spec.metadata.title}</span>
                      <span class="menu-item-blurb">{blurb}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button class="primary" onClick={onNew}>New chat</button>
        </div>
      </header>
      <div class="chat-list">
        {chats.value.length === 0 && (
          <div class="hint">No chats yet. Make one, or load an example to see the engine run.</div>
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
                <div class="chat-name">{c.spec.metadata.title}</div>
                <div class="chat-meta">
                  {c.spec.agents.length} agent{c.spec.agents.length === 1 ? '' : 's'} ·
                  {' '}{runCount} run{runCount === 1 ? '' : 's'} ·
                  {formatCost(chatCost(c.id, runs.value)) && (
                    <>{' '}{formatCost(chatCost(c.id, runs.value))} ·</>
                  )}
                  {' '}updated {formatDateTime(c.updatedAt)}
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

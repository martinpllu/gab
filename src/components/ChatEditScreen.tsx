import { currentChat, updateChat, addAgent, runState } from '../state/signals';
import { ModelPicker, TurnOrderList } from './widgets';
import { navigate } from '../router';
import type { Model } from '../types';

export function ChatEditScreen() {
  const c = currentChat.value;
  if (!c) {
    navigate({ kind: 'list' }, { replace: true });
    return null;
  }
  const disabled = runState.value !== 'idle';
  const turnsValue = c.turnsRequested ?? '';

  return (
    <div class="screen edit">
      <header class="topbar">
        <button class="link" onClick={() => navigate({ kind: 'list' })}>← Back</button>
        <h2>Edit chat</h2>
        <div class="spacer" />
        <button class="primary" onClick={() => navigate({ kind: 'runs', chatId: c.id })}>Runs →</button>
      </header>

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
      <button class="primary" disabled={disabled} onClick={() => addAgent(c.id)}>
        + Add agent
      </button>
    </div>
  );
}

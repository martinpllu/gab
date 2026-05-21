import { useEffect, useRef, useState } from 'preact/hooks';
import type { Agent, Model, Chat, Message } from '../types';
import { MODELS, MODEL_LABELS } from '../types';
import { reorderMainAgents, updateAgent, deleteAgent } from '../state/signals';

export function ModelPicker(props: {
  value: Model;
  onChange: (m: Model) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange((e.target as HTMLSelectElement).value as Model)}
    >
      {MODELS.map((m) => (
        <option value={m} key={m}>
          {MODEL_LABELS[m]}
        </option>
      ))}
    </select>
  );
}

export function ModelOverridePicker(props: {
  value: Model | null;
  onChange: (m: Model | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={props.value ?? ''}
      disabled={props.disabled}
      onChange={(e) => {
        const v = (e.target as HTMLSelectElement).value;
        props.onChange(v === '' ? null : (v as Model));
      }}
    >
      <option value="">use default</option>
      {MODELS.map((m) => (
        <option value={m} key={m}>
          {MODEL_LABELS[m]}
        </option>
      ))}
    </select>
  );
}

export function AgentEditor(props: {
  chatId: string;
  agent: Agent;
  disabled: boolean;
}) {
  const { chatId, agent, disabled } = props;
  return (
    <div class="agent-card">
      <div class="row">
        <input
          class="agent-name"
          type="text"
          value={agent.name}
          disabled={disabled}
          onInput={(e) =>
            updateAgent(chatId, agent.id, {
              name: (e.target as HTMLInputElement).value,
            })
          }
        />
        <label class="checkbox">
          <input
            type="checkbox"
            checked={agent.afterEach}
            disabled={disabled}
            onChange={(e) =>
              updateAgent(chatId, agent.id, {
                afterEach: (e.target as HTMLInputElement).checked,
              })
            }
          />
          after each
        </label>
        <ModelOverridePicker
          value={agent.model}
          disabled={disabled}
          onChange={(m) => updateAgent(chatId, agent.id, { model: m })}
        />
        <button
          class="danger"
          disabled={disabled}
          onClick={() => deleteAgent(chatId, agent.id)}
        >
          delete
        </button>
      </div>
      <textarea
        class="persona"
        placeholder="Persona prompt — describe how this agent should behave."
        value={agent.personaPrompt}
        disabled={disabled}
        onInput={(e) =>
          updateAgent(chatId, agent.id, {
            personaPrompt: (e.target as HTMLTextAreaElement).value,
          })
        }
        rows={3}
      />
    </div>
  );
}

export function TurnOrderList(props: { chat: Chat; disabled: boolean }) {
  const { chat, disabled } = props;
  const mainAgents = chat.agents
    .filter((a) => !a.afterEach)
    .sort((a, b) => a.order - b.order);
  const afterAgents = chat.agents.filter((a) => a.afterEach);
  const [dragId, setDragId] = useState<string | null>(null);

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = mainAgents.map((a) => a.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = ids.slice();
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    reorderMainAgents(chat.id, next);
    setDragId(null);
  }

  return (
    <div class="turn-order">
      <div class="section-label">
        Main order {chat.randomize ? '(randomized per cycle)' : '(drag to reorder)'}
      </div>
      <ul class="order-list">
        {mainAgents.map((a) => (
          <li
            key={a.id}
            class={'order-item' + (dragId === a.id ? ' dragging' : '')}
            draggable={!disabled}
            onDragStart={() => setDragId(a.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(a.id)}
            onDragEnd={() => setDragId(null)}
          >
            <span class="handle">≡</span>
            <AgentEditor chatId={chat.id} agent={a} disabled={disabled} />
          </li>
        ))}
        {mainAgents.length === 0 && (
          <li class="hint">No main agents yet. Click "Add agent" below.</li>
        )}
      </ul>

      {afterAgents.length > 0 && (
        <>
          <div class="section-label">After each turn</div>
          <ul class="order-list">
            {afterAgents.map((a) => (
              <li key={a.id} class="order-item after-each">
                <span class="handle">↺</span>
                <AgentEditor chatId={chat.id} agent={a} disabled={disabled} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function Transcript(props: { chat: Chat; agents: Agent[] }) {
  const { chat, agents } = props;
  const ref = useRef<HTMLDivElement>(null);
  const byId = new Map(agents.map((a) => [a.id, a] as const));

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [chat.messages.length]);

  function colorFor(agentId: string): string {
    const i = agents.findIndex((a) => a.id === agentId);
    const hues = [210, 350, 130, 40, 280, 180];
    const h = hues[((i % hues.length) + hues.length) % hues.length];
    return `hsl(${h}, 60%, 92%)`;
  }

  return (
    <div class="transcript" ref={ref}>
      {chat.messages.length === 0 && (
        <div class="hint">No messages yet. Click Run to start.</div>
      )}
      {chat.messages.map((m: Message) => {
        const a = byId.get(m.agentId);
        return (
          <div class="bubble" key={m.id} style={{ background: colorFor(m.agentId) }}>
            <div class="bubble-meta">
              <strong>{a?.name ?? m.agentNameSnapshot}</strong>
              <span class="model-label">{MODEL_LABELS[m.model] ?? m.model}</span>
            </div>
            <div class="bubble-content">{m.content}</div>
          </div>
        );
      })}
    </div>
  );
}

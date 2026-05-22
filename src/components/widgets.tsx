import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type {
  AgentDefinition,
  AgentId,
  Message,
  MessageScope,
  DefaultableScope,
} from '../types';
import { MODELS, MODEL_LABELS } from '../types';
import type { Route } from '../types';
import { navigate } from '../router';

export type Crumb = { label: string; route?: Route; title?: string };

export function formatDateTime(iso: string | number): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Breadcrumbs(props: { items: Crumb[] }) {
  return (
    <nav class="crumbs" aria-label="Breadcrumb">
      {props.items.map((c, i) => {
        const last = i === props.items.length - 1;
        return (
          <span class="crumb-wrap" key={i}>
            {c.route && !last ? (
              <button
                type="button"
                class="crumb crumb-link"
                title={c.title}
                onClick={() => navigate(c.route!)}
              >
                {c.label}
              </button>
            ) : (
              <span
                class={`crumb ${last ? 'crumb-current' : ''}`}
                title={c.title}
                aria-current={last ? 'page' : undefined}
              >
                {c.label}
              </span>
            )}
            {!last && <span class="crumb-sep" aria-hidden="true">/</span>}
          </span>
        );
      })}
    </nav>
  );
}

export function ConfirmButton(props: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function disarm() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setArmed(false);
  }
  function onClick() {
    if (armed) {
      disarm();
      props.onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3000);
  }
  const cls = armed
    ? `danger armed ${props.className ?? ''}`
    : `danger ${props.className ?? ''}`;
  return (
    <button
      type="button"
      class={cls}
      disabled={props.disabled}
      onClick={onClick}
      onBlur={disarm}
      title={props.title}
    >
      {armed ? (props.confirmLabel ?? 'Click again to confirm') : (props.label ?? 'Delete')}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Form primitives shared across the Agents / Chat / Flow authoring views.
// ───────────────────────────────────────────────────────────────────────────

export function Field(props: {
  label: string;
  hint?: string;
  children: ComponentChildren;
}) {
  return (
    <label class="field">
      <span class="field-label">{props.label}</span>
      {props.children}
      {props.hint && <span class="field-hint">{props.hint}</span>}
    </label>
  );
}

/** Number input that maps blank → undefined (clears the optional field). */
export function NumberInput(props: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={props.value ?? ''}
      placeholder={props.placeholder}
      disabled={props.disabled}
      min={props.min}
      max={props.max}
      step={props.step}
      onInput={(e) => {
        const raw = (e.target as HTMLInputElement).value;
        props.onChange(raw === '' ? undefined : Number(raw));
      }}
    />
  );
}

/** Model picker: known models as suggestions, but any OpenRouter ID is accepted. */
export function ModelPicker(props: {
  value: string;
  onChange: (m: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <input
        class="model-input"
        list="model-suggestions"
        value={props.value}
        disabled={props.disabled}
        placeholder="openrouter/model-id"
        onInput={(e) => props.onChange((e.target as HTMLInputElement).value)}
      />
      <datalist id="model-suggestions">
        {MODELS.map((m) => (
          <option value={m} key={m}>
            {MODEL_LABELS[m] ?? m}
          </option>
        ))}
      </datalist>
    </>
  );
}

/** Single-agent dropdown. Stores AgentId; shows display names. */
export function AgentSelect(props: {
  agents: AgentDefinition[];
  value: AgentId | null;
  onChange: (id: AgentId) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <select
      value={props.value ?? ''}
      disabled={props.disabled}
      onChange={(e) => props.onChange((e.target as HTMLSelectElement).value as AgentId)}
    >
      <option value="" disabled>
        {props.placeholder ?? 'Select an agent…'}
      </option>
      {props.agents.map((a) => (
        <option value={a.id} key={a.id}>
          {a.name || '(unnamed)'}
        </option>
      ))}
    </select>
  );
}

/**
 * Multi-select of agents as a row of toggle chips. Order is not significant
 * (used for participants and random pools). For ordered lists use OrderedAgentList.
 */
export function AgentChips(props: {
  agents: AgentDefinition[];
  selected: AgentId[];
  onChange: (ids: AgentId[]) => void;
  disabled?: boolean;
}) {
  const set = new Set(props.selected);
  function toggle(id: AgentId) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Preserve agent declaration order for stability.
    props.onChange(props.agents.filter((a) => next.has(a.id)).map((a) => a.id));
  }
  if (props.agents.length === 0) {
    return <span class="field-hint">No agents defined yet.</span>;
  }
  return (
    <div class="chip-row">
      {props.agents.map((a) => {
        const on = set.has(a.id);
        return (
          <button
            type="button"
            key={a.id}
            class={`chip ${on ? 'chip-on' : ''}`}
            disabled={props.disabled}
            onClick={() => toggle(a.id)}
          >
            {a.name || '(unnamed)'}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Ordered list of agents (used for round-robin order and interleave rotation).
 * Each row picks an agent; rows can be reordered and removed. Agents may repeat
 * (e.g. negotiation's [A, buyer, B, buyer]).
 */
export function OrderedAgentList(props: {
  agents: AgentDefinition[];
  value: AgentId[];
  onChange: (ids: AgentId[]) => void;
  disabled?: boolean;
  addLabel?: string;
}) {
  const { value, agents, disabled } = props;
  function setAt(i: number, id: AgentId) {
    props.onChange(value.map((v, j) => (j === i ? id : v)));
  }
  function removeAt(i: number) {
    props.onChange(value.filter((_, j) => j !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    props.onChange(next);
  }
  function add() {
    const first = agents[0]?.id;
    if (first) props.onChange([...value, first]);
  }
  return (
    <div class="ordered-list">
      {value.length === 0 && <span class="field-hint">Empty — defaults to all participants.</span>}
      {value.map((id, i) => (
        <div class="ordered-row" key={i}>
          <span class="ordered-index">{i + 1}</span>
          <AgentSelect
            agents={agents}
            value={id}
            disabled={disabled}
            onChange={(v) => setAt(i, v)}
          />
          <div class="ordered-controls">
            <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button type="button" disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
            <button type="button" class="danger" disabled={disabled} onClick={() => removeAt(i)} title="Remove">✕</button>
          </div>
        </div>
      ))}
      <button type="button" class="add-row" disabled={disabled || agents.length === 0} onClick={add}>
        + {props.addLabel ?? 'Add'}
      </button>
    </div>
  );
}

/** Editor for a DefaultableScope (self | broadcast). Used at the chat level. */
export function DefaultableScopeField(props: {
  value: DefaultableScope | undefined;
  onChange: (s: DefaultableScope) => void;
  disabled?: boolean;
}) {
  const type = props.value?.type ?? 'broadcast';
  return (
    <select
      value={type}
      disabled={props.disabled}
      onChange={(e) => {
        const t = (e.target as HTMLSelectElement).value as DefaultableScope['type'];
        props.onChange({ type: t });
      }}
    >
      <option value="broadcast">Broadcast — visible to everyone</option>
      <option value="self">Self — private scratchpad</option>
    </select>
  );
}

/**
 * Editor for a full MessageScope (self | direct | multicast | broadcast).
 * Used by phase-step scope overrides.
 */
export function ScopeField(props: {
  agents: AgentDefinition[];
  value: MessageScope;
  onChange: (s: MessageScope) => void;
  disabled?: boolean;
}) {
  const { agents, value, disabled } = props;
  function changeType(t: MessageScope['type']) {
    switch (t) {
      case 'self': props.onChange({ type: 'self' }); break;
      case 'broadcast': props.onChange({ type: 'broadcast' }); break;
      case 'direct': props.onChange({ type: 'direct', to: agents[0]?.id ?? ('' as AgentId) }); break;
      case 'multicast': props.onChange({ type: 'multicast', to: [] }); break;
    }
  }
  return (
    <div class="scope-field">
      <select
        value={value.type}
        disabled={disabled}
        onChange={(e) => changeType((e.target as HTMLSelectElement).value as MessageScope['type'])}
      >
        <option value="broadcast">Broadcast</option>
        <option value="direct">Direct</option>
        <option value="multicast">Multicast</option>
        <option value="self">Self</option>
      </select>
      {value.type === 'direct' && (
        <AgentSelect
          agents={agents}
          value={value.to}
          disabled={disabled}
          onChange={(id) => props.onChange({ type: 'direct', to: id })}
        />
      )}
      {value.type === 'multicast' && (
        <AgentChips
          agents={agents}
          selected={value.to}
          disabled={disabled}
          onChange={(ids) => props.onChange({ type: 'multicast', to: ids })}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Transcript — scope-aware run view. Re-exported; see Transcript.tsx logic below.
// ───────────────────────────────────────────────────────────────────────────

const HUES = [150, 210, 35, 280, 340, 95, 18, 255];

function senderName(m: Message): string {
  if (m.from === 'user') return 'User';
  if (m.from === 'seed') return 'Seed';
  if (m.from === 'system') return 'System';
  return m.fromNameSnapshot ?? m.from;
}

function scopeDescriptor(m: Message): { label: string; kind: 'broadcast' | 'self' | 'private' } {
  switch (m.scope.type) {
    case 'broadcast':
      return { label: 'to everyone', kind: 'broadcast' };
    case 'self':
      return { label: 'private note', kind: 'self' };
    case 'direct':
      return { label: `→ ${m.toNamesSnapshot?.[0] ?? 'someone'}`, kind: 'private' };
    case 'multicast':
      return { label: `→ ${(m.toNamesSnapshot ?? []).join(', ') || 'group'}`, kind: 'private' };
  }
}

export function Transcript(props: {
  messages: Message[];
  agents: AgentDefinition[];
  activeAgent?: string | null;
}) {
  const { messages, agents, activeAgent } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages.length, activeAgent]);

  function hueFor(from: Message['from']): number | null {
    const i = agents.findIndex((a) => a.id === (from as AgentId));
    if (i < 0) return null;
    return HUES[i % HUES.length];
  }

  function hueForName(name: string): number | null {
    const i = agents.findIndex((a) => a.name === name);
    if (i < 0) return null;
    return HUES[i % HUES.length];
  }

  return (
    <div class="transcript" ref={ref}>
      {messages.length === 0 && !activeAgent && (
        <div class="hint">No messages yet. Hit Run to start.</div>
      )}
      {messages.map((m) => {
        const sys = m.from === 'system';
        const synthetic = m.from === 'user' || m.from === 'seed';
        const { label, kind } = scopeDescriptor(m);
        const hue = hueFor(m.from);

        if (sys) {
          return (
            <div class="sys-line" key={m.id}>
              <span class="sys-badge">system</span>
              <span class="sys-text">{m.content}</span>
            </div>
          );
        }

        const classes = [
          'bubble',
          kind === 'self' ? 'bubble-self' : '',
          kind === 'private' ? 'bubble-private' : '',
          synthetic ? 'bubble-synthetic' : '',
        ].filter(Boolean).join(' ');

        return (
          <div
            class={classes}
            key={m.id}
            style={hue != null ? { '--accent-hue': String(hue) } : undefined}
          >
            <div class="bubble-meta">
              {hue != null && <span class="sender-dot" style={{ background: `hsl(${hue}, 52%, 58%)` }} />}
              <strong>{senderName(m)}</strong>
              <span class={`scope-tag scope-${kind}`}>{label}</span>
              {m.model && <span class="model-label">{MODEL_LABELS[m.model] ?? m.model}</span>}
            </div>
            <div class="bubble-content">{m.content}</div>
          </div>
        );
      })}
      {activeAgent && <ThinkingRow name={activeAgent} hue={hueForName(activeAgent)} />}
    </div>
  );
}

/** Inline "agent is thinking…" indicator shown at the foot of the transcript. */
function ThinkingRow(props: { name: string; hue: number | null }) {
  const { name, hue } = props;
  const color = hue != null ? `hsl(${hue}, 52%, 58%)` : 'var(--muted)';
  return (
    <div class="thinking" aria-live="polite">
      <span class="thinking-dots" style={{ color }}>
        <span class="thinking-dot" />
        <span class="thinking-dot" />
        <span class="thinking-dot" />
      </span>
      <span class="thinking-text">
        <strong style={{ color }}>{name}</strong> is thinking…
      </span>
    </div>
  );
}

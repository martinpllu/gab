import type {
  AgentDefinition,
  AgentId,
  ChatSpec,
  Flow,
  PhaseStep,
  StopCondition,
  TurnPolicy,
} from '../../types';
import { updateSpec } from '../../state/signals';
import {
  Field,
  AgentSelect,
  AgentChips,
  OrderedAgentList,
  ScopeField,
  NumberInput,
} from '../widgets';

export function FlowView(props: { chatId: string; spec: ChatSpec; disabled: boolean }) {
  const { chatId, spec, disabled } = props;
  const flow = spec.flow;
  const agents = spec.agents;

  function patchFlow(p: Partial<Flow>) {
    updateSpec(chatId, (s) => ({ ...s, flow: { ...s.flow, ...p } }));
  }
  function patchMain(p: Partial<Flow['main']>) {
    patchFlow({ main: { ...flow.main, ...p } });
  }

  return (
    <div class="view">
      <PhaseList
        title="Opening"
        hint="Scripted turns before the main loop. Optional."
        agents={agents}
        steps={flow.opening ?? []}
        disabled={disabled}
        onChange={(steps) => patchFlow({ opening: steps.length ? steps : undefined })}
      />

      <fieldset class="variant-block">
        <legend>Turn policy — who speaks next in the main loop</legend>
        <PolicyEditor
          agents={agents}
          value={flow.main.policy}
          disabled={disabled}
          onChange={(policy) => patchMain({ policy })}
        />
      </fieldset>

      <fieldset class="variant-block">
        <legend>Stop conditions — the loop ends when any of these fire</legend>
        <StopList
          agents={agents}
          value={flow.main.stop}
          disabled={disabled}
          onChange={(stop) => patchMain({ stop })}
          topLevel
        />
      </fieldset>

      <PhaseList
        title="Closing"
        hint="Scripted turns after the main loop ends. Optional."
        agents={agents}
        steps={flow.closing ?? []}
        disabled={disabled}
        onChange={(steps) => patchFlow({ closing: steps.length ? steps : undefined })}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Phase steps (opening / closing)
// ───────────────────────────────────────────────────────────────────────────

function PhaseList(props: {
  title: string;
  hint: string;
  agents: AgentDefinition[];
  steps: PhaseStep[];
  onChange: (steps: PhaseStep[]) => void;
  disabled?: boolean;
}) {
  const { title, hint, agents, steps, disabled } = props;
  function setAt(i: number, step: PhaseStep) {
    props.onChange(steps.map((s, j) => (j === i ? step : s)));
  }
  function removeAt(i: number) {
    props.onChange(steps.filter((_, j) => j !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    props.onChange(next);
  }
  function add() {
    const first = agents[0]?.id;
    if (!first) return;
    props.onChange([...steps, { agentId: first }]);
  }

  return (
    <fieldset class="variant-block">
      <legend>{title}</legend>
      {steps.length === 0 && <div class="field-hint">{hint}</div>}
      {steps.map((step, i) => (
        <div class="phase-step" key={i}>
          <div class="phase-step-head">
            <span class="ordered-index">{i + 1}</span>
            <AgentSelect
              agents={agents}
              value={step.agentId}
              disabled={disabled}
              onChange={(id) => setAt(i, { ...step, agentId: id })}
            />
            <div class="ordered-controls">
              <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
              <button type="button" disabled={disabled || i === steps.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
              <button type="button" class="danger" disabled={disabled} onClick={() => removeAt(i)} title="Remove">✕</button>
            </div>
          </div>
          <Field label="Prompt override" hint="Optional instruction injected before this turn.">
            <textarea
              rows={2}
              value={step.promptOverride ?? ''}
              disabled={disabled}
              placeholder="e.g. Frame the discussion and pose the opening question."
              onInput={(e) => {
                const v = (e.target as HTMLTextAreaElement).value;
                setAt(i, { ...step, promptOverride: v === '' ? undefined : v });
              }}
            />
          </Field>
          <label class="checkbox">
            <input
              type="checkbox"
              checked={step.scopeOverride !== undefined}
              disabled={disabled}
              onChange={(e) => {
                const on = (e.target as HTMLInputElement).checked;
                setAt(i, { ...step, scopeOverride: on ? { type: 'broadcast' } : undefined });
              }}
            />
            Override scope for this turn
          </label>
          {step.scopeOverride !== undefined && (
            <ScopeField
              agents={agents}
              value={step.scopeOverride}
              disabled={disabled}
              onChange={(s) => setAt(i, { ...step, scopeOverride: s })}
            />
          )}
        </div>
      ))}
      <button type="button" class="add-row" disabled={disabled || agents.length === 0} onClick={add}>
        + Add {title.toLowerCase()} step
      </button>
    </fieldset>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Turn policy (custom hidden — function-valued, not buildable)
// ───────────────────────────────────────────────────────────────────────────

type BuildablePolicy = Exclude<TurnPolicy, { type: 'custom' }>['type'];

function PolicyEditor(props: {
  agents: AgentDefinition[];
  value: TurnPolicy;
  onChange: (p: TurnPolicy) => void;
  disabled?: boolean;
}) {
  const { agents, value, disabled } = props;
  const first = agents[0]?.id ?? ('' as AgentId);

  function changeType(t: BuildablePolicy) {
    switch (t) {
      case 'round-robin': props.onChange({ type: 'round-robin' }); break;
      case 'random': props.onChange({ type: 'random' }); break;
      case 'interleave': props.onChange({ type: 'interleave', interleaver: first, rotation: [] }); break;
      case 'agent-select': props.onChange({ type: 'agent-select', selectorAgent: first }); break;
    }
  }

  // `custom` is function-valued; if a spec somehow carries it, show a read-only note.
  if (value.type === 'custom') {
    return <div class="field-hint">This scenario uses a programmatic (custom) policy, which can't be edited here.</div>;
  }

  return (
    <>
      <Field label="Type">
        <select
          value={value.type}
          disabled={disabled}
          onChange={(e) => changeType((e.target as HTMLSelectElement).value as BuildablePolicy)}
        >
          <option value="round-robin">Round-robin — fixed rotation</option>
          <option value="random">Random — pick from a pool</option>
          <option value="interleave">Interleave — one agent speaks between each other</option>
          <option value="agent-select">Agent-select — a selector picks the speaker</option>
        </select>
      </Field>

      {value.type === 'round-robin' && (
        <Field label="Order" hint="Leave empty to cycle through all participants in order.">
          <OrderedAgentList
            agents={agents}
            value={value.order ?? []}
            disabled={disabled}
            addLabel="agent to order"
            onChange={(ids) => props.onChange({ type: 'round-robin', order: ids.length ? ids : undefined })}
          />
        </Field>
      )}

      {value.type === 'random' && (
        <>
          <Field label="Pool" hint="Leave empty to draw from all participants.">
            <AgentChips
              agents={agents}
              selected={value.pool ?? []}
              disabled={disabled}
              onChange={(ids) => props.onChange({ ...value, pool: ids.length ? ids : undefined })}
            />
          </Field>
          <label class="checkbox">
            <input
              type="checkbox"
              checked={!!value.avoidRepeat}
              disabled={disabled}
              onChange={(e) =>
                props.onChange({ ...value, avoidRepeat: (e.target as HTMLInputElement).checked || undefined })
              }
            />
            Avoid the same agent speaking twice in a row
          </label>
        </>
      )}

      {value.type === 'interleave' && (
        <>
          <Field label="Interleaver" hint="Speaks after every agent in the rotation (judge, summariser, etc.).">
            <AgentSelect
              agents={agents}
              value={value.interleaver}
              disabled={disabled}
              onChange={(id) => props.onChange({ ...value, interleaver: id })}
            />
          </Field>
          <Field label="Rotation" hint="The agents the interleaver alternates between.">
            <OrderedAgentList
              agents={agents}
              value={value.rotation}
              disabled={disabled}
              addLabel="agent to rotation"
              onChange={(ids) => props.onChange({ ...value, rotation: ids })}
            />
          </Field>
        </>
      )}

      {value.type === 'agent-select' && (
        <Field label="Selector agent" hint="Reads the conversation and names who should speak next.">
          <AgentSelect
            agents={agents}
            value={value.selectorAgent}
            disabled={disabled}
            onChange={(id) => props.onChange({ type: 'agent-select', selectorAgent: id })}
          />
        </Field>
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Stop conditions (predicate hidden — function-valued)
// ───────────────────────────────────────────────────────────────────────────

type BuildableStopType = Exclude<StopCondition, { type: 'predicate' }>['type'];

function defaultStop(t: BuildableStopType): StopCondition {
  switch (t) {
    case 'max-turns': return { type: 'max-turns', turns: 10 };
    case 'max-rounds': return { type: 'max-rounds', rounds: 3 };
    case 'signal': return { type: 'signal', phrase: 'DONE' };
    case 'timeout-ms': return { type: 'timeout-ms', ms: 300000 };
    case 'any': return { type: 'any', of: [] };
    case 'all': return { type: 'all', of: [] };
  }
}

function StopList(props: {
  agents: AgentDefinition[];
  value: StopCondition[];
  onChange: (s: StopCondition[]) => void;
  disabled?: boolean;
  topLevel?: boolean;
}) {
  const { agents, value, disabled, topLevel } = props;
  function setAt(i: number, c: StopCondition) {
    props.onChange(value.map((v, j) => (j === i ? c : v)));
  }
  function removeAt(i: number) {
    props.onChange(value.filter((_, j) => j !== i));
  }
  function add() {
    props.onChange([...value, defaultStop('max-rounds')]);
  }

  return (
    <div class="stop-list">
      {value.length === 0 && (
        <div class="field-hint">
          {topLevel ? 'No stop condition yet. A run is capped at 50 turns until you add one.' : 'Add at least one nested condition.'}
        </div>
      )}
      {value.map((c, i) => (
        <StopEditor
          key={i}
          agents={agents}
          value={c}
          disabled={disabled}
          onChange={(next) => setAt(i, next)}
          onRemove={() => removeAt(i)}
        />
      ))}
      <button type="button" class="add-row" disabled={disabled} onClick={add}>
        + Add condition
      </button>
    </div>
  );
}

function StopEditor(props: {
  agents: AgentDefinition[];
  value: StopCondition;
  onChange: (c: StopCondition) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { agents, value, disabled } = props;

  if (value.type === 'predicate') {
    return (
      <div class="stop-card">
        <div class="field-hint">Programmatic (predicate) condition — not editable here.</div>
      </div>
    );
  }

  function changeType(t: BuildableStopType) {
    props.onChange(defaultStop(t));
  }

  return (
    <div class="stop-card">
      <div class="stop-head">
        <select
          value={value.type}
          disabled={disabled}
          onChange={(e) => changeType((e.target as HTMLSelectElement).value as BuildableStopType)}
        >
          <option value="max-turns">Max turns</option>
          <option value="max-rounds">Max rounds</option>
          <option value="signal">Signal phrase</option>
          <option value="timeout-ms">Timeout</option>
          <option value="any">Any of… (nested)</option>
          <option value="all">All of… (nested)</option>
        </select>
        <button type="button" class="danger" disabled={disabled} onClick={props.onRemove} title="Remove">✕</button>
      </div>

      {value.type === 'max-turns' && (
        <Field label="Turns">
          <NumberInput
            value={value.turns}
            disabled={disabled}
            min={1} step={1}
            onChange={(v) => props.onChange({ type: 'max-turns', turns: v ?? 1 })}
          />
        </Field>
      )}

      {value.type === 'max-rounds' && (
        <Field label="Rounds" hint="One round = every participant has spoken once.">
          <NumberInput
            value={value.rounds}
            disabled={disabled}
            min={1} step={1}
            onChange={(v) => props.onChange({ type: 'max-rounds', rounds: v ?? 1 })}
          />
        </Field>
      )}

      {value.type === 'timeout-ms' && (
        <Field label="Timeout (seconds)">
          <NumberInput
            value={Math.round(value.ms / 1000)}
            disabled={disabled}
            min={1} step={1}
            onChange={(v) => props.onChange({ type: 'timeout-ms', ms: (v ?? 1) * 1000 })}
          />
        </Field>
      )}

      {value.type === 'signal' && (
        <>
          <Field label="Phrase" hint="The loop stops when this text appears in a message.">
            <input
              type="text"
              value={value.phrase}
              disabled={disabled}
              placeholder="e.g. DONE"
              onInput={(e) => props.onChange({ ...value, phrase: (e.target as HTMLInputElement).value })}
            />
          </Field>
          <label class="checkbox">
            <input
              type="checkbox"
              checked={!!value.caseSensitive}
              disabled={disabled}
              onChange={(e) => props.onChange({ ...value, caseSensitive: (e.target as HTMLInputElement).checked || undefined })}
            />
            Case-sensitive
          </label>
          <Field label="From a specific agent" hint="Optional — only this agent's messages can trigger it.">
            <select
              value={value.fromAgent ?? ''}
              disabled={disabled}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                props.onChange({ ...value, fromAgent: v === '' ? undefined : (v as AgentId) });
              }}
            >
              <option value="">Any agent</option>
              {agents.map((a) => (
                <option value={a.id} key={a.id}>{a.name || '(unnamed)'}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      {(value.type === 'any' || value.type === 'all') && (
        <div class="nested-stops">
          <StopList
            agents={agents}
            value={value.of}
            disabled={disabled}
            onChange={(of) => props.onChange({ ...value, of })}
          />
        </div>
      )}
    </div>
  );
}

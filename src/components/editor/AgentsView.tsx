import { useState } from 'preact/hooks';
import type { AgentDefinition, ChatSpec, ModelParams } from '../../types';
import { addAgent, updateAgent, deleteAgent } from '../../state/signals';
import { Field, NumberInput, ModelPicker, ConfirmButton } from '../widgets';

export function AgentsView(props: { chatId: string; spec: ChatSpec; disabled: boolean }) {
  const { chatId, spec, disabled } = props;
  const agents = spec.agents;

  return (
    <div class="view">
      {agents.length === 0 && (
        <div class="hint">No agents yet. Every scenario needs at least one.</div>
      )}
      <div class="agent-stack">
        {agents.map((a) => (
          <AgentCard key={a.id} chatId={chatId} agent={a} disabled={disabled} />
        ))}
      </div>
      <button class="add-row" disabled={disabled} onClick={() => addAgent(chatId)}>
        + Add agent
      </button>
    </div>
  );
}

function AgentCard(props: { chatId: string; agent: AgentDefinition; disabled: boolean }) {
  const { chatId, agent, disabled } = props;
  const [open, setOpen] = useState(false);

  function patch(p: Partial<AgentDefinition>) {
    updateAgent(chatId, agent.id, p);
  }
  function patchParams(p: Partial<ModelParams>) {
    patch({ params: { ...agent.params, ...p } });
  }

  const paramSummary = summariseParams(agent.params);

  return (
    <div class="agent-card">
      <div class="agent-card-head">
        <input
          class="agent-name-input"
          type="text"
          value={agent.name}
          disabled={disabled}
          placeholder="Agent name"
          onInput={(e) => patch({ name: (e.target as HTMLInputElement).value })}
        />
        <div class="agent-model">
          <ModelPicker value={agent.model} disabled={disabled} onChange={(m) => patch({ model: m })} />
        </div>
        {agent.omnipotent && <span class="badge badge-omni" title="Sees all messages">omnipotent</span>}
        <ConfirmButton
          label="Delete"
          confirmLabel="Confirm"
          disabled={disabled}
          onConfirm={() => deleteAgent(chatId, agent.id)}
        />
      </div>

      <Field label="System prompt">
        <textarea
          rows={4}
          placeholder="Describe how this agent should behave — its persona, goals, and constraints."
          value={agent.systemPrompt}
          disabled={disabled}
          onInput={(e) => patch({ systemPrompt: (e.target as HTMLTextAreaElement).value })}
        />
      </Field>

      <Field
        label="Public description"
        hint="Optional. Shown to other agents in the roster so they know who their peers are."
      >
        <input
          type="text"
          value={agent.publicDescription ?? ''}
          disabled={disabled}
          placeholder="e.g. A sceptical engineer focused on feasibility."
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            patch({ publicDescription: v === '' ? undefined : v });
          }}
        />
      </Field>

      <label class="checkbox">
        <input
          type="checkbox"
          checked={!!agent.omnipotent}
          disabled={disabled}
          onChange={(e) => patch({ omnipotent: (e.target as HTMLInputElement).checked || undefined })}
        />
        Omnipotent — sees every message regardless of addressing (referee / observer)
      </label>

      <button type="button" class="disclosure" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span class={`chevron ${open ? 'open' : ''}`}>▸</span>
        Model parameters
        <span class="disclosure-summary">{paramSummary}</span>
      </button>

      {open && (
        <div class="params-grid">
          <Field label="Temperature">
            <NumberInput
              value={agent.params?.temperature}
              disabled={disabled}
              step={0.1} min={0} max={2}
              placeholder="default"
              onChange={(v) => patchParams({ temperature: v })}
            />
          </Field>
          <Field label="Top P">
            <NumberInput
              value={agent.params?.topP}
              disabled={disabled}
              step={0.05} min={0} max={1}
              placeholder="default"
              onChange={(v) => patchParams({ topP: v })}
            />
          </Field>
          <Field label="Top K">
            <NumberInput
              value={agent.params?.topK}
              disabled={disabled}
              step={1} min={0}
              placeholder="default"
              onChange={(v) => patchParams({ topK: v })}
            />
          </Field>
          <Field label="Max tokens">
            <NumberInput
              value={agent.params?.maxTokens}
              disabled={disabled}
              step={1} min={1}
              placeholder="default"
              onChange={(v) => patchParams({ maxTokens: v })}
            />
          </Field>
          <Field label="Frequency penalty">
            <NumberInput
              value={agent.params?.frequencyPenalty}
              disabled={disabled}
              step={0.1} min={-2} max={2}
              placeholder="default"
              onChange={(v) => patchParams({ frequencyPenalty: v })}
            />
          </Field>
          <Field label="Presence penalty">
            <NumberInput
              value={agent.params?.presencePenalty}
              disabled={disabled}
              step={0.1} min={-2} max={2}
              placeholder="default"
              onChange={(v) => patchParams({ presencePenalty: v })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function summariseParams(p: ModelParams | undefined): string {
  if (!p) return 'all default';
  const parts: string[] = [];
  if (p.temperature !== undefined) parts.push(`temp ${p.temperature}`);
  if (p.topP !== undefined) parts.push(`top_p ${p.topP}`);
  if (p.topK !== undefined) parts.push(`top_k ${p.topK}`);
  if (p.maxTokens !== undefined) parts.push(`max ${p.maxTokens}`);
  if (p.frequencyPenalty !== undefined) parts.push(`freq ${p.frequencyPenalty}`);
  if (p.presencePenalty !== undefined) parts.push(`pres ${p.presencePenalty}`);
  return parts.length ? parts.join(' · ') : 'all default';
}

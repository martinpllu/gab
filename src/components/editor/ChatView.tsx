import type { AgentId, ChatSpec, Kickoff } from '../../types';
import { updateSpec } from '../../state/signals';
import { Field, AgentChips, AgentSelect, DefaultableScopeField } from '../widgets';

export function ChatView(props: { chatId: string; spec: ChatSpec; disabled: boolean }) {
  const { chatId, spec, disabled } = props;
  const chat = spec.chat;

  function patchChat(p: Partial<ChatSpec['chat']>) {
    updateSpec(chatId, (s) => ({ ...s, chat: { ...s.chat, ...p } }));
  }

  return (
    <div class="view">
      <Field
        label="Shared prompt"
        hint="The rules of the room — prepended to every agent's context."
      >
        <textarea
          rows={4}
          placeholder="e.g. You are designing a new mobile app for elderly users."
          value={chat.sharedPrompt ?? ''}
          disabled={disabled}
          onInput={(e) => {
            const v = (e.target as HTMLTextAreaElement).value;
            patchChat({ sharedPrompt: v === '' ? undefined : v });
          }}
        />
      </Field>

      <Field
        label="Participants"
        hint="Agents that take turns in the main loop. Selectors and observers may sit outside this set."
      >
        <AgentChips
          agents={spec.agents}
          selected={chat.participants}
          disabled={disabled}
          onChange={(ids) => patchChat({ participants: ids })}
        />
      </Field>

      <Field label="Default message scope" hint="Used when an agent doesn't address its message. Broadcast is the usual choice.">
        <DefaultableScopeField
          value={chat.defaultMessageScope}
          disabled={disabled}
          onChange={(s) => patchChat({ defaultMessageScope: s })}
        />
      </Field>

      <KickoffEditor
        agents={spec.agents}
        value={chat.kickoff}
        disabled={disabled}
        onChange={(k) => patchChat({ kickoff: k })}
      />
    </div>
  );
}

function KickoffEditor(props: {
  agents: ChatSpec['agents'];
  value: Kickoff;
  onChange: (k: Kickoff) => void;
  disabled?: boolean;
}) {
  const { value, agents, disabled } = props;

  function changeType(t: Kickoff['type']) {
    switch (t) {
      case 'user': props.onChange({ type: 'user' }); break;
      case 'seed': props.onChange({ type: 'seed', message: "Let's begin." }); break;
      case 'agent': props.onChange({ type: 'agent', agentId: agents[0]?.id ?? ('' as AgentId) }); break;
    }
  }

  return (
    <fieldset class="variant-block">
      <legend>Kickoff — how the conversation opens</legend>
      <Field label="Type">
        <select
          value={value.type}
          disabled={disabled}
          onChange={(e) => changeType((e.target as HTMLSelectElement).value as Kickoff['type'])}
        >
          <option value="seed">Seed message — a fixed opening line</option>
          <option value="user">User message — prompted when the run starts</option>
          <option value="agent">Agent speaks first</option>
        </select>
      </Field>

      {value.type === 'seed' && (
        <>
          <Field label="Seed message">
            <textarea
              rows={2}
              value={value.message}
              disabled={disabled}
              placeholder="The first message everyone sees."
              onInput={(e) =>
                props.onChange({ ...value, message: (e.target as HTMLTextAreaElement).value })
              }
            />
          </Field>
          <Field label="As role">
            <select
              value={value.role ?? 'user'}
              disabled={disabled}
              onChange={(e) =>
                props.onChange({ ...value, role: (e.target as HTMLSelectElement).value as 'user' | 'system' })
              }
            >
              <option value="user">user</option>
              <option value="system">system</option>
            </select>
          </Field>
        </>
      )}

      {value.type === 'user' && (
        <div class="field-hint">
          You'll be prompted for the opening message each time this run starts.
        </div>
      )}

      {value.type === 'agent' && (
        <Field label="Opening agent">
          <AgentSelect
            agents={agents}
            value={value.agentId}
            disabled={disabled}
            onChange={(id) => props.onChange({ type: 'agent', agentId: id })}
          />
        </Field>
      )}
    </fieldset>
  );
}

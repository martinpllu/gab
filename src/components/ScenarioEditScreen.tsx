import { currentScenario, route, updateScenario, addAgent, runState } from '../state/signals';
import { ModelPicker, TurnOrderList } from './widgets';
import type { Model } from '../types';

export function ScenarioEditScreen() {
  const s = currentScenario.value;
  if (!s) {
    route.value = 'list';
    return null;
  }
  const disabled = runState.value !== 'idle';
  const turnsValue = s.turnsRequested ?? '';

  return (
    <div class="screen edit">
      <header class="topbar">
        <button class="link" onClick={() => (route.value = 'list')}>← Back</button>
        <h2>Edit gab</h2>
        <div class="spacer" />
        <button class="primary" onClick={() => (route.value = 'run')}>Run →</button>
      </header>

      <div class="field">
        <label>Name</label>
        <input
          type="text"
          value={s.name}
          disabled={disabled}
          onInput={(e) =>
            updateScenario(s.id, { name: (e.target as HTMLInputElement).value })
          }
        />
      </div>

      <div class="field">
        <label>Scenario prompt</label>
        <textarea
          rows={4}
          placeholder="Describe the setting and what the agents are doing — shared across all agents in this gab."
          value={s.scenarioPrompt}
          disabled={disabled}
          onInput={(e) =>
            updateScenario(s.id, {
              scenarioPrompt: (e.target as HTMLTextAreaElement).value,
            })
          }
        />
      </div>

      <div class="row">
        <div class="field">
          <label>Default model</label>
          <ModelPicker
            value={s.defaultModel}
            disabled={disabled}
            onChange={(m: Model) => updateScenario(s.id, { defaultModel: m })}
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
              updateScenario(s.id, { turnsRequested: v === '' ? null : Number(v) });
            }}
          />
        </div>
        <label class="checkbox">
          <input
            type="checkbox"
            checked={s.randomize}
            disabled={disabled}
            onChange={(e) =>
              updateScenario(s.id, {
                randomize: (e.target as HTMLInputElement).checked,
              })
            }
          />
          Randomize main order
        </label>
      </div>

      <h3>Agents</h3>
      <TurnOrderList scenario={s} disabled={disabled} />
      <button class="primary" disabled={disabled} onClick={() => addAgent(s.id)}>
        + Add agent
      </button>
    </div>
  );
}

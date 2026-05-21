import { scenarios, currentScenarioId, route, createScenario, deleteScenario, signOut } from '../state/signals';

export function ScenarioListScreen() {
  function onNew() {
    const s = createScenario();
    currentScenarioId.value = s.id;
    route.value = 'edit';
  }

  function onEdit(id: string) {
    currentScenarioId.value = id;
    route.value = 'edit';
  }

  function onRun(id: string) {
    currentScenarioId.value = id;
    route.value = 'run';
  }

  return (
    <div class="screen list">
      <header class="topbar">
        <h2>Gabs</h2>
        <div class="spacer" />
        <button class="primary" onClick={onNew}>New gab</button>
        <button class="link" onClick={signOut}>Sign out</button>
      </header>
      <div class="scenario-list">
        {scenarios.value.length === 0 && (
          <div class="hint">No gabs yet. Click "New gab" to make one.</div>
        )}
        {scenarios.value.map((s) => (
          <div class="scenario-row" key={s.id}>
            <div class="scenario-main">
              <div class="scenario-name">{s.name}</div>
              <div class="scenario-meta">
                {s.agents.length} agent{s.agents.length === 1 ? '' : 's'} ·
                {' '}{s.utterances.length} utterance{s.utterances.length === 1 ? '' : 's'} ·
                {' '}updated {new Date(s.updatedAt).toLocaleString()}
              </div>
            </div>
            <div class="row">
              <button onClick={() => onEdit(s.id)}>Edit</button>
              <button class="primary" onClick={() => onRun(s.id)}>Run</button>
              <button
                class="danger"
                onClick={() => {
                  if (confirm(`Delete "${s.name}"?`)) deleteScenario(s.id);
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

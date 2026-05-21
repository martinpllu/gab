import { authState, route } from '../state/signals';
import { LoginScreen } from './LoginScreen';
import { ScenarioListScreen } from './ScenarioListScreen';
import { ScenarioEditScreen } from './ScenarioEditScreen';
import { ScenarioRunScreen } from './ScenarioRunScreen';

export function App() {
  if (authState.value.kind === 'anonymous') {
    return <LoginScreen />;
  }
  switch (route.value) {
    case 'login':
    case 'list':
      return <ScenarioListScreen />;
    case 'edit':
      return <ScenarioEditScreen />;
    case 'run':
      return <ScenarioRunScreen />;
  }
}

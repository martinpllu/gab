import { authState, route } from '../state/signals';
import { LoginScreen } from './LoginScreen';
import { ChatListScreen } from './ChatListScreen';
import { ChatRunScreen } from './ChatRunScreen';
import { RunsListScreen } from './RunsListScreen';

export function App() {
  if (authState.value.kind === 'anonymous') {
    return <LoginScreen />;
  }
  switch (route.value.kind) {
    case 'login':
    case 'list':
      return <ChatListScreen />;
    case 'runs':
      return <RunsListScreen />;
    case 'run':
      return <ChatRunScreen />;
  }
}

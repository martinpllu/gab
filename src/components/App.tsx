import { authState, route } from '../state/signals';
import { LoginScreen } from './LoginScreen';
import { ChatListScreen } from './ChatListScreen';
import { ChatEditScreen } from './ChatEditScreen';
import { ChatRunScreen } from './ChatRunScreen';

export function App() {
  if (authState.value.kind === 'anonymous') {
    return <LoginScreen />;
  }
  switch (route.value) {
    case 'login':
    case 'list':
      return <ChatListScreen />;
    case 'edit':
      return <ChatEditScreen />;
    case 'run':
      return <ChatRunScreen />;
  }
}

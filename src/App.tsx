import type { ReactElement } from 'react';
import { ChatInterface } from './components/ChatInterface';

/** 应用根组件，仅负责挂载聊天界面。 */
export function App(): ReactElement {
  return <ChatInterface />;
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('页面根节点 #root 不存在，请检查 index.html。');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

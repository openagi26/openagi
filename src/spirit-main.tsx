/**
 * 小星（Spirit）浮窗入口
 * 独立渲染进程（renderer process），加载 Spirit 组件
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Spirit } from './pages/Spirit';

const container = document.getElementById('spirit-root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Spirit />
    </StrictMode>
  );
}

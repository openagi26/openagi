/**
 * Main Layout Component
 * TitleBar at top, then sidebar + content below.
 */
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

export function MainLayout() {
  return (
    <div data-testid="main-layout" className="flex h-screen flex-col overflow-hidden bg-transparent">
      {/* 标题栏：macOS 玻璃拖拽区域 */}
      <TitleBar />

      {/* 主体区域：玻璃侧边栏 + 内容 */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main data-testid="main-content" className="glass flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

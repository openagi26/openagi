/**
 * OpenAGI WebView 内嵌组件
 * 将 OpenAGI 控制台页面嵌入 OpenAGI 主窗口，注入星空紫主题
 */
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { useGatewayStore } from '@/stores/gateway';
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';

interface OpenClawEmbedProps {
  /** OpenAGI 路由路径，如 '/agents', '/skills', '/channels' */
  path: string;
  /** 页面标题 */
  title?: string;
}

/** 星空紫主题 CSS，注入到 OpenAGI WebView */
const GALAXY_PURPLE_CSS = `
  /* === OpenAGI 星空紫主题覆盖 === */
  :root {
    --oc-bg: rgba(15, 5, 30, 0.85) !important;
    --oc-surface: rgba(124, 58, 237, 0.08) !important;
    --oc-border: rgba(139, 92, 246, 0.2) !important;
    --oc-text: rgba(255, 255, 255, 0.9) !important;
    --oc-text-muted: rgba(255, 255, 255, 0.5) !important;
    --oc-accent: #a855f7 !important;
    --oc-accent-hover: #c084fc !important;
  }

  /* 隐藏 OpenAGI 自己的导航栏（由 OpenAGI 侧栏接管） */
  nav, .sidebar, .nav-sidebar, [data-nav], .navigation,
  header.topbar, .top-bar, .topnav {
    display: none !important;
  }

  /* 全局背景透明化 */
  body, html, .app, .main, .content, .page, #app {
    background: transparent !important;
    color: var(--oc-text) !important;
  }

  /* 卡片容器玻璃化 */
  .card, .panel, .section, .box, .container,
  [class*="card"], [class*="panel"], [class*="section"] {
    background: var(--oc-surface) !important;
    border-color: var(--oc-border) !important;
    backdrop-filter: blur(20px) !important;
    -webkit-backdrop-filter: blur(20px) !important;
    border-radius: 12px !important;
  }

  /* 按钮星空紫化 */
  button[class*="primary"], .btn-primary, [class*="action-btn"],
  button.primary {
    background: linear-gradient(135deg, #7c3aed, #a855f7) !important;
    color: white !important;
    border: 1px solid rgba(168, 85, 247, 0.3) !important;
    border-radius: 10px !important;
  }

  button[class*="primary"]:hover, .btn-primary:hover {
    background: linear-gradient(135deg, #6d28d9, #9333ea) !important;
  }

  /* 输入框样式 */
  input, textarea, select, [class*="input"], [class*="textarea"] {
    background: rgba(0, 0, 0, 0.2) !important;
    border-color: var(--oc-border) !important;
    color: var(--oc-text) !important;
    border-radius: 8px !important;
  }

  input:focus, textarea:focus, select:focus {
    border-color: #a855f7 !important;
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2) !important;
  }

  /* 表格样式 */
  table, th, td {
    border-color: var(--oc-border) !important;
  }

  th {
    background: rgba(124, 58, 237, 0.1) !important;
  }

  tr:hover td {
    background: rgba(124, 58, 237, 0.05) !important;
  }

  /* 标签页 */
  [class*="tab"][class*="active"], [aria-selected="true"] {
    border-color: #a855f7 !important;
    color: #c084fc !important;
  }

  /* 状态标记 */
  [class*="badge"], [class*="tag"], [class*="chip"] {
    background: rgba(124, 58, 237, 0.15) !important;
    border-color: rgba(168, 85, 247, 0.3) !important;
    color: #c084fc !important;
  }

  /* 滚动条 */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.3); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(139, 92, 246, 0.5); }

  /* 链接颜色 */
  a { color: #c084fc !important; }
  a:hover { color: #e9d5ff !important; }

  /* 代码块 */
  pre, code, [class*="code"] {
    background: rgba(0, 0, 0, 0.3) !important;
    border-color: var(--oc-border) !important;
  }

  /* 开关/切换 */
  [class*="toggle"][class*="on"], [class*="switch"][class*="checked"],
  input[type="checkbox"]:checked + * {
    background: #7c3aed !important;
  }
`;

export function OpenClawEmbed({ path, title }: OpenClawEmbedProps) {
  const webviewRef = useRef<HTMLWebViewElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const gatewayStatus = useGatewayStore((s) => s.status);

  // 获取 OpenAGI 控制台 URL
  useEffect(() => {
    (async () => {
      try {
        const result = await hostApiFetch<{
          success: boolean;
          url?: string;
          token?: string;
          port?: number;
        }>('/api/gateway/control-ui');
        if (result.success && result.url) {
          // 拼接路径
          const baseUrl = result.url.replace(/\/$/, '');
          setUrl(`${baseUrl}${path}`);
          setError(null);
        } else {
          setError('网关未就绪');
        }
      } catch {
        setError('无法连接到网关');
      }
    })();
  }, [path, gatewayStatus]);

  // WebView 加载完成后注入紫色主题
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !url) return;

    const handleDidFinishLoad = () => {
      setLoading(false);
      // 注入星空紫主题 CSS
      (webview as any).executeJavaScript(`
        (function() {
          const style = document.createElement('style');
          style.id = 'openagi-galaxy-purple';
          style.textContent = ${JSON.stringify(GALAXY_PURPLE_CSS)};
          document.head.appendChild(style);
          // 设置 body 背景透明
          document.body.style.background = 'transparent';
          document.documentElement.style.background = 'transparent';
        })();
      `).catch(() => {});
    };

    const handleDidFailLoad = () => {
      setLoading(false);
      setError('页面加载失败，请检查网关是否运行');
    };

    webview.addEventListener('did-finish-load', handleDidFinishLoad);
    webview.addEventListener('did-fail-load', handleDidFailLoad);

    return () => {
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      webview.removeEventListener('did-fail-load', handleDidFailLoad);
    };
  }, [url]);

  const handleRefresh = () => {
    const webview = webviewRef.current;
    if (webview) {
      setLoading(true);
      (webview as any).reload();
    }
  };

  const handleOpenExternal = async () => {
    if (url) {
      await invokeIpc('shell:openExternal', url);
    }
  };

  // 网关未连接
  if (gatewayStatus.state !== 'running' && !url) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-16 h-16 rounded-2xl glass-card-purple flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
        <p className="text-foreground/60">正在等待网关连接...</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <p className="text-foreground/60">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); }}
          className="text-purple-400 hover:text-purple-300 text-sm underline"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-[rgba(15,5,30,0.95)]' : ''}`}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 glass-card-purple rounded-t-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-medium text-sm">{title || 'OpenAGI'}</span>
          {loading && (
            <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleRefresh} className="p-1.5 rounded-lg hover:bg-white/5 text-foreground/40 hover:text-foreground/70" title="刷新">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleOpenExternal} className="p-1.5 rounded-lg hover:bg-white/5 text-foreground/40 hover:text-foreground/70" title="在浏览器中打开">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-lg hover:bg-white/5 text-foreground/40 hover:text-foreground/70" title="全屏">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* WebView */}
      <div className="flex-1 relative rounded-b-xl overflow-hidden">
        {url && (
          <webview
            ref={webviewRef as any}
            src={url}
            className="w-full h-full"
            style={{ background: 'transparent' }}
            // @ts-expect-error - Electron webview attributes
            allowpopups="true"
            // @ts-expect-error - Electron webview attributes
            nodeintegration="false"
          />
        )}

        {/* 加载遮罩 */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center glass-card-purple">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
              <span className="text-sm text-foreground/50">加载中...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

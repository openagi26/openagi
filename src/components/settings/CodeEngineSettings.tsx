/**
 * AI 引擎设置组件
 * 配置 Claude Code 引擎的模型、API Key、工具开关等
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useCodeEngineStore } from '@/stores/code-engine';
import { invokeIpc } from '@/lib/api-client';
import {
  Brain,
  Key,
  Wrench,
  Zap,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

/** Claude Code 引擎支持的模型列表 */
const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', desc: '均衡性能（推荐）' },
  { id: 'claude-opus-4', name: 'Claude Opus 4', desc: '最强推理能力' },
  { id: 'claude-haiku-3.5', name: 'Claude Haiku 3.5', desc: '超快速度' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', desc: '深度思考' },
];

/** 内置工具列表 */
const BUILTIN_TOOLS = [
  { id: 'bash', name: '终端命令', desc: '执行 shell 命令', icon: '💻' },
  { id: 'read_file', name: '读取文件', desc: '读取本地文件内容', icon: '📖' },
  { id: 'write_file', name: '写入文件', desc: '创建或覆盖文件', icon: '✏️' },
  { id: 'edit_file', name: '编辑文件', desc: '精准替换文件内容', icon: '🔧' },
  { id: 'glob', name: '文件搜索', desc: '按模式查找文件', icon: '🔍' },
  { id: 'grep', name: '内容搜索', desc: '搜索文件中的文本', icon: '🔎' },
  { id: 'list_dir', name: '目录列表', desc: '列出目录内容', icon: '📁' },
  { id: 'web_search', name: '网页搜索', desc: '搜索互联网', icon: '🌐' },
  { id: 'web_fetch', name: '网页抓取', desc: '获取网页内容', icon: '📥' },
  { id: 'notebook_edit', name: '笔记本编辑', desc: '编辑 Jupyter 笔记本', icon: '📓' },
  { id: 'todo_write', name: '任务管理', desc: '管理待办事项', icon: '✅' },
  { id: 'agent', name: '子代理', desc: '启动子任务代理', icon: '🤖' },
  { id: 'mcp_tools', name: 'MCP 工具', desc: '外部 MCP 服务器工具', icon: '🔌' },
  { id: 'computer_use', name: '计算机操作', desc: '屏幕截图和操作', icon: '🖥️' },
];

interface EngineConfig {
  enabled: boolean;
  model: string;
  apiKey: string;
  workingDirectory: string;
  maxTurns: number;
  enabledTools: string[];
  maxTokens: number;
  temperature: number;
}

export function CodeEngineSettings() {
  const engineStatus = useCodeEngineStore((s) => s.status);

  const [config, setConfig] = useState<EngineConfig>({
    enabled: true,
    model: 'claude-sonnet-4-6',
    apiKey: '',
    workingDirectory: '~',
    maxTurns: 30,
    enabledTools: BUILTIN_TOOLS.map((t) => t.id),
    maxTokens: 16384,
    temperature: 1.0,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // 从主进程加载配置
  useEffect(() => {
    (async () => {
      try {
        const result = await invokeIpc('code-engine:config');
        if (result) {
          setConfig((prev) => ({ ...prev, ...result }));
        }
      } catch {
        // 使用默认配置
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invokeIpc('code-engine:update-config', config);
      toast.success('AI 引擎配置已保存');
    } catch (error) {
      toast.error(`保存失败: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (toolId: string) => {
    setConfig((prev) => ({
      ...prev,
      enabledTools: prev.enabledTools.includes(toolId)
        ? prev.enabledTools.filter((t) => t !== toolId)
        : [...prev.enabledTools, toolId],
    }));
  };

  const statusColor: Record<string, string> = {
    stopped: 'bg-gray-500',
    starting: 'bg-yellow-500 animate-pulse',
    ready: 'bg-green-500',
    busy: 'bg-purple-500 animate-pulse',
    error: 'bg-red-500',
  };

  const statusText: Record<string, string> = {
    stopped: '已停止',
    starting: '启动中...',
    ready: '就绪',
    busy: '忙碌中...',
    error: '错误',
  };

  return (
    <div className="space-y-8">
      {/* 引擎状态 */}
      <div className="glass-card-purple rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-semibold text-foreground">AI 代码引擎</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${statusColor[engineStatus]}`} />
              <span className="text-sm text-foreground/70">{statusText[engineStatus]}</span>
            </div>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig((p) => ({ ...p, enabled: v }))}
          />
        </div>
        <p className="text-sm text-foreground/60">
          Claude Code 引擎赋予 OpenAGI 代码编写、文件操作、终端命令执行等能力。
          开启后可在对话中直接让 AI 帮你写代码、修改文件、运行脚本。
        </p>
      </div>

      <Separator className="bg-white/10" />

      {/* 模型选择 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">AI 模型</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {AVAILABLE_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setConfig((p) => ({ ...p, model: m.id }))}
              className={`glass-card-purple rounded-lg p-4 text-left transition-all ${
                config.model === m.id
                  ? 'ring-2 ring-purple-500 bg-purple-500/20'
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{m.name}</span>
                {config.model === m.id && (
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                )}
              </div>
              <span className="text-xs text-foreground/50 mt-1">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* API Key */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">API 密钥</h3>
        </div>
        <div className="glass-card-purple rounded-lg p-4">
          <Label className="text-sm text-foreground/70 mb-2 block">
            Anthropic API Key（用于 Claude 模型）
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder="sk-ant-api03-..."
                className="bg-black/20 border-white/10 text-foreground pr-10"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-foreground/40 mt-2">
            密钥仅保存在本地，不会上传到任何服务器。
          </p>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 工作目录 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">工作目录</h3>
        </div>
        <div className="glass-card-purple rounded-lg p-4">
          <Input
            value={config.workingDirectory}
            onChange={(e) => setConfig((p) => ({ ...p, workingDirectory: e.target.value }))}
            placeholder="/Users/yourname/projects"
            className="bg-black/20 border-white/10 text-foreground"
          />
          <p className="text-xs text-foreground/40 mt-2">
            AI 引擎执行命令和操作文件的默认目录。
          </p>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 高级参数 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">高级参数</h3>
        </div>
        <div className="glass-card-purple rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground/80">最大回合数</Label>
              <p className="text-xs text-foreground/40">AI 单次对话最多执行的步骤数</p>
            </div>
            <Input
              type="number"
              value={config.maxTurns}
              onChange={(e) => setConfig((p) => ({ ...p, maxTurns: Number(e.target.value) }))}
              className="w-24 bg-black/20 border-white/10 text-foreground text-center"
              min={1}
              max={100}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground/80">最大输出 Token</Label>
              <p className="text-xs text-foreground/40">AI 每次回复的最大长度</p>
            </div>
            <Input
              type="number"
              value={config.maxTokens}
              onChange={(e) => setConfig((p) => ({ ...p, maxTokens: Number(e.target.value) }))}
              className="w-24 bg-black/20 border-white/10 text-foreground text-center"
              min={256}
              max={65536}
              step={256}
            />
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 工具开关 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-foreground">工具能力</h3>
          </div>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            {config.enabledTools.length}/{BUILTIN_TOOLS.length} 已启用
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {BUILTIN_TOOLS.map((tool) => {
            const enabled = config.enabledTools.includes(tool.id);
            return (
              <button
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                className={`glass-card-purple rounded-lg p-3 flex items-center gap-3 transition-all text-left ${
                  enabled ? 'bg-purple-500/15 ring-1 ring-purple-500/30' : 'opacity-50 hover:opacity-75'
                }`}
              >
                <span className="text-lg">{tool.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{tool.name}</div>
                  <div className="text-xs text-foreground/40 truncate">{tool.desc}</div>
                </div>
                {enabled ? (
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-foreground/20 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-[rgba(15,5,30,0.9)] to-transparent">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-base"
        >
          {saving ? '保存中...' : '💾 保存 AI 引擎配置'}
        </Button>
      </div>
    </div>
  );
}

/**
 * AiMembersSidebar — AI 成员管理面板（OpenTeams 骨架树标准 v2）
 * Section 7：AI成员面板，含团队公告板、状态指示点、预设AI、自定义AI
 */
import { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Plus,
  X,
  AlertCircle,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Megaphone,
  Search,
  Users,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// 常用模型列表
// ---------------------------------------------------------------------------
const MODEL_OPTIONS_ENTRIES = [
  { value: '', labelKey: 'team.defaultModel' },
  { value: 'glm-5.1', label: 'GLM-5.1' },
  { value: 'glm-4-plus', label: 'GLM-4-Plus' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'qwen-max', label: 'Qwen Max' },
] as const;

// ---------------------------------------------------------------------------
// 预设数据
// ---------------------------------------------------------------------------
interface TeamPresetMember {
  name: string;
  role: string;
  model: string;
}

interface TeamPreset {
  id: string;
  name: string;
  category: string;
  members: TeamPresetMember[];
  keywords: string[];
}

interface MemberPreset {
  id: string;
  name: string;
  category: string;
  model: string;
  prompt: string;
}

const TEAM_PRESETS: TeamPreset[] = [
  {
    id: 'fullstack-delivery',
    name: '全栈交付团队',
    category: '开发',
    keywords: ['开发', '网站', 'app', '应用', '代码', '前端', '后端', '程序', '系统', '平台', '工程', 'web', 'website', 'develop', 'code', 'frontend', 'backend', 'software', '电商', '小程序', '接口', 'api'],
    members: [
      { name: 'coordinator', role: '专案经理', model: 'claude-sonnet-4-20250514' },
      { name: 'ux-designer', role: '用户体验/用研', model: 'gpt-4o' },
      { name: 'frontend-dev', role: '前端工程师', model: 'claude-sonnet-4-20250514' },
      { name: 'backend-dev', role: '后端工程师', model: 'claude-sonnet-4-20250514' },
      { name: 'qa-engineer', role: 'QA工程师', model: 'gpt-4o-mini' },
      { name: 'devops', role: 'DevOps工程师', model: 'deepseek-chat' },
    ],
  },
  {
    id: 'content-marketing',
    name: '内容营销团队',
    category: '内容与营销',
    keywords: ['文章', '营销', '内容', '推广', '社媒', '写作', '文案', '品牌', '媒体', '宣传', 'seo', '博客', '新闻稿', '社交', 'marketing', 'content', 'blog', 'brand', 'social', 'copywriting', '种草', '投放', '广告'],
    members: [
      { name: 'content-lead', role: '内容总监', model: 'claude-sonnet-4-20250514' },
      { name: 'copywriter', role: '文案策划', model: 'gpt-4o' },
      { name: 'seo-specialist', role: 'SEO专家', model: 'deepseek-chat' },
      { name: 'social-media', role: '社媒运营', model: 'gpt-4o-mini' },
    ],
  },
  {
    id: 'data-analytics',
    name: '数据分析团队',
    category: '数据与分析',
    keywords: ['数据', '分析', '报告', 'ml', '机器学习', '统计', '指标', '可视化', '预测', '模型', 'ai', '人工智能', 'data', 'analytics', 'analysis', 'report', 'machine learning', 'dashboard', '看板', '爬虫', '挖掘'],
    members: [
      { name: 'data-lead', role: '数据负责人', model: 'claude-sonnet-4-20250514' },
      { name: 'analyst', role: '数据分析师', model: 'gpt-4o' },
      { name: 'ml-engineer', role: 'ML工程师', model: 'deepseek-chat' },
    ],
  },
  {
    id: 'game-dev',
    name: '游戏开发团队',
    category: '游戏开发',
    keywords: ['游戏', '关卡', '角色', 'unity', '引擎', '玩法', '剧情', '像素', '音效', 'game', 'gaming', 'rpg', '手游', '端游', '独立游戏', 'indie'],
    members: [
      { name: 'game-designer', role: '游戏策划', model: 'claude-sonnet-4-20250514' },
      { name: 'unity-dev', role: 'Unity开发', model: 'gpt-4o' },
      { name: 'pixel-artist', role: '美术设计', model: 'gpt-4o' },
      { name: 'sound-designer', role: '音效设计', model: 'gpt-4o-mini' },
      { name: 'qa-tester', role: '测试工程师', model: 'deepseek-chat' },
    ],
  },
];

const MEMBER_PRESETS: MemberPreset[] = [
  { id: 'coder', name: '全栈开发', category: '开发', model: 'claude-sonnet-4-20250514', prompt: '你是一位资深全栈工程师...' },
  { id: 'reviewer', name: '代码审查', category: '开发', model: 'gpt-4o', prompt: '你是代码审查专家...' },
  { id: 'designer', name: 'UI设计师', category: '产品与设计', model: 'gpt-4o', prompt: '你是资深UI/UX设计师...' },
  { id: 'pm', name: '产品经理', category: '产品与设计', model: 'claude-sonnet-4-20250514', prompt: '你是经验丰富的产品经理...' },
  { id: 'writer', name: '技术文档', category: '内容与营销', model: 'gpt-4o-mini', prompt: '你是专业技术文档撰写者...' },
  { id: 'security', name: '安全专家', category: '合规与安全', model: 'claude-sonnet-4-20250514', prompt: '你是网络安全专家...' },
  { id: 'dba', name: '数据库专家', category: '数据与分析', model: 'deepseek-chat', prompt: '你是数据库优化专家...' },
  { id: 'architect', name: '架构师', category: '开发', model: 'claude-sonnet-4-20250514', prompt: '你是资深软件架构师...' },
];

// 分类内部标识符（category identifiers）使用英文，渲染时才映射中文显示文本
const CATEGORY_ALL = 'all';
const CATEGORY_ENTRIES: { id: string; label: string }[] = [
  { id: CATEGORY_ALL, label: '全部' },
  { id: '开发', label: '开发' },
  { id: '产品与设计', label: '产品与设计' },
  { id: '内容与营销', label: '内容与营销' },
  { id: '合规与安全', label: '合规与安全' },
  { id: '数据与分析', label: '数据与分析' },
  { id: '游戏开发', label: '游戏开发' },
  { id: '运营与支持', label: '运营与支持' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AiMembersSidebarProps {
  className?: string;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------
export function AiMembersSidebar({ className, onClose }: AiMembersSidebarProps) {
  const { t } = useTranslation('chat');

  // Store
  const agents = useAgentsStore((s) => s.agents);
  const storeError = useAgentsStore((s) => s.error);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const createAgent = useAgentsStore((s) => s.createAgent);
  const deleteAgent = useAgentsStore((s) => s.deleteAgent);
  const updateAgentModel = useAgentsStore((s) => s.updateAgentModel);
  const updateAgentPrompt = useAgentsStore((s) => s.updateAgentPrompt);
  const getAgentPrompt = useAgentsStore((s) => s.getAgentPrompt);
  const clearError = useAgentsStore((s) => s.clearError);

  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const sending = useChatStore((s) => s.sending);

  // ---------------------------------------------------------------------------
  // 团队公告板状态
  // ---------------------------------------------------------------------------
  const [isBulletinExpanded, setIsBulletinExpanded] = useState(false);
  const [teamProtocol, setTeamProtocol] = useState(t('team.defaultProtocol'));
  const [isProtocolEditing, setIsProtocolEditing] = useState(false);
  const [draftProtocol, setDraftProtocol] = useState('');

  // ---------------------------------------------------------------------------
  // 成员操作状态
  // ---------------------------------------------------------------------------
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 功能4：智能团队推荐（Smart Team Suggester）状态
  // ---------------------------------------------------------------------------
  const [taskDescription, setTaskDescription] = useState('');
  const [suggestions, setSuggestions] = useState<TeamPreset[]>([]);

  // ---------------------------------------------------------------------------
  // 功能1：团队导入预览弹窗（Team Import Preview Modal）状态
  // ---------------------------------------------------------------------------
  const [previewTeam, setPreviewTeam] = useState<TeamPreset | null>(null);
  // 弹窗内每个成员的可编辑字段
  const [previewMembers, setPreviewMembers] = useState<
    { name: string; model: string; role: string }[]
  >([]);
  // 导入进度：null=未导入，数字=已导入数量
  const [importProgress, setImportProgress] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // 功能3：成员编辑模式（Edit Member Mode）状态
  // ---------------------------------------------------------------------------
  // 正在编辑的 agent 信息（null 表示没有编辑中）
  const [editingAgent, setEditingAgent] = useState<{
    id: string;
    name: string;
    model: string;
    prompt: string;
  } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 添加成员面板状态
  // ---------------------------------------------------------------------------
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');

  // 预设 Tab 状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_ALL);
  const [isTeamListExpanded, setIsTeamListExpanded] = useState(true);
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);

  // 自定义 Tab 状态
  const [newName, setNewName] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // 初始化
  // ---------------------------------------------------------------------------
  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  // 自动清除错误
  useEffect(() => {
    if (addError) {
      const t2 = setTimeout(() => setAddError(null), 5000);
      return () => clearTimeout(t2);
    }
  }, [addError]);

  useEffect(() => {
    if (deleteError) {
      const t2 = setTimeout(() => setDeleteError(null), 5000);
      return () => clearTimeout(t2);
    }
  }, [deleteError]);

  useEffect(() => {
    if (modelError) {
      const t2 = setTimeout(() => setModelError(null), 5000);
      return () => clearTimeout(t2);
    }
  }, [modelError]);

  useEffect(() => {
    if (addSuccess) {
      const t2 = setTimeout(() => setAddSuccess(false), 2000);
      return () => clearTimeout(t2);
    }
  }, [addSuccess]);

  // ---------------------------------------------------------------------------
  // 操作函数
  // ---------------------------------------------------------------------------
  const handleDelete = async (agentId: string) => {
    if (deletingId) return;
    setDeletingId(agentId);
    setDeleteError(null);
    try {
      await deleteAgent(agentId);
    } catch (err) {
      clearError();
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteError(msg || t('team.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleModelChange = async (agentId: string, modelRef: string) => {
    setModelError(null);
    try {
      await updateAgentModel(agentId, modelRef || null);
      await fetchAgents();
      setEditingModelId(null);
    } catch (err) {
      clearError();
      const msg = err instanceof Error ? err.message : String(err);
      setModelError(msg || t('team.modelChangeFailed'));
    }
  };

  const handleCustomAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed || isAdding) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await createAgent(trimmed, { systemPrompt: newPrompt.trim() || undefined });
      // 若用户选择了具体模型，创建后立即应用（apply）模型设定
      // updateAgentModel 需要 agentId，先刷新获取最新 agents 列表，再找到新成员
      if (newModel) {
        await fetchAgents();
        const updatedAgents = useAgentsStore.getState().agents;
        const newAgent = updatedAgents.find((a) => a.name === trimmed);
        if (newAgent) {
          await updateAgentModel(newAgent.id, newModel);
        }
      }
      setNewName('');
      setNewModel('');
      setNewPrompt('');
      setAddSuccess(true);
      await fetchAgents();
    } catch (err) {
      clearError();
      const msg = err instanceof Error ? err.message : String(err);
      setAddError(msg || t('team.addFailed'));
    } finally {
      setIsAdding(false);
      inputRef.current?.focus();
    }
  };

  // 功能1：打开预览弹窗（不直接导入）
  const handleImportTeam = (team: TeamPreset) => {
    setPreviewTeam(team);
    setPreviewMembers(team.members.map((m) => ({ name: m.name, model: m.model, role: m.role })));
    setImportProgress(null);
  };

  // 功能1：确认导入（从预览弹窗触发）
  const handleConfirmImport = async () => {
    if (!previewTeam || importProgress !== null) return;
    setImportProgress(0);
    try {
      for (let i = 0; i < previewMembers.length; i++) {
        const member = previewMembers[i];
        await createAgent(member.name, { systemPrompt: member.role?.trim() || undefined });
        // 若模型有选择，创建后立即应用
        if (member.model) {
          await fetchAgents();
          const latestAgents = useAgentsStore.getState().agents;
          const newAgent = latestAgents.find((a) => a.name === member.name);
          if (newAgent) {
            await updateAgentModel(newAgent.id, member.model);
          }
        }
        setImportProgress(i + 1);
      }
      await fetchAgents();
      setAddSuccess(true);
      // 导入完成后短暂延迟再关闭弹窗
      setTimeout(() => {
        setPreviewTeam(null);
        setImportProgress(null);
      }, 1200);
    } catch (err) {
      clearError();
      const msg = err instanceof Error ? err.message : String(err);
      setAddError(msg || t('team.addFailed'));
      setImportProgress(null);
    }
  };

  const handleAddMemberPreset = async (preset: MemberPreset) => {
    if (addingPresetId) return;
    setAddingPresetId(preset.id);
    try {
      await createAgent(preset.name, { systemPrompt: preset.prompt?.trim() || undefined });
      await fetchAgents();
      setAddSuccess(true);
    } catch (err) {
      clearError();
      const msg = err instanceof Error ? err.message : String(err);
      setAddError(msg || t('team.addFailed'));
    } finally {
      setAddingPresetId(null);
    }
  };

  // 功能4：关键词计分匹配，返回匹配度最高的前3个团队
  const suggestTeams = (desc: string): TeamPreset[] => {
    const lower = desc.toLowerCase();
    return TEAM_PRESETS
      .map((team) => ({
        team,
        score: team.keywords.reduce((acc, kw) => acc + (lower.includes(kw.toLowerCase()) ? 1 : 0), 0),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ team }) => team);
  };

  const handleSuggest = () => {
    if (!taskDescription.trim()) return;
    setSuggestions(suggestTeams(taskDescription));
  };

  const handleSaveProtocol = () => {
    setTeamProtocol(draftProtocol);
    setIsProtocolEditing(false);
  };

  // 功能3：打开编辑模式
  const handleOpenEditMember = (agent: { id: string; name: string; modelRef?: string | null }) => {
    setEditingAgent({
      id: agent.id,
      name: agent.name,
      model: agent.modelRef ?? '',
      prompt: '',
    });
    setEditSaveError(null);
    // 切换到自定义Tab并展开面板
    setActiveTab('custom');
    setIsAddMemberOpen(true);
    // 异步读取当前SOUL.md内容并回填
    void getAgentPrompt(agent.id).then((currentPrompt) => {
      setEditingAgent((prev) => prev ? { ...prev, prompt: currentPrompt } : prev);
    });
  };

  // 功能3：保存编辑
  const handleSaveEditMember = async () => {
    if (!editingAgent || isSavingEdit) return;
    setIsSavingEdit(true);
    setEditSaveError(null);
    try {
      await updateAgentModel(editingAgent.id, editingAgent.model || null);
      if (editingAgent.prompt !== undefined) {
        await updateAgentPrompt(editingAgent.id, editingAgent.prompt);
      }
      await fetchAgents();
      setEditingAgent(null);
      setAddSuccess(true);
      setIsAddMemberOpen(false);
    } catch (err) {
      clearError();
      const msg = err instanceof Error ? err.message : String(err);
      setEditSaveError(msg || t('team.modelChangeFailed'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 过滤预设数据
  // ---------------------------------------------------------------------------
  const filteredTeamPresets = TEAM_PRESETS.filter((team) => {
    const matchesCategory = selectedCategory === CATEGORY_ALL || team.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      team.name.toLowerCase().includes(q) ||
      team.category.toLowerCase().includes(q) ||
      team.members.some((m) => m.name.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const filteredMemberPresets = MEMBER_PRESETS.filter((preset) => {
    const matchesCategory = selectedCategory === CATEGORY_ALL || preset.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      preset.name.toLowerCase().includes(q) ||
      preset.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const memberCount = agents.length;

  // ---------------------------------------------------------------------------
  // 渲染：智能团队推荐（功能4）
  // ---------------------------------------------------------------------------
  const renderSmartSuggester = () => (
    <div className="mx-3 mb-2 rounded-lg border border-border bg-card overflow-hidden shrink-0">
      {/* 标题行 */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
        <span className="shrink-0 w-6 h-6 rounded-md bg-violet-500/15 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        </span>
        <span className="flex-1 text-xs font-medium text-foreground">{t('team.smartSuggester')}</span>
      </div>

      {/* 输入区 */}
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={taskDescription}
            onChange={(e) => {
              setTaskDescription(e.target.value);
              if (!e.target.value.trim()) setSuggestions([]);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
            placeholder={t('team.taskDescPlaceholder')}
            className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            className="h-8 text-xs shrink-0 px-3"
            onClick={handleSuggest}
            disabled={!taskDescription.trim()}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {t('team.suggestBtn')}
          </Button>
        </div>

        {/* 推荐结果 */}
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground font-medium">{t('team.suggestedFor')}</p>
            {suggestions.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-violet-200/50 bg-violet-50/30 dark:bg-violet-900/10 dark:border-violet-800/30 px-3 py-2 hover:border-violet-300/70 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0 w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-violet-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{team.name}</p>
                    <p className="text-[10px] text-muted-foreground">{team.members.length} {t('team.membersUnit')}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0 px-2 border-violet-300/50 hover:border-violet-400 hover:bg-violet-50"
                  onClick={() => handleImportTeam(team)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('team.importTeam')}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* 无匹配提示 */}
        {taskDescription.trim() && suggestions.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-1">{t('team.noSuggestion')}</p>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // 渲染：团队公告板
  // ---------------------------------------------------------------------------
  const renderBulletin = () => (
    <div className="mx-3 mb-2 rounded-lg border border-border bg-card overflow-hidden">
      {/* 标题行（可点击） */}
      <button
        onClick={() => setIsBulletinExpanded(!isBulletinExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
        aria-expanded={isBulletinExpanded}
      >
        <span className="shrink-0 w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center">
          <Megaphone className="h-3.5 w-3.5 text-blue-500" />
        </span>
        <span className="flex-1 text-xs font-medium text-foreground">{t('team.bulletinTitle')}</span>
        {isBulletinExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* 展开内容 */}
      {isBulletinExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50">
          {isProtocolEditing ? (
            <div className="pt-2 space-y-2">
              <textarea
                rows={4}
                value={draftProtocol}
                onChange={(e) => setDraftProtocol(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder={t('team.protocolPlaceholder')}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={handleSaveProtocol}>
                  {t('team.save')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  onClick={() => setIsProtocolEditing(false)}
                >
                  {t('team.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {teamProtocol}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs w-full"
                onClick={() => {
                  setDraftProtocol(teamProtocol);
                  setIsProtocolEditing(true);
                }}
              >
                <Pencil className="h-3 w-3 mr-1.5" />
                {t('team.editProtocol')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // 渲染：成员卡片
  // ---------------------------------------------------------------------------
  const renderMemberList = () => (
    <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5 min-h-0">
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed px-4">{t('team.empty')}</p>
        </div>
      ) : (
        agents.map((agent) => {
          const isCurrentAgent = agent.id === currentAgentId;
          const isDeleting = deletingId === agent.id;
          const isEditingModel = editingModelId === agent.id;
          // 功能2：状态点颜色（当前+sending=绿色呼吸灯，当前+idle=蓝色，其他=灰色）
          const stateDotClass = isCurrentAgent && sending
            ? 'bg-green-500 animate-pulse'
            : isCurrentAgent
            ? 'bg-blue-500'
            : 'bg-muted-foreground/30';

          return (
            <div
              key={agent.id}
              className={cn(
                'group relative flex flex-col rounded-lg border transition-all duration-200',
                isCurrentAgent
                  ? 'bg-primary/5 border-primary/20 shadow-sm'
                  : 'bg-transparent border-transparent hover:bg-accent hover:border-border',
              )}
            >
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {/* 功能2：状态指示点（running=绿色呼吸灯，当前idle=蓝色，其他=灰色） */}
                <span
                  className={cn(
                    'absolute left-1.5 top-3.5 w-2 h-2 rounded-full shrink-0',
                    stateDotClass,
                  )}
                  title={isCurrentAgent && sending ? t('team.agentRunning') : t('team.agentIdle')}
                />

                {/* Agent 图标 */}
                <div
                  className={cn(
                    'shrink-0 w-8 h-8 rounded-full flex items-center justify-center ml-1',
                    isCurrentAgent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Bot className="h-4 w-4" />
                </div>

                {/* Agent 信息 */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-xs font-medium truncate',
                      isCurrentAgent ? 'text-foreground' : 'text-foreground/80',
                    )}
                  >
                    @{agent.name}
                  </p>
                  <button
                    onClick={() => setEditingModelId(isEditingModel ? null : agent.id)}
                    title={agent.modelDisplay ?? agent.modelRef ?? t('team.defaultModel')}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
                  >
                    <span className="truncate max-w-[100px]">
                      {agent.modelDisplay ?? agent.modelRef ?? t('team.defaultModel')}
                    </span>
                    <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>

                {/* 当前标记 */}
                {isCurrentAgent && (
                  <span className="shrink-0 text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5 leading-none">
                    {t('team.current')}
                  </span>
                )}

                {/* hover 操作按钮 */}
                <div
                  className={cn(
                    'flex items-center gap-1 shrink-0 transition-opacity duration-150',
                    'opacity-0 group-hover:opacity-100',
                  )}
                >
                  {/* 功能3：编辑按钮 */}
                  <button
                    onClick={() => handleOpenEditMember(agent)}
                    title={t('team.editButton')}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>

                  {!agent.isDefault && (
                    <button
                      onClick={() => void handleDelete(agent.id)}
                      disabled={isDeleting}
                      title={t('team.remove')}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 模型选择下拉 */}
              {isEditingModel && (
                <div className="px-3 pb-2">
                  <select
                    autoFocus
                    defaultValue={agent.modelRef ?? ''}
                    onChange={(e) => void handleModelChange(agent.id, e.target.value)}
                    className="w-full h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {MODEL_OPTIONS_ENTRIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {'labelKey' in opt ? t(opt.labelKey) : opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // 渲染：预设AI Tab
  // ---------------------------------------------------------------------------
  const renderPresetTab = () => (
    <div className="space-y-3">
      {/* 搜索 + 分类筛选 */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('team.searchPlaceholder')}
            className="w-full h-8 rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {CATEGORY_ENTRIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* 搜索无结果 */}
      {searchQuery && filteredTeamPresets.length === 0 && filteredMemberPresets.length === 0 && (
        <div className="text-center py-6 space-y-1">
          <p className="text-xs text-muted-foreground">{t('team.noSearchResults')}</p>
          <p className="text-[11px] text-muted-foreground/60">{t('team.noSearchResultsHint')}</p>
        </div>
      )}

      {/* 团队预设区 */}
      {filteredTeamPresets.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={() => setIsTeamListExpanded(!isTeamListExpanded)}
            className="w-full flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
          >
            <Users className="h-3 w-3" />
            <span>{t('team.teamsLabel')}</span>
            <span className="ml-auto">
              {isTeamListExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          </button>

          {isTeamListExpanded &&
            filteredTeamPresets.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0 w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{team.name}</p>
                    <p className="text-[10px] text-muted-foreground">{team.members.length} {t('team.membersUnit')}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0 px-2"
                  onClick={() => handleImportTeam(team)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('team.importTeam')}
                </Button>
              </div>
            ))}
        </div>
      )}

      {/* 成员预设区 */}
      {filteredMemberPresets.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            <UserPlus className="h-3 w-3" />
            <span>{t('team.membersLabel')}</span>
          </div>

          {filteredMemberPresets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{preset.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{preset.category}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0 px-2"
                disabled={addingPresetId === preset.id}
                onClick={() => void handleAddMemberPreset(preset)}
              >
                {addingPresetId === preset.id ? (
                  <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // 渲染：自定义AI Tab（含功能3编辑模式）
  // ---------------------------------------------------------------------------
  const renderCustomTab = () => {
    // 功能3：编辑模式 UI
    if (editingAgent) {
      return (
        <div className="space-y-3">
          <p className="text-[11px] font-medium text-primary">
            {t('team.editMember', { name: editingAgent.name })}
          </p>

          {/* 名称（只读） */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-foreground/70">{t('team.memberName')}</label>
            <input
              type="text"
              value={editingAgent.name}
              readOnly
              className="w-full h-8 rounded-md border border-input bg-muted px-2.5 text-xs text-foreground/60 cursor-not-allowed"
            />
          </div>

          {/* 模型选择 */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-foreground/70">{t('team.modelSelect')}</label>
            <select
              value={editingAgent.model}
              onChange={(e) => setEditingAgent({ ...editingAgent, model: e.target.value })}
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {MODEL_OPTIONS_ENTRIES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {'labelKey' in opt ? t(opt.labelKey) : opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 角色提示词（编辑模式默认展开） */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-foreground/70">
              {t('team.rolePrompt')}
              <span className="text-muted-foreground/50 ml-1">({t('team.optional')})</span>
            </label>
            <textarea
              rows={3}
              value={editingAgent.prompt}
              onChange={(e) => setEditingAgent({ ...editingAgent, prompt: e.target.value })}
              placeholder={t('team.promptPlaceholder')}
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* 编辑错误提示 */}
          {editSaveError && (
            <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 border border-destructive/20 px-2.5 py-1.5">
              <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
              <p className="text-[11px] text-destructive leading-tight flex-1 break-all">{editSaveError}</p>
              <button onClick={() => setEditSaveError(null)}>
                <X className="h-3 w-3 text-destructive/60 hover:text-destructive" />
              </button>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs flex-1"
              onClick={() => { setEditingAgent(null); setIsAddMemberOpen(false); }}
              disabled={isSavingEdit}
            >
              {t('team.cancel')}
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs flex-1"
              onClick={() => void handleSaveEditMember()}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? (
                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                t('team.saveMember')
              )}
            </Button>
          </div>
        </div>
      );
    }

    // 新建模式 UI（原有逻辑）
    return (
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">{t('team.customHint')}</p>

        {/* 名称输入 */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-foreground/70">{t('team.memberName')}</label>
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleCustomAdd()}
            placeholder={t('team.addPlaceholder')}
            disabled={isAdding}
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {/* 模型选择 */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-foreground/70">{t('team.modelSelect')}</label>
          <select
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {MODEL_OPTIONS_ENTRIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {'labelKey' in opt ? t(opt.labelKey) : opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 角色设定 */}
        <div className="space-y-1">
          <button
            onClick={() => setIsPromptEditorOpen(!isPromptEditorOpen)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            {isPromptEditorOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {t('team.rolePrompt')}
            <span className="text-muted-foreground/50">({t('team.optional')})</span>
          </button>
          {isPromptEditorOpen && (
            <textarea
              rows={3}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder={t('team.promptPlaceholder')}
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          )}
        </div>

        {/* 错误/成功提示 */}
        {addError && (
          <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 border border-destructive/20 px-2.5 py-1.5">
            <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
            <p className="text-[11px] text-destructive leading-tight flex-1 break-all">{addError}</p>
            <button onClick={() => setAddError(null)}>
              <X className="h-3 w-3 text-destructive/60 hover:text-destructive" />
            </button>
          </div>
        )}

        {/* 操作按钮行 */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs flex-1"
            onClick={() => setIsAddMemberOpen(false)}
            disabled={isAdding}
          >
            {t('team.cancel')}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs flex-1"
            onClick={() => void handleCustomAdd()}
            disabled={!newName.trim() || isAdding}
          >
            {isAdding ? (
              <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('team.add')}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // 主渲染
  // ---------------------------------------------------------------------------
  return (
    <div
      className={cn('relative flex flex-col h-full bg-background', className)}
    >
      {/* ------------------------------------------------------------------ */}
      {/* 标题栏                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{t('team.title')}</span>
          {memberCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium leading-none">
              {memberCount}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={t('team.closePanel')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Store 级别错误                                                       */}
      {/* ------------------------------------------------------------------ */}
      {storeError && (
        <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 shrink-0">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="flex-1 text-[11px] text-destructive leading-tight break-all">{storeError}</p>
          <button onClick={clearError} className="shrink-0 text-destructive/60 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 删除 / 模型错误                                                      */}
      {/* ------------------------------------------------------------------ */}
      {(deleteError || modelError) && (
        <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 shrink-0">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="flex-1 text-[11px] text-destructive leading-tight break-all">
            {deleteError ?? modelError}
          </p>
          <button
            onClick={() => { setDeleteError(null); setModelError(null); }}
            className="shrink-0 text-destructive/60 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 团队公告板                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-2 shrink-0">
        {renderBulletin()}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 智能团队推荐（功能4）                                                 */}
      {/* ------------------------------------------------------------------ */}
      {renderSmartSuggester()}

      {/* ------------------------------------------------------------------ */}
      {/* 成员列表（弹性撑开）                                                  */}
      {/* ------------------------------------------------------------------ */}
      {renderMemberList()}

      {/* ------------------------------------------------------------------ */}
      {/* 分隔线                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="shrink-0 border-t border-border mx-3" />

      {/* ------------------------------------------------------------------ */}
      {/* 添加 AI 成员区                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="shrink-0 px-3 py-3">
        {!isAddMemberOpen ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => setIsAddMemberOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('team.addMember')}
          </Button>
        ) : (
          <div className="space-y-3">
            {/* Tab 切换栏（tablist 标签页列表） */}
            <div className="flex gap-1 p-1 rounded-lg bg-muted" role="tablist" aria-label={t('team.title')}>
              <button
                role="tab"
                aria-selected={activeTab === 'preset'}
                onClick={() => setActiveTab('preset')}
                className={cn(
                  'flex-1 h-7 rounded-md text-xs font-medium transition-colors',
                  activeTab === 'preset'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('team.presetTab')}
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'custom'}
                onClick={() => setActiveTab('custom')}
                className={cn(
                  'flex-1 h-7 rounded-md text-xs font-medium transition-colors truncate px-1',
                  activeTab === 'custom'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {/* 功能3：编辑模式时Tab标题显示"编辑 @name" */}
                {editingAgent
                  ? t('team.editMember', { name: editingAgent.name })
                  : t('team.customTab')}
              </button>
            </div>

            {/* 添加成功提示 */}
            {addSuccess && (
              <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 border border-green-500/20 px-2.5 py-1.5">
                <span className="text-[11px] text-green-600 leading-tight">{t('team.addSuccess')}</span>
              </div>
            )}

            {/* Tab 内容 */}
            <div className="max-h-80 overflow-y-auto pr-0.5">
              {activeTab === 'preset' ? renderPresetTab() : renderCustomTab()}
            </div>

            {/* 关闭按钮（预设Tab底部） */}
            {activeTab === 'preset' && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground"
                onClick={() => setIsAddMemberOpen(false)}
              >
                {t('team.close')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 功能1：团队导入预览弹窗（Team Import Preview Modal）                  */}
      {/* ------------------------------------------------------------------ */}
      {previewTeam && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            // 点击背景关闭（导入进行中时禁止）
            if (e.target === e.currentTarget && importProgress === null) {
              setPreviewTeam(null);
            }
          }}
        >
          <div className="w-full max-h-[90%] bg-background border border-border rounded-t-2xl flex flex-col shadow-2xl overflow-hidden">
            {/* 弹窗标题 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {t('team.importPreview')} — {previewTeam.name}
                </span>
              </div>
              {importProgress === null && (
                <button
                  onClick={() => setPreviewTeam(null)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* 成员列表（可滚动） */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {previewMembers.map((member, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-2"
                >
                  {/* 成员名称（可编辑） */}
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => {
                        const next = [...previewMembers];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setPreviewMembers(next);
                      }}
                      disabled={importProgress !== null}
                      className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    />
                  </div>

                  {/* 模型选择 */}
                  <select
                    value={member.model}
                    onChange={(e) => {
                      const next = [...previewMembers];
                      next[idx] = { ...next[idx], model: e.target.value };
                      setPreviewMembers(next);
                    }}
                    disabled={importProgress !== null}
                    className="w-full h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    {MODEL_OPTIONS_ENTRIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {'labelKey' in opt ? t(opt.labelKey) : opt.label}
                      </option>
                    ))}
                  </select>

                  {/* 角色提示词（可编辑） */}
                  <input
                    type="text"
                    value={member.role}
                    onChange={(e) => {
                      const next = [...previewMembers];
                      next[idx] = { ...next[idx], role: e.target.value };
                      setPreviewMembers(next);
                    }}
                    disabled={importProgress !== null}
                    placeholder={t('team.promptPlaceholder')}
                    className="w-full h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  />
                </div>
              ))}
            </div>

            {/* 底部操作区 */}
            <div className="px-4 py-3 border-t border-border space-y-2 shrink-0">
              {/* 导入进度条 */}
              {importProgress !== null && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {importProgress < previewMembers.length
                        ? t('team.importing', {
                            current: importProgress,
                            total: previewMembers.length,
                          })
                        : t('team.importComplete')}
                    </span>
                    <span className="text-[11px] text-primary font-medium">
                      {importProgress}/{previewMembers.length}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: `${(importProgress / previewMembers.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 按钮行 */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex-1"
                  onClick={() => setPreviewTeam(null)}
                  disabled={importProgress !== null}
                >
                  {t('team.cancel')}
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs flex-1"
                  onClick={() => void handleConfirmImport()}
                  disabled={importProgress !== null || previewMembers.length === 0}
                >
                  {importProgress !== null ? (
                    <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    t('team.confirmImport', { count: previewMembers.length })
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 统一意图路由器
 * 自动识别用户意图，将请求分发到 OpenAGI Gateway 或 Claude Code Engine
 */

/** 路由目标 */
export type RouteTarget = 'gateway' | 'code-engine' | 'both';

/** 路由结果 */
export interface RouteResult {
  target: RouteTarget;
  confidence: number; // 0-1 之间的置信度
  reason: string;
}

/** 代码相关关键词（中英文） */
const CODE_KEYWORDS_ZH = [
  '写代码', '编程', '脚本', '函数', '类', '方法', '变量',
  '修改文件', '创建文件', '读取文件', '删除文件',
  '运行', '执行', '编译', '测试', '调试',
  '代码', '程序', '算法', '数据结构',
  '安装依赖', '包管理', 'npm', 'pip', 'cargo',
  '终端', '命令行', 'shell',
  '项目结构', '目录', '文件夹',
  '重构', '优化', '性能',
  'API', '接口', '请求', '响应',
  '数据库', 'SQL', '查询',
  'git', '提交', '分支', '合并',
  '配置文件', 'JSON', 'YAML', 'TOML',
  '错误', 'bug', '异常', '报错',
  '分析代码', '代码审查', '代码检查',
];

const CODE_KEYWORDS_EN = [
  'code', 'script', 'function', 'class', 'method', 'variable',
  'write file', 'create file', 'read file', 'modify file', 'edit file',
  'run', 'execute', 'compile', 'test', 'debug',
  'program', 'algorithm',
  'install', 'npm', 'pip', 'cargo', 'pnpm', 'yarn',
  'terminal', 'command', 'shell', 'bash',
  'refactor', 'optimize', 'performance',
  'api', 'endpoint', 'request', 'response',
  'database', 'sql', 'query',
  'git', 'commit', 'branch', 'merge', 'push', 'pull',
  'config', 'json', 'yaml', 'toml',
  'error', 'bug', 'exception', 'fix',
  'review', 'analyze',
  'python', 'javascript', 'typescript', 'rust', 'java', 'go',
  'react', 'vue', 'node', 'express',
  'dockerfile', 'docker', 'kubernetes',
];

/** 渠道消息关键词 */
const CHANNEL_KEYWORDS_ZH = [
  '发消息', '转发', '回复',
  '微信', '钉钉', '飞书', 'QQ',
  'WhatsApp', 'Telegram', 'Slack', 'Discord',
  '群', '频道', '联系人', '好友',
  '通知', '提醒',
  '语音', '视频', '通话',
];

const CHANNEL_KEYWORDS_EN = [
  'message', 'send', 'forward', 'reply',
  'wechat', 'dingtalk', 'feishu', 'lark',
  'whatsapp', 'telegram', 'slack', 'discord',
  'group', 'channel', 'contact',
  'notification', 'reminder',
  'voice', 'video', 'call',
];

/**
 * 分析用户输入的意图，决定路由目标
 */
export function routeMessage(message: string): RouteResult {
  const lowerMessage = message.toLowerCase();

  // 计算代码相关得分
  let codeScore = 0;
  for (const keyword of CODE_KEYWORDS_ZH) {
    if (message.includes(keyword)) codeScore += 2;
  }
  for (const keyword of CODE_KEYWORDS_EN) {
    if (lowerMessage.includes(keyword)) codeScore += 2;
  }

  // 包含代码块的消息（``` 或行内代码）
  if (message.includes('```') || /`[^`]+`/.test(message)) {
    codeScore += 5;
  }

  // 包含文件路径的消息
  if (/[/\\][\w.-]+\.\w+/.test(message)) {
    codeScore += 3;
  }

  // 计算渠道消息相关得分
  let channelScore = 0;
  for (const keyword of CHANNEL_KEYWORDS_ZH) {
    if (message.includes(keyword)) channelScore += 2;
  }
  for (const keyword of CHANNEL_KEYWORDS_EN) {
    if (lowerMessage.includes(keyword)) channelScore += 2;
  }

  // 决策逻辑
  const totalScore = codeScore + channelScore;

  if (totalScore === 0) {
    // 没有明显意图，默认走 Gateway（通用对话）
    return {
      target: 'gateway',
      confidence: 0.5,
      reason: '无明确意图标记，走通用对话',
    };
  }

  if (codeScore > 0 && channelScore > 0) {
    // 同时有两种意图，走双引擎协作
    return {
      target: 'both',
      confidence: 0.6,
      reason: `混合意图：代码得分${codeScore}，渠道得分${channelScore}`,
    };
  }

  if (codeScore > channelScore) {
    const confidence = Math.min(codeScore / 10, 1);
    return {
      target: 'code-engine',
      confidence,
      reason: `代码相关意图，得分${codeScore}`,
    };
  }

  const confidence = Math.min(channelScore / 10, 1);
  return {
    target: 'gateway',
    confidence,
    reason: `渠道消息意图，得分${channelScore}`,
  };
}

/**
 * 快速判断是否为代码任务
 */
export function isCodeTask(message: string): boolean {
  const result = routeMessage(message);
  return result.target === 'code-engine' || result.target === 'both';
}

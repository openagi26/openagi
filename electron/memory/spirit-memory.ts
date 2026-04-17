/**
 * 小星（Spirit）情感记忆存储层 — W10
 * 存储位置：~/Library/Application Support/openagi-desktop/spirit-memory.json
 * 职责：读写用户事实、记录最后在线时间、生成重逢问候语
 */
import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

/** 单条用户事实（fact） */
export interface UserFact {
  id: number;
  content: string;
  added: string; // ISO 8601 时间字符串
}

/** 记忆文件的完整结构 */
export interface SpiritMemory {
  user_facts: UserFact[];
  last_seen: string | null; // ISO 8601，null 表示首次启动
  conversation_count: number;
}

/** 空记忆模板 */
function emptyMemory(): SpiritMemory {
  return {
    user_facts: [],
    last_seen: null,
    conversation_count: 0,
  };
}

/** 获取记忆文件路径 */
function getMemoryPath(): string {
  // app.getPath('userData') 在 macOS 上返回 ~/Library/Application Support/<appName>
  const userDataDir = app.getPath('userData');
  return join(userDataDir, 'spirit-memory.json');
}

/** 从磁盘加载记忆，不存在则返回空记忆 */
export function loadMemory(): SpiritMemory {
  const filePath = getMemoryPath();
  if (!existsSync(filePath)) {
    return emptyMemory();
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SpiritMemory>;
    return {
      user_facts: parsed.user_facts ?? [],
      last_seen: parsed.last_seen ?? null,
      conversation_count: parsed.conversation_count ?? 0,
    };
  } catch {
    // 文件损坏时重置为空记忆
    return emptyMemory();
  }
}

/** 将记忆写入磁盘 */
export function saveMemory(mem: SpiritMemory): void {
  const filePath = getMemoryPath();
  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(mem, null, 2), 'utf-8');
}

/** 追加一条用户事实（简单字符串包含去重） */
export function addFact(content: string): void {
  const trimmed = content.trim();
  if (!trimmed) return;
  const mem = loadMemory();
  // 简单去重：若已有事实包含这段文字则跳过
  const isDuplicate = mem.user_facts.some(
    (f) => f.content.includes(trimmed) || trimmed.includes(f.content),
  );
  if (isDuplicate) return;
  const nextId = mem.user_facts.length > 0
    ? Math.max(...mem.user_facts.map((f) => f.id)) + 1
    : 1;
  mem.user_facts.push({
    id: nextId,
    content: trimmed,
    added: new Date().toISOString(),
  });
  saveMemory(mem);
}

/** 随机取一条用户事实，若无则返回 null */
export function getRandomFact(): UserFact | null {
  const mem = loadMemory();
  if (mem.user_facts.length === 0) return null;
  const idx = Math.floor(Math.random() * mem.user_facts.length);
  return mem.user_facts[idx]!;
}

/** 更新 last_seen 为当前时间，并递增 conversation_count */
export function touchLastSeen(): void {
  const mem = loadMemory();
  mem.last_seen = new Date().toISOString();
  mem.conversation_count += 1;
  saveMemory(mem);
}

/**
 * 根据距上次在线的时间差，生成重逢问候语
 * 返回值供小星头顶气泡直接展示
 */
export function generateGreeting(): string {
  const mem = loadMemory();

  // 首次启动（从未见过）
  if (!mem.last_seen || mem.user_facts.length === 0) {
    return '你好！我是小星，今天开始陪你～';
  }

  const lastSeenMs = new Date(mem.last_seen).getTime();
  const nowMs = Date.now();
  const diffHours = (nowMs - lastSeenMs) / (1000 * 60 * 60);

  // 距上次 < 1 小时：轻松问候
  if (diffHours < 1) {
    return '你回来啦～';
  }

  // 距上次 >= 6 小时：重逢问候 + 随机一条记忆
  if (diffHours >= 6) {
    const fact = getRandomFact();
    if (fact) {
      return `好久不见！上次你说：${fact.content}，后来怎么样了？`;
    }
    return '好久不见！最近怎么样？';
  }

  // 1 ~ 6 小时之间：简单回归
  return '欢迎回来～';
}

/** 返回当前完整记忆（供调试 / 外部读取） */
export function getMemory(): SpiritMemory {
  return loadMemory();
}

/**
 * 轻量级规则记忆抽取 — W10
 * 从用户消息里提取值得长期记住的事实，无需调 LLM
 * 触发词：我是、我叫、我在、我用、我喜欢、我讨厌、我的工作、今晚、今天、明天
 */
export function extractFactsFromMessage(userMessage: string): string[] {
  const facts: string[] = [];
  const text = userMessage.trim();
  if (!text || text.length < 4) return facts;

  // 规则 1：自我介绍（我是/我叫 + 名字）
  const nameMatch = text.match(/我(?:是|叫)\s*([^\s，,。.！!？?]{1,20})/);
  if (nameMatch?.[1]) {
    facts.push(`用户叫${nameMatch[1]}`);
  }

  // 规则 2：职业 / 工作
  const jobMatch = text.match(/我(?:是|做|在做|的工作是|工作是)\s*([^\s，,。.！!？?]{2,20}(?:工程师|开发者|设计师|产品|运营|创业者|CEO|研究员|学生|老师|医生|律师|程序员|攻城狮))/);
  if (jobMatch?.[1]) {
    facts.push(`用户的工作：${jobMatch[1]}`);
  }

  // 规则 3：工具 / 产品（我用 X 做 Y / 我用 X 来 Y）
  // 支持带空格的工具名，如 "Claude Code"、"VS Code"
  const toolMatch = text.match(/我用\s*(.{2,20}?)(?:\s*(?:做|来|进行|开发|工作|编程|写代码)|[，,。.！!？?\n]|$)/);
  if (toolMatch?.[1]) {
    const toolName = toolMatch[1].trim();
    if (toolName.length >= 2) {
      facts.push(`用户使用：${toolName}`);
    }
  }

  // 规则 4：当前正在做的事情（今晚/今天 + 动词短语）
  const todayMatch = text.match(/(?:今晚|今天|今天晚上)\s*(.{4,30}?)(?:[，,。.！!？?\n]|$)/);
  if (todayMatch?.[1]) {
    facts.push(`${new Date().toLocaleDateString('zh-CN')} 用户说：${todayMatch[1].trim()}`);
  }

  // 规则 5：项目名称（OpenAGI、NewClaw 等专有名词）
  const projectMatch = text.match(/(?:OpenAGI|NewClaw|小星|openclaw|clawx)/i);
  if (projectMatch) {
    const snippet = text.substring(0, 40).replace(/\n/g, ' ');
    if (snippet.length > 8) {
      facts.push(`用户提到了 ${projectMatch[0]}：${snippet}`);
    }
  }

  return facts;
}

/**
 * 从用户消息中提取事实并存储
 * 在 chat:sendWithMedia 成功后异步调用，不阻塞主流程
 */
export function extractAndStoreFacts(userMessage: string): void {
  try {
    const facts = extractFactsFromMessage(userMessage);
    for (const fact of facts) {
      addFact(fact);
    }
  } catch {
    // 记忆抽取失败不影响聊天功能，静默忽略
  }
}

import { create } from 'zustand';
import { AGENT_KEYS, AGENT_MAP, DEFAULT_AGENT, type AgentKey } from '@/lib/agents';
import { createConversation, getMessages, isNuwaxConfigured, streamChat, uploadFile } from '@/lib/nuwax';
import { getDemoReply } from '@/lib/chat/demo';

export interface MsgAttachment {
  key?: string;
  url: string;
  fileName: string;
  mimeType: string;
  /** 本地 objectURL：女娲文件 URL 需鉴权（authRequired）无法直接 <img> 显示，界面用它预览 */
  localUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** 该条消息是否正在流式输出 */
  streaming?: boolean;
  /** 回复结束后的追问建议 */
  followUps?: string[];
  /** 附件（图片/文件） */
  attachments?: MsgAttachment[];
  /** 智能体返回失败终态（如积分不足、工具 AK 有误）：以警示样式呈现，不作为普通回答 */
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  date: string;
  group: string;
}

/** 排队待发送的消息（携带归属智能体，跨 Tab 排队也不会串台） */
export interface PendingSend {
  agent: AgentKey;
  content: string;
  attachments: MsgAttachment[];
}

/** 每个智能体独立的会话画布：消息、会话索引、女娲会话 ID 全部按智能体隔离 */
export interface AgentSlot {
  messages: ChatMessage[];
  conversationId: number | null;
  conversations: Conversation[];
  activeConversationId: string;
}

const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

const welcomeMessage = (agent: AgentKey): ChatMessage => ({
  id: `welcome-${agent}-${Date.now()}`,
  role: 'assistant',
  content: AGENT_MAP[agent].welcome,
  timestamp: now(),
});

/** 各智能体会话画布的初始态（仅含各自欢迎语） */
export const initialSlots = (): Record<AgentKey, AgentSlot> =>
  Object.fromEntries(
    AGENT_KEYS.map((k) => [
      k,
      { messages: [welcomeMessage(k)], conversationId: null, conversations: [], activeConversationId: '' },
    ]),
  ) as unknown as Record<AgentKey, AgentSlot>;

// 流式输出使用的模块级定时器与中断控制器（全局单流：任意时刻只有一个智能体在生成）
let streamTimer: number | undefined;
let thinkTimer: number | undefined;
let nuwaxAbort: AbortController | undefined;
/** 静默超时计时器：每个女娲 SSE 事件（含心跳）都会重置，只在真正无响应时才降级 */
let timeoutTimer: number | undefined;
/** 主动中止标记（停止生成/切换会话/静默超时），避免 catch 把主动中止误判为连接失败二次兜底 */
let requestVersion = 0;
const historyRequests = new Map<AgentKey, AbortController>();

/** 智能体静默超时阈值（毫秒）：以「距上一个 SSE 事件」计时，而非总耗时——诊断类回答真实流式可超 2 分钟 */
const NUWAX_TIMEOUT_MS = 120_000;

const clearTimers = () => {
  if (streamTimer) window.clearInterval(streamTimer);
  if (thinkTimer) window.clearTimeout(thinkTimer);
  if (timeoutTimer) window.clearTimeout(timeoutTimer);
  streamTimer = undefined;
  thinkTimer = undefined;
  timeoutTimer = undefined;
};

const abortNuwax = () => {
  requestVersion += 1;
  nuwaxAbort?.abort();
  nuwaxAbort = undefined;
};

type SetState = (partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)) => void;
type GetState = () => ChatState;

/** 局部更新某个智能体的会话画布，其余画布保持不变 */
const updateSlot = (set: SetState, agent: AgentKey, updater: (slot: AgentSlot) => Partial<AgentSlot>) =>
  set((state) => ({ slots: { ...state.slots, [agent]: { ...state.slots[agent], ...updater(state.slots[agent]) } } }));

// —— 会话索引持久化（按智能体分槽，localStorage） ——
const STORAGE_KEY = 'nz-chat-state-v2';

interface PersistedState {
  activeAgent?: AgentKey;
  agents?: Record<string, { conversations?: Conversation[]; activeConversationId?: string }>;
}

const loadPersisted = (): PersistedState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== 'object' || !parsed.agents) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistState = (state: ChatState) => {
  try {
    const agents = Object.fromEntries(
      AGENT_KEYS.map((k) => [
        k,
        { conversations: state.slots[k].conversations, activeConversationId: state.slots[k].activeConversationId },
      ]),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeAgent: state.activeAgent, agents }));
  } catch {
    /* 存储不可用时静默 */
  }
};

const dateLabel = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
};

// 把女娲历史消息映射为 UI 消息（仅 CHAT / ANSWER，过滤 THINK 与过程输出）
const mapHistory = async (cid: string, signal?: AbortSignal): Promise<ChatMessage[]> => {
  const list = await getMessages(cid, 50, signal);
  return list.map((m, i) => ({
    id: `h-${cid}-${i}`,
    role: m.role,
    content: m.text,
    timestamp: m.time ? new Date(m.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
    attachments: m.attachments.map((a) => ({ key: a.fileKey, url: a.fileUrl, fileName: a.fileName, mimeType: a.mimeType })),
  }));
};

/** 当前回复收尾后，自动发送排队中的队首消息（携带其归属智能体，切过 Tab 也照常投递） */
const flushPending = (set: SetState, get: GetState) => {
  const queue = get().pendingQueue;
  if (!queue.length) return;
  const next = queue[0];
  set({ pendingQueue: queue.slice(1), isThinking: true, status: '', streamingAgent: next.agent });
  if (isNuwaxConfigured) {
  streamNuwaxReply(set, get, next.agent, next.content, next.attachments);
  } else {
    startDemoReply(set, get, next.agent);
  }
};

const startDemoReply = (set: SetState, get: GetState, agent: AgentKey, delay = 850 + Math.random() * 500) => {
  const plan = getDemoReply(agent);
  const replyId = crypto.randomUUID();
  thinkTimer = window.setTimeout(() => {
    updateSlot(set, agent, (slot) => ({
      messages: [...slot.messages, { id: replyId, role: 'assistant', content: '', timestamp: now(), streaming: true }],
    }));
    set({ isThinking: false });
    let cursor = 0;
    streamTimer = window.setInterval(() => {
      cursor += 2 + Math.floor(Math.random() * 4);
      const next = plan.content.slice(0, cursor);
      const done = cursor >= plan.content.length;
      updateSlot(set, agent, (slot) => ({
        messages: slot.messages.map((message) => (
          message.id === replyId
            ? { ...message, content: next, streaming: !done, followUps: done ? plan.followUps : undefined }
            : message
        )),
      }));
      if (done) {
        clearTimers();
        set({ isThinking: false, status: '', streamingAgent: null });
        flushPending(set, get);
      }
    }, 36);
  }, delay);
};

interface ChatState {
  /** 当前激活的智能体（Tab 选中项） */
  activeAgent: AgentKey;
  /** 三个智能体各自独立的会话画布 */
  slots: Record<AgentKey, AgentSlot>;
  isThinking: boolean;
  /** 正在生成的流归属哪个智能体（全局单流；null 表示空闲） */
  streamingAgent: AgentKey | null;
  /** 当前生成阶段的中文进度文案（如「正在检索知识库…」），空串表示无特定阶段 */
  status: string;
  /** 等待当前回复结束后再发送的消息队列（条目携带归属智能体） */
  pendingQueue: PendingSend[];
  /** 会话列表加载中 */
  conversationsLoading: boolean;
  /** 历史消息加载中（切换会话时） */
  messagesLoading: boolean;
  /** 正在上传的附件数量（>0 时禁用发送） */
  uploadingCount: number;
  setActiveAgent: (agent: AgentKey) => void;
  refreshConversations: () => Promise<void>;
  sendMessage: (content: string, attachments?: MsgAttachment[]) => Promise<void>;
  /** 修改某条用户消息：截断该消息及其后的对话，再以新内容重新发送（ChatGPT 式编辑） */
  editUserMessage: (messageId: string, content: string) => Promise<void>;
  stopGeneration: () => void;
  regenerate: () => void;
  newConversation: () => void;
  selectConversation: (id: string) => Promise<void>;
  removeConversation: (id: string) => void;
  uploadAttachment: (file: File) => Promise<MsgAttachment | null>;
}

// 连接女娲智能体：SSE 流式接收回复；失败时降级为本地演示回复；结束后刷新会话列表
const streamNuwaxReply = (
  set: SetState,
  get: GetState,
  agent: AgentKey,
  userText: string,
  userAttachments: MsgAttachment[],
) => {
  const controller = new AbortController();
  nuwaxAbort = controller;
  const version = ++requestVersion;
  const replyId = crypto.randomUUID();
  let started = false;
  let acc = '';
  /** 任一终态处理函数执行过后，catch 不得再二次兜底（否则会把真实内容替换成演示回复） */
  let stopped = false;
  const isCurrent = () => !stopped && version === requestVersion && !controller.signal.aborted;
  const finish = (outputText: string) => {
    if (!isCurrent()) return;
    const content = outputText.trim() ? outputText : acc;
    if (!content) {
      failReply('智能体没有返回正文，请重试。');
      return;
    }
    stopped = true;
    clearTimers();
    controller.abort();
    nuwaxAbort = undefined;
    set({ isThinking: false, status: '', streamingAgent: null });
    updateSlot(set, agent, (slot) => {
      const reply: ChatMessage = { id: replyId, role: 'assistant', content, timestamp: now(), streaming: false, followUps: ['换个角度讲讲', '再详细一点', '下一步做什么？'] };
      return { messages: slot.messages.some((message) => message.id === replyId)
        ? slot.messages.map((message) => message.id === replyId ? reply : message)
        : [...slot.messages, reply] };
    });
    void get().refreshConversations();
    flushPending(set, get);
  };
  const fallbackToDemo = (msg: string) => {
    failReply(`智能体连接失败（${msg}），请重试。`);
  };
  /**
   * 智能体失败终态（积分不足、工具 AK 有误等业务失败）。
   * 与 fallbackToDemo 的区别：不编造演示内容，直接把失败原因以警示态呈现，
   * 避免错误文案被误读成 AI 的正常回答；失败属异常态，清空该智能体的排队消息以防连环失败。
   */
  const failReply = (msg: string) => {
    if (!isCurrent()) return;
    stopped = true;
    clearTimers();
    controller.abort();
    nuwaxAbort = undefined;
    set((state) => ({ isThinking: false, status: '', streamingAgent: null, pendingQueue: state.pendingQueue.filter((q) => q.agent !== agent) }));
    updateSlot(set, agent, (slot) => {
      const exists = slot.messages.some((m) => m.id === replyId);
      const patch = { content: msg, streaming: false, error: true, followUps: undefined };
      return {
        messages: exists
          ? slot.messages.map((m) => (m.id === replyId ? { ...m, ...patch } : m))
          : [...slot.messages, { id: replyId, role: 'assistant' as const, timestamp: now(), ...patch }],
      };
    });
  };
  /**
   * 静默超时/中途断流的诚实收尾：已有真实内容就保留正文并附注中断说明，绝不换成演示回复；
   * 一个字都没出来才转为错误态。失败属异常态，清掉该智能体的排队消息。
   */
  const stopWithNotice = (note: string) => {
    if (!isCurrent()) return;
    stopped = true;
    clearTimers();
    controller.abort();
    nuwaxAbort = undefined;
    set((state) => ({ isThinking: false, status: '', streamingAgent: null, pendingQueue: state.pendingQueue.filter((q) => q.agent !== agent) }));
    updateSlot(set, agent, (slot) => {
      const exists = slot.messages.some((m) => m.id === replyId);
      const content = acc ? `${acc}\n\n> ⚠️ ${note}` : note;
      const patch = { content, streaming: false, error: true, followUps: undefined };
      return {
        messages: exists
          ? slot.messages.map((m) => (m.id === replyId ? { ...m, ...patch } : m))
          : [...slot.messages, { id: replyId, role: 'assistant' as const, timestamp: now(), ...patch }],
      };
    });
  };
  /** 重置静默超时：每收到女娲事件（含心跳）都会调用，只有真正 120s 无响应才降级 */
  const armTimeout = () => {
    if (!isCurrent()) return;
    if (timeoutTimer) window.clearTimeout(timeoutTimer);
    timeoutTimer = window.setTimeout(() => {
      timeoutTimer = undefined;
      stopWithNotice('响应超时：智能体超过 2 分钟没有返回新内容，请稍后重试。');
    }, NUWAX_TIMEOUT_MS);
  };
  armTimeout();
  void (async () => {
    try {
      let cid = get().slots[agent].conversationId;
      if (!cid) {
        cid = await createConversation(AGENT_MAP[agent].id, controller.signal);
        if (!isCurrent()) return;
        updateSlot(set, agent, () => ({ conversationId: cid as number }));
        // 登记会话到该智能体的本地索引：标题取首条消息摘要，历史消息本体按会话 ID 从服务端拉取
        const title = userText.slice(0, 20) || AGENT_MAP[agent].fallbackTitle;
        const nowIso = new Date().toISOString();
        set((state) => {
          const slot = state.slots[agent];
          const conversations = [{ id: String(cid), title, date: dateLabel(nowIso), group: '今天' }, ...slot.conversations];
          return { slots: { ...state.slots, [agent]: { ...slot, conversations, activeConversationId: String(cid) } } };
        });
        persistState(get());
      }
      // 静默超时兜底：每次收到女娲事件都会重置（onActivity），只在真正无响应时降级
      if (!isCurrent()) return;

      await streamChat(cid, userText, userAttachments.filter((a) => a.key).map(({ key, url, fileName, mimeType }) => ({ fileKey: key, fileUrl: url, fileName, mimeType })), {
        signal: controller.signal,
        onActivity: () => armTimeout(),
        onStatus: (status) => { if (isCurrent()) set({ status }); },
        onDelta: (t) => {
          if (!isCurrent()) return;
          acc += t;
          if (!started) {
            started = true;
            // 正文到达：思考阶段结束，清掉进度文案（由消息自身的 streaming 标记接管）
            set({ isThinking: false, status: '' });
            updateSlot(set, agent, (slot) => ({
              messages: [...slot.messages, { id: replyId, role: 'assistant' as const, content: acc, timestamp: now(), streaming: true }],
            }));
            return;
          }
          updateSlot(set, agent, (slot) => ({
            messages: slot.messages.map((m) => (m.id === replyId ? { ...m, content: acc } : m)),
          }));
        },
        onDone: finish,
        onFailed: (msg) => failReply(msg),
        // 中途断流：已有真实正文就保留并注明中断；一个字都没有才降级演示回复
        onError: (msg) => (acc ? stopWithNotice(`连接中断（${msg}），以上为已生成的部分内容`) : fallbackToDemo(msg)),
      });
    } catch (err) {
      if (!isCurrent()) return;
      fallbackToDemo(err instanceof Error ? err.message : '连接失败');
    }
  })();
};

const initialPersisted = loadPersisted();

export const useChatStore = create<ChatState>((set, get) => ({
  activeAgent: (initialPersisted?.activeAgent && initialPersisted.activeAgent in AGENT_MAP ? initialPersisted.activeAgent : DEFAULT_AGENT),
  slots: Object.fromEntries(
    AGENT_KEYS.map((k) => {
      const saved = initialPersisted?.agents?.[k];
      return [
        k,
        {
          messages: [welcomeMessage(k)],
          conversationId: null,
          conversations: saved?.conversations ?? [],
          activeConversationId: saved?.activeConversationId ?? '',
        },
      ];
    }),
  ) as Record<AgentKey, AgentSlot>,
  isThinking: false,
  streamingAgent: null,
  status: '',
  pendingQueue: [],
  conversationsLoading: isNuwaxConfigured,
  messagesLoading: false,
  uploadingCount: 0,

  // 切换智能体：只切视图，不打断其他智能体在途的生成；切换即记住当前 Tab
  setActiveAgent: (agent) => {
    if (agent === get().activeAgent) return;
    set({ activeAgent: agent });
    persistState(get());
  },

  // 会话索引来自本地持久化（女娲 list 接口按用户隔离，API Key 模式查不到；历史消息本体在服务端，按会话 ID 拉取）
  refreshConversations: async () => {
    if (!isNuwaxConfigured) return;
    const saved = loadPersisted();
    if (saved?.agents) {
      set((state) => {
        const slots = { ...state.slots };
        let any = false;
        for (const k of AGENT_KEYS) {
          const a = saved.agents?.[k];
          if (a?.conversations?.length) {
            slots[k] = { ...slots[k], conversations: a.conversations, activeConversationId: a.activeConversationId ?? slots[k].activeConversationId };
            any = true;
          }
        }
        return any ? { slots, conversationsLoading: false } : { conversationsLoading: false };
      });
    } else {
      set({ conversationsLoading: false });
    }
  },

  sendMessage: async (content, attachments = []) => {
    const trimmed = content.trim();
    if (!trimmed && !attachments.length) return;
    if (get().messagesLoading) return;
    if (get().uploadingCount > 0) return;
    if (isNuwaxConfigured && attachments.some((attachment) => !attachment.key)) return;
    const agent = get().activeAgent;
    // 用户消息始终立即上屏（写入当前智能体的画布）
    updateSlot(set, agent, (slot) => ({
      messages: [...slot.messages, { id: `${Date.now()}-user`, role: 'user', content: trimmed, timestamp: now(), attachments: attachments.length ? attachments : undefined }],
    }));
    const generating = get().isThinking || get().streamingAgent !== null;
    if (generating) {
      set((state) => ({ pendingQueue: [...state.pendingQueue, { agent, content: trimmed, attachments }] }));
      return;
    }
    if (isNuwaxConfigured) {
      clearTimers();
      set({ isThinking: true, status: '', streamingAgent: agent });
      streamNuwaxReply(set, get, agent, trimmed, attachments);
      return;
    }
    clearTimers();
    set({ isThinking: true, status: '', streamingAgent: agent });
    startDemoReply(set, get, agent);
  },

  editUserMessage: async (messageId, content) => {
    const agent = get().activeAgent;
    const slot = get().slots[agent];
    const idx = slot.messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const old = slot.messages[idx];
    const trimmed = content.trim();
    if (!trimmed && !old.attachments?.length) return;
    // 截断：该消息及其后的所有回答/追问不再保留，改问即重开这一轮
    updateSlot(set, agent, (s) => ({ messages: s.messages.slice(0, idx) }));
    await get().sendMessage(trimmed, old.attachments ?? []);
  },

  stopGeneration: () => {
    clearTimers();
    abortNuwax();
    set({ isThinking: false, status: '', streamingAgent: null, pendingQueue: [] });
    set((state) => ({
      slots: Object.fromEntries(
        AGENT_KEYS.map((k) => [
          k,
          {
            ...state.slots[k],
            messages: state.slots[k].messages.map((m) =>
              m.streaming ? { ...m, streaming: false, followUps: ['换个角度讲讲', '再详细一点', '下一步做什么？'] } : m,
            ),
          },
        ]),
      ) as Record<AgentKey, AgentSlot>,
    }));
  },

  regenerate: () => {
    if (get().streamingAgent !== null) return;
    const agent = get().activeAgent;
    const slot = get().slots[agent];
    const lastUser = [...slot.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    clearTimers();
    const lastAssistantIdx = slot.messages.map((m) => m.role).lastIndexOf('assistant');
    updateSlot(set, agent, (s) => ({ messages: lastAssistantIdx >= 0 ? s.messages.slice(0, lastAssistantIdx) : s.messages }));
    set({ isThinking: true, streamingAgent: agent });
    if (isNuwaxConfigured) {
      streamNuwaxReply(set, get, agent, lastUser.content, lastUser.attachments ?? []);
      return;
    }
    startDemoReply(set, get, agent, 600);
  },

  // 新对话：仅重置当前智能体的画布；真实模式下会话在首次发送时创建（避免产生空会话）
  newConversation: () => {
    const agent = get().activeAgent;
    historyRequests.get(agent)?.abort();
    historyRequests.delete(agent);
    if (get().streamingAgent === agent) {
      clearTimers();
      abortNuwax();
      set({ isThinking: false, status: '', streamingAgent: null });
    }
    // 清掉该智能体的排队消息，避免幽灵消息投递到新会话
    set((state) => ({ pendingQueue: state.pendingQueue.filter((q) => q.agent !== agent) }));
    updateSlot(set, agent, () => ({
      conversationId: null,
      activeConversationId: '',
      messages: [welcomeMessage(agent)],
    }));
    set({ messagesLoading: false });
  },

  // 切换会话：仅作用于当前智能体；真实模式下拉取该会话的历史消息（失败回落欢迎语）
  selectConversation: async (id) => {
    const agent = get().activeAgent;
    historyRequests.get(agent)?.abort();
    const historyController = new AbortController();
    historyRequests.set(agent, historyController);
    const isCurrentHistory = () => historyRequests.get(agent) === historyController && !historyController.signal.aborted;
    if (get().streamingAgent === agent) {
      clearTimers();
      abortNuwax();
      set({ isThinking: false, status: '', streamingAgent: null });
    }
    set((state) => ({ pendingQueue: state.pendingQueue.filter((q) => q.agent !== agent) }));
    updateSlot(set, agent, () => ({
      activeConversationId: id,
      conversationId: isNuwaxConfigured ? Number(id) : null,
      messages: [{ id: `c-${id}`, role: 'assistant', content: AGENT_MAP[agent].welcome, timestamp: now() }],
    }));
    if (!isNuwaxConfigured) return;
    set({ messagesLoading: true });
    try {
      const history = await mapHistory(id, historyController.signal);
      if (!isCurrentHistory()) return;
      updateSlot(set, agent, () => ({
        messages: history.length ? history : [{ id: `c-${id}`, role: 'assistant', content: AGENT_MAP[agent].welcome, timestamp: now() }],
      }));
      set({ messagesLoading: false });
    } catch {
      if (isCurrentHistory()) set({ messagesLoading: false });
    }
  },

  removeConversation: (id) => {
    const agent = get().activeAgent;
    set((state) => {
      const slot = state.slots[agent];
      const conversations = slot.conversations.filter((c) => c.id !== id);
      return {
        slots: {
          ...state.slots,
          [agent]: { ...slot, conversations, activeConversationId: slot.activeConversationId === id ? '' : slot.activeConversationId },
        },
      };
    });
    persistState(get());
  },

  // 上传附件（拍照/选图），返回女娲文件信息供 sendMessage 携带
  uploadAttachment: async (file: File): Promise<MsgAttachment | null> => {
    if (!isNuwaxConfigured) return null; // 演示模式不上传，仅本地预览
    set((s) => ({ uploadingCount: s.uploadingCount + 1 }));
    try {
      const f = await uploadFile(file);
      return { key: f.key, url: f.url, fileName: f.fileName, mimeType: f.mimeType };
    } catch {
      return null;
    } finally {
      set((s) => ({ uploadingCount: Math.max(0, s.uploadingCount - 1) }));
    }
  },
}));

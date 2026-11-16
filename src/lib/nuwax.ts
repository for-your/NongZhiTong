import { fetchEventSource } from '@microsoft/fetch-event-source';

const BASE_URL = import.meta.env.VITE_NUWAX_BASE_URL || '/nuwax-api';
const MODE = import.meta.env.VITE_NUWAX_MODE === 'real' ? 'real' : 'demo';

/** 是否使用同源真实服务；凭据只由网关读取，浏览器永不持有 API Key。 */
export const isNuwaxConfigured = MODE === 'real';

const nuwaxHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
});

interface NuwaxResponse<T> {
  code: string;
  message: string;
  data: T;
  success: boolean;
}

/** 创建会话（指定智能体），返回 conversationId（见女娲文档 /conversation-create） */
export async function createConversation(agentId: number, signal?: AbortSignal): Promise<number> {
  const res = await fetch(`${BASE_URL}/api/v1/chat/conversation/add`, {
    method: 'POST',
    headers: nuwaxHeaders(),
    body: JSON.stringify({ agentId, devMode: true }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as NuwaxResponse<number>;
  if (!json.success) throw new Error(json.message || '创建会话失败');
  return json.data;
}

export interface UploadedFile {
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
}

/** 上传文件（multipart/form-data），返回 key/url 供对话 attachments 使用（实际端点为 /api/v1/file/upload） */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', 'store');
  const res = await fetch(`${BASE_URL}/api/v1/file/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as NuwaxResponse<UploadedFile>;
  if (!json.success) throw new Error(json.message || '文件上传失败');
  return json.data;
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  text: string;
  time: string;
  attachments: Array<{ fileKey?: string; fileUrl: string; fileName: string; mimeType: string }>;
}

/** 拉取会话历史消息，仅保留用户与助手的 CHAT 消息（过滤 THINK / 过程输出）（见女娲文档 /conversation-messages） */
export async function getMessages(conversationId: string, limit = 50, signal?: AbortSignal): Promise<HistoryMessage[]> {
  const res = await fetch(`${BASE_URL}/api/v1/chat/${conversationId}/messages?limit=${limit}`, {
    headers: nuwaxHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as NuwaxResponse<Array<Record<string, unknown>>>;
  if (!json.success) throw new Error(json.message || '获取消息失败');
  return (json.data || [])
    .filter((m) => (m.type === 'CHAT' || m.type === 'ANSWER') && (m.role === 'USER' || m.role === 'ASSISTANT'))
    .map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      text: (m.text as string) || '',
      time: (m.time as string) || '',
      attachments: ((m.attachments as Array<Record<string, string>>) || []).map((a) => ({
        fileKey: a.fileKey,
        fileUrl: a.fileUrl,
        fileName: a.fileName || '附件',
        mimeType: a.mimeType || '',
      })),
    }));
}

export interface StreamHandlers {
  /** AI 回答增量文本 */
  onDelta: (text: string) => void;
  /** 进入思考阶段（THINK 类型事件） */
  onThinking?: () => void;
  /** 阶段进度更新（PROCESSING 各子类型 / THINK），用于思考态反馈 */
  onStatus?: (status: string) => void;
  /** 流正常结束，outputText 为智能体汇总文本 */
  onDone: (outputText: string) => void;
  /** 智能体明确返回失败终态（积分不足、工具 AK 有误等业务失败），区别于网络中断 */
  onFailed?: (message: string) => void;
  /** 任意 SSE 事件（含心跳）到达——用于重置调用方的静默超时计时器 */
  onActivity?: () => void;
  /** 流式过程中出错 */
  onError: (message: string) => void;
  /** 由调用方持有，用于「停止生成」 */
  signal: AbortSignal;
}

export interface AgentOutputDto {
  eventType?: string;
  completed?: boolean;
  error?: string;
  data?: { text?: string; type?: string; outputText?: string; success?: boolean; error?: string };
}

/** PROCESSING 子类型 → 中文进度文案（用于在思考态给用户反馈当前阶段） */
const PROCESSING_STATUS: Record<string, string> = {
  Knowledge: '正在检索知识库…',
  Plugin: '正在调用插件…',
  ToolCall: '正在执行工具…',
  SandboxStart: '正在启动分析沙箱…',
};

/**
 * 把女娲 SSE 事件映射为进度文案；非阶段事件（心跳/正文/最终结果等）返回 null，
 * 由调用方决定是否保持当前进度或清空。
 */
export function mapStatus(event: AgentOutputDto): string | null {
  if (event.eventType === 'MESSAGE' && event.data?.type === 'THINK') return '正在思考…';
  if (event.eventType === 'PROCESSING') return PROCESSING_STATUS[event.data?.type ?? ''] ?? null;
  return null;
}

/**
 * 判定 FINAL_RESULT 是否为失败终态。
 * 女娲在业务失败时同样会发 FINAL_RESULT，但携带 success:false 与 error，
 * 且 outputText 为 null。若按成功处理，错误文案会被当作正常回答渲染给用户。
 */
export function isFailedResult(event: AgentOutputDto): boolean {
  return event.data?.success === false || Boolean(event.error);
}

/** 向会话发送消息并解析女娲 SSE 事件流（见女娲文档 /conversation-chat） */
export async function streamChat(
  conversationId: number,
  message: string,
  attachments: Array<{ fileKey?: string; fileUrl: string; fileName: string; mimeType: string }>,
  handlers: StreamHandlers,
): Promise<void> {
  let settled = false;
  const abortController = new AbortController();
  const forwardAbort = () => abortController.abort();
  handlers.signal.addEventListener('abort', forwardAbort, { once: true });
  if (handlers.signal.aborted) abortController.abort();
  const fail = (message: string, business = false) => {
    if (settled || handlers.signal.aborted) return;
    settled = true;
    abortController.abort();
    if (business) handlers.onFailed?.(message);
    else handlers.onError(message);
  };

  try {
    await fetchEventSource(`${BASE_URL}/api/v1/chat/${conversationId}`, {
    method: 'POST',
    headers: nuwaxHeaders(),
    body: JSON.stringify({ conversationId, message, ...(attachments.length ? { attachments } : {}) }),
    signal: abortController.signal,
    openWhenHidden: true,
    async onopen(res) {
      if (!res.ok) throw new Error(`女娲服务响应异常（HTTP ${res.status}）`);
      const contentType = res.headers.get('content-type');
      if (contentType && !contentType.includes('text/event-stream')) throw new Error('智能体服务没有返回事件流');
    },
    onmessage(ev) {
      if (settled || handlers.signal.aborted) return;
      handlers.onActivity?.();
      if (!ev.data) return;
      let event: AgentOutputDto;
      try {
        event = JSON.parse(ev.data);
      } catch {
        return; // 忽略无法解析的心跳等片段
      }
      const status = mapStatus(event);
      if (status) handlers.onStatus?.(status);
      switch (event.eventType) {
        case 'MESSAGE':
          if (event.data?.type === 'THINK') {
            handlers.onThinking?.();
            return;
          }
          if (event.data?.text) handlers.onDelta(event.data.text);
          break;
        case 'FINAL_RESULT':
          // 业务失败（如积分不足）也走 FINAL_RESULT，必须与正常完成区分开
          if (isFailedResult(event)) {
            fail(event.error || event.data?.error || '智能体执行失败', true);
            break;
          }
          settled = true;
          abortController.abort();
          handlers.onDone(event.data?.outputText ?? '');
          break;
        case 'ERROR':
          // 智能体侧执行错误属业务失败，走 onFailed；onError 只保留给网络中断
          fail(event.error || event.data?.error || '智能体执行出错', true);
          break;
        default:
          break; // PROCESSING / PROCESSING_MESSAGE / HEART_BEAT 直接忽略
      }
    },
    onclose() {
      fail('连接在收到最终结果前结束');
    },
    onerror(err) {
      fail(err instanceof Error ? err.message : '连接中断');
      throw err; // 抛出以阻止 fetch-event-source 自动重试
    },
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : '连接中断');
  } finally {
    handlers.signal.removeEventListener('abort', forwardAbort);
  }
}

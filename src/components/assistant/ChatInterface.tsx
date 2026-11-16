import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera, FileText, History, Loader2, Plus, SendHorizonal, Square, X,
} from 'lucide-react';
import { AGENT_MAP, type AgentConfig } from '@/lib/agents';
import { isNuwaxConfigured } from '@/lib/nuwax';
import { useChatStore, type MsgAttachment } from '@/store/chatStore';
import ConversationSidebar from './ConversationSidebar';
import MessageBubble from './MessageBubble';

interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
  attachment?: MsgAttachment;
  status: 'uploading' | 'ready' | 'failed';
}

export default function ChatInterface() {
  const {
    slots, activeAgent, isThinking, streamingAgent, status, sendMessage, stopGeneration, regenerate, editUserMessage,
    messagesLoading, uploadingCount, refreshConversations, uploadAttachment,
  } = useChatStore();
  const agent: AgentConfig = AGENT_MAP[activeAgent];
  const messages = slots[activeAgent].messages;
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const composingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // 思考态只在「当前视图的智能体自己在生成」时展示，切到别的智能体看不到别人家的等待动画
  const thinking = isThinking && streamingAgent === activeAgent;
  const streaming = messages.some((m) => m.streaming);
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const lastMessage = messages[messages.length - 1];
  const followUps = lastMessage?.role === 'assistant' && !lastMessage.streaming ? lastMessage.followUps : undefined;
  const canSend = (input.trim().length > 0 || pending.some((p) => p.status === 'ready'))
    && pending.every((p) => p.status === 'ready')
    && !messagesLoading
    && uploadingCount === 0;

  useEffect(() => {
    void refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth', block: 'end' });
  }, [messages, isThinking, streaming]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  // 输入框自动增高，上限约 5 行
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  const uploadPending = async (entry: PendingFile) => {
    setPending((list) => list.map((p) => (p.id === entry.id ? { ...p, status: 'uploading', attachment: undefined } : p)));
    const uploaded = await uploadAttachment(entry.file);
    if (isNuwaxConfigured && !uploaded) {
      setPending((list) => list.map((p) => (p.id === entry.id ? { ...p, status: 'failed', attachment: undefined } : p)));
      return;
    }
    const attachment: MsgAttachment = {
      ...(uploaded ?? { url: '', fileName: entry.file.name, mimeType: entry.file.type }),
      localUrl: entry.previewUrl,
    };
    setPending((list) => list.map((p) => (p.id === entry.id ? { ...p, status: 'ready', attachment } : p)));
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      if (previewUrl) objectUrlsRef.current.add(previewUrl);
      const entry: PendingFile = { id, file, previewUrl, status: 'uploading' };
      setPending((list) => [...list, entry]);
      await uploadPending(entry);
    }
  };

  const submit = () => {
    if (!canSend) return;
    const attachments: MsgAttachment[] = pending
      .filter((p) => p.status === 'ready' && p.attachment)
      .map((p) => p.attachment!);
    void sendMessage(input, attachments);
    setInput('');
    setPending([]);
  };

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-faint bg-surface shadow-md h-[calc(100svh-240px)] min-h-[460px] lg:h-[calc(100svh-260px)] lg:min-h-[480px]">
      {/* 顶部：智能体身份卡（随顶部 Tab 切换：名字、配色、在线状态） */}
      <div className="border-b border-faint bg-surface/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: agent.accent }}>
              <agent.icon className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{agent.name}</p>
              <p className="truncate text-caption text-muted">{isNuwaxConfigured ? '真实接入模式' : '演示模式'} · {agent.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-brand-tint hover:text-brand lg:hidden"
              aria-label="查看对话记录"
            >
              <History className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 消息区：内容限宽 768px 居中（Claude/ChatGPT 同款阅读宽度），超出显得廉价 */}
      <div className="flex-1 overflow-y-auto bg-paper px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {messagesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                showActions={message.id === lastAssistantId && messages.length > 1}
                onRegenerate={regenerate}
                onEdit={editUserMessage}
              />
            ))}

            {thinking && (
              <div className="flex items-end gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: agent.accent }}>
                  <agent.icon className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-2 rounded-xl rounded-bl-sm border border-faint bg-surface px-4 py-3.5">
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:120ms]" />
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:240ms]" />
                  <span className="ml-1 text-caption text-subtle">{status || '思考中…'}</span>
                </div>
              </div>
            )}

            {followUps && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 pl-12">
                <span className="text-caption font-semibold uppercase tracking-[.18em] text-subtle">接着问</span>
                {followUps.map((f) => (
                  <button
                    key={f}
                    onClick={() => sendMessage(f)}
                    className="rounded-full border border-faint bg-surface px-3 py-1.5 text-caption font-medium text-muted transition hover:border-brand-line hover:bg-brand-tint hover:text-brand"
                  >
                    {f}
                  </button>
                ))}
              </motion.div>
            )}
          </>
        )}
        <div ref={endRef} />
        </div>
      </div>

      {/* 输入区 */}
      <div className="border-t border-faint bg-surface/80 p-3 backdrop-blur sm:p-4">
        {/* 附件预览 */}
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((p) => (
              <div key={p.id} className="relative flex items-center gap-2 rounded-xl border border-faint bg-surface py-1.5 pl-1.5 pr-6 shadow-sm">
                {p.previewUrl ? (
                  <img src={p.previewUrl} alt={p.file.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand"><FileText className="h-5 w-5" /></span>
                )}
                <span className="max-w-28 truncate text-caption text-muted">{p.file.name}</span>
                {p.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin text-brand" />}
                {p.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => { void uploadPending(p); }}
                    className="text-caption font-medium text-clay hover:underline"
                    aria-label={`重试上传 ${p.file.name}`}
                  >
                    上传失败，请重试
                  </button>
                )}
                <button
                  onClick={() => {
                    if (p.previewUrl) {
                      URL.revokeObjectURL(p.previewUrl);
                      objectUrlsRef.current.delete(p.previewUrl);
                    }
                    setPending((list) => list.filter((entry) => entry.id !== p.id));
                  }}
                  className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-white"
                  aria-label={`移除附件 ${p.file.name}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-faint bg-surface p-2 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-brand-tint hover:text-brand"
            aria-label="添加附件"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-brand transition hover:bg-brand-tint"
            aria-label="拍照诊断"
            title="拍照诊断"
          >
            <Camera className="h-5 w-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={uploadingCount > 0 ? '附件上传中…' : agent.placeholder}
            className="max-h-32 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-6 outline-none placeholder:text-subtle"
          />
          {(streamingAgent === activeAgent && (thinking || streaming)) ? (
            <button
              onClick={stopGeneration}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white transition hover:bg-black"
              aria-label="停止生成"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : null}
          <button
            onClick={submit}
            disabled={!canSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition enabled:hover:brightness-95 enabled:active:scale-95 disabled:opacity-40"
            aria-label="发送消息"
          >
            {uploadingCount > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-center text-caption text-subtle">
          {isNuwaxConfigured ? '内容由 AI 生成，仅供参考' : '预设演示内容 · 附件仅本地预览，未进行模型识别'} · 重要农事决策请咨询当地农技人员
        </p>

        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {/* 移动端对话记录抽屉 */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col rounded-r-3xl bg-paper p-4 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between px-1">
                <span className="text-caption font-semibold uppercase tracking-[.18em] text-subtle">对话记录</span>
                <button onClick={() => setDrawerOpen(false)} className="rounded-lg px-2 py-1 text-caption font-semibold text-muted hover:bg-brand-tint" aria-label="关闭对话记录">
                  关闭
                </button>
              </div>
              <ConversationSidebar />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

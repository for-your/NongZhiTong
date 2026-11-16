import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Check, Copy, FileText, Pencil, RefreshCw, TriangleAlert, User } from 'lucide-react';
import type { ChatMessage, MsgAttachment } from '@/store/chatStore';
import MarkdownMessage from './MarkdownMessage';

interface Props {
  message: ChatMessage;
  /** 仅最后一条 AI 回复展示操作按钮 */
  showActions?: boolean;
  onRegenerate?: () => void;
  /** 修改用户消息：截断后续对话并以新内容重新发送 */
  onEdit?: (messageId: string, content: string) => void;
}

/** 附件视图：优先本地 objectURL（女娲文件 URL 需鉴权无法 <img> 直显），加载失败降级为文件条 */
function AttachmentView({ a, user }: { a: MsgAttachment; user: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = a.localUrl || a.url;
  if (a.mimeType.startsWith('image/') && src && !broken) {
    return <img src={src} alt={a.fileName} onError={() => setBroken(true)} className="max-h-52 rounded-xl object-cover" />;
  }
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${user ? 'bg-surface/15' : 'bg-brand-tint'}`}>
      <FileText className={`h-4 w-4 shrink-0 ${user ? 'text-white/80' : 'text-brand'}`} />
      <span className="truncate">{a.fileName}</span>
    </div>
  );
}

/**
 * 消息气泡：用户消息为品牌绿气泡（右），支持长文折叠/复制/修改；AI 回复为 flat 全宽文本
 * （左，无气泡边框）——对齐 Claude / ChatGPT 等严肃 AI 产品的做法。
 */
export default function MessageBubble({ message, showActions = false, onRegenerate, onEdit }: Props) {
  const user = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const collapsible = user && !editing && message.content.length > 160;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content.replace(/\*\*/g, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板不可用时静默忽略 */
    }
  };

  const startEdit = () => {
    setDraft(message.content);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!draft.trim()) return;
    setEditing(false);
    onEdit?.(message.id, draft);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`group flex items-start gap-3 ${user ? 'justify-end' : 'justify-start'}`}
    >
      {!user && (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${message.error ? 'bg-clay/10 text-clay' : 'bg-brand-tint text-brand'}`}
        >
          {message.error ? <TriangleAlert className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        </span>
      )}

      <div className={`flex flex-col gap-1.5 ${user ? 'items-end max-w-[86%] sm:max-w-[78%]' : 'w-full min-w-0 items-start'}`}>
        <div className={user ? 'w-fit rounded-xl rounded-br-sm bg-brand px-4 py-3 text-body leading-7 !text-white [&_strong]:text-white' : 'w-full min-w-0 text-body leading-7 text-ink-soft'}>
          {message.attachments && message.attachments.length > 0 && (
            <div className={`mb-2.5 space-y-2 ${user ? '' : 'max-w-md'}`}>
              {message.attachments.map((a, i) => (
                <AttachmentView key={i} a={a} user={user} />
              ))}
            </div>
          )}
          {message.error ? (
            <div className="space-y-2 rounded-lg border border-clay/30 bg-clay/[0.06] px-4 py-3">
              <p className="text-caption font-semibold uppercase tracking-[.16em] text-clay">智能体执行失败</p>
              <MarkdownMessage content={message.content} />
            </div>
          ) : editing ? (
            <div className="min-w-64">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                autoFocus
                className="w-full resize-none bg-transparent text-body leading-7 !text-white outline-none placeholder:text-white/60"
                placeholder="修改你的问题…"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-2.5 py-1 text-caption font-semibold text-white/70 transition hover:bg-white/15 hover:text-white"
                >
                  取消
                </button>
                <button
                  onClick={saveEdit}
                  className="rounded-lg bg-white px-2.5 py-1 text-caption font-bold text-brand transition hover:bg-white/90"
                >
                  发送修改
                </button>
              </div>
            </div>
          ) : user ? (
            <>
              <p className={`whitespace-pre-wrap ${collapsible && !expanded ? 'line-clamp-6' : ''}`}>{message.content}</p>
              {collapsible && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-caption font-semibold text-white/70 underline-offset-2 transition hover:text-white hover:underline"
                >
                  {expanded ? '收起' : '展开全文'}
                </button>
              )}
            </>
          ) : (
            <MarkdownMessage content={message.content} streaming={message.streaming} />
          )}
        </div>

        {/* 操作行：不展示时间；用户=复制/修改，AI=复制/重新生成（hover 显示） */}
        {(user || (showActions && !message.streaming)) && (
          <div className={`flex items-center gap-2 ${user ? 'px-1' : 'pl-12'}`}>
            <span className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 max-sm:opacity-100">
              <button
                onClick={copy}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand"
                aria-label={user ? '复制消息' : '复制回复'}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              {user && onEdit && (
                <button
                  onClick={startEdit}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand"
                  aria-label="修改消息"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {!user && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand"
                  aria-label="重新生成"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </div>
        )}
      </div>

      {user && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold-deep">
          <User className="h-5 w-5" />
        </span>
      )}
    </motion.div>
  );
}

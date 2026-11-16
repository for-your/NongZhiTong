import { useState } from 'react';
import { Loader2, Search, SquarePen, Trash2 } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

/** 对话记录侧栏（DeepSeek 式极简列表）：桌面端常驻，移动端抽屉内复用 */
export default function ConversationSidebar() {
  const { slots, activeAgent, selectConversation, removeConversation, newConversation, conversationsLoading } = useChatStore();
  // 只展示当前智能体自己的会话历史，三个专家互不串台
  const { conversations, activeConversationId } = slots[activeAgent];
  const [keyword, setKeyword] = useState('');

  const groups = ['今天', '昨天', '7 天内', '更早'] as const;
  const filtered = conversations.filter((c) => c.title.includes(keyword.trim()));

  return (
    <div className="flex h-full flex-col">
      {/* 开启新对话：全宽胶囊 */}
      <button
        onClick={newConversation}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-tint py-3 text-sm font-bold text-brand transition hover:bg-brand-tint"
      >
        <SquarePen className="h-4 w-4" />
        开启新对话
      </button>

      {/* 极简搜索：无边框，hover 浮现底色 */}
      <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-brand-tint focus-within:bg-brand-tint">
        <Search className="h-3.5 w-3.5 shrink-0 text-subtle" />
        <input
          id="nz-conversation-search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索对话…"
          className="w-full bg-transparent text-xs text-ink-soft outline-none placeholder:text-subtle"
        />
      </div>

      {/* 会话列表：纯文字极简风，hover 浅底，分组用灰色小字 */}
      <div className="mt-1 flex-1 overflow-y-auto pr-0.5">
        {conversationsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : (
          groups.map((group) => {
            const items = filtered.filter((c) => c.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="mt-3">
                <p className="px-3 pb-1 text-caption font-medium text-subtle">{group}</p>
                {items.map((c) => (
                  <div key={c.id} className="group/item relative">
                    <button
                      onClick={() => void selectConversation(c.id)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                        activeConversationId === c.id ? 'bg-brand-tint' : 'hover:bg-brand-tint'
                      }`}
                    >
                      <p className={`truncate text-sm leading-6 ${activeConversationId === c.id ? 'font-bold text-brand' : 'font-medium text-ink-soft'}`}>
                        {c.title}
                      </p>
                    </button>
                    <button
                      onClick={() => removeConversation(c.id)}
                      className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:bg-clay/10 hover:text-clay group-hover/item:block"
                      aria-label={`删除对话：${c.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })
        )}
        {!conversationsLoading && !filtered.length && (
          <p className="px-3 py-8 text-center text-xs text-subtle">暂无对话记录</p>
        )}
      </div>
    </div>
  );
}

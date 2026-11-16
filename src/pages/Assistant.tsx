import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, Search, SquarePen, Sprout } from 'lucide-react';
import ChatInterface from '@/components/assistant/ChatInterface';
import ConversationSidebar from '@/components/assistant/ConversationSidebar';
import BlurText from '@/components/BlurText';
import PageTransition from '@/components/layout/PageTransition';
import { AGENTS, AGENT_KEYS, AGENT_MAP, type AgentKey } from '@/lib/agents';
import { useChatStore } from '@/store/chatStore';

/** 折叠态窄条：竖排图标（参考 ChatGPT / DeepSeek 折叠样式） */
function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  const newConversation = useChatStore((s) => s.newConversation);
  const item = 'flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-brand-tint hover:text-brand';
  return (
    <div className="flex h-full w-[64px] flex-col items-center gap-2 pt-3">
      <button onClick={onExpand} className={item} aria-label="展开侧边栏" title="展开侧边栏">
        <PanelLeftOpen className="h-5 w-5" />
      </button>
      <button onClick={onExpand} className={item} aria-label="搜索对话" title="搜索对话">
        <Search className="h-5 w-5" />
      </button>
      <button onClick={newConversation} className={`${item} bg-brand-tint text-brand`} aria-label="开启新对话" title="开启新对话">
        <SquarePen className="h-4 w-4" />
      </button>
    </div>
  );
}

/** 三段式智能体切换（Hero 行右侧 Tab）：预警 / 诊断 / 销售，激活项用各自主题色胶囊指示 */
function AgentTabs() {
  const activeAgent = useChatStore((s) => s.activeAgent);
  const setActiveAgent = useChatStore((s) => s.setActiveAgent);
  return (
    <div className="flex justify-center lg:pb-1.5">
      <div className="inline-flex rounded-full border border-faint bg-white p-1.5 shadow-sm">
        {AGENTS.map((a) => {
          const active = a.key === activeAgent;
          return (
            <button
              key={a.key}
              onClick={() => setActiveAgent(a.key)}
              aria-pressed={active}
              className={`relative rounded-full px-4 py-2 text-sm font-bold transition sm:px-5 ${
                active ? 'text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="agent-tab"
                  className="absolute inset-0 rounded-full"
                  style={{ background: a.accent }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <a.icon className="h-4 w-4" />
                {a.shortName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Assistant() {
  // 侧边栏折叠状态（记忆到 localStorage，常见 AI 助手交互）
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('nz-sidebar-collapsed') === '1');
  useEffect(() => {
    localStorage.setItem('nz-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  const activeAgent = useChatStore((s) => s.activeAgent);
  const agent = AGENT_MAP[activeAgent];

  // 首页「我们的行动」等外链 ?agent=warning|diagnosis|sales 预选智能体
  const [searchParams] = useSearchParams();
  const setActiveAgent = useChatStore((s) => s.setActiveAgent);
  useEffect(() => {
    const q = searchParams.get('agent');
    if (q && AGENT_KEYS.includes(q as AgentKey)) setActiveAgent(q as AgentKey);
  }, [searchParams, setActiveAgent]);

  return (
    <PageTransition>
      <main className="min-h-screen bg-paper px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-7xl">
          {/* 紧凑 Hero：标题 + 副标题在左，智能体切换 Tab 并入同省一行高度（对话区多出 ~90px） */}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 lg:mb-5">
            <div>
              {/* 逐字模糊入场（React Bits BlurText）；语义标题保留给读屏 */}
              <h1 className="sr-only">把问题说出来，让答案到田里。</h1>
              <div
                aria-hidden
                className="flex flex-wrap font-display text-h1 font-bold leading-tight tracking-[-.015em]"
              >
                <BlurText text="把问题说出来，" animateBy="letters" delay={70} className="text-ink" />
                <BlurText text="让答案到田里。" animateBy="letters" delay={70} className="text-brand" />
              </div>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted">{agent.tagline}。</p>
            </div>

            {/* 三段式智能体切换 */}
            <AgentTabs />
          </div>

          {/* 工作台三栏：会话列表 + 对话面板 + 专家上下文面板；移动端侧栏收进抽屉 */}
          <div className="flex items-stretch gap-5 lg:gap-6">
            <aside
              className={`hidden shrink-0 overflow-hidden transition-all duration-300 ease-out lg:block ${
                sidebarCollapsed ? 'w-[64px]' : 'w-[280px]'
              }`}
              aria-hidden={sidebarCollapsed}
            >
              {sidebarCollapsed ? (
                <CollapsedRail onExpand={() => setSidebarCollapsed(false)} />
              ) : (
                <div className="flex h-full w-[280px] flex-col p-1.5">
                  {/* 顶行：logo + 搜索 + 收起侧栏（DeepSeek 式） */}
                  <div className="flex items-center justify-between px-2 pb-2 pt-1">
                    <Link to="/" className="flex items-center gap-1.5 text-brand-deep" title="返回首页">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-tint">
                        <Sprout className="h-4 w-4" />
                      </span>
                      <span className="font-display text-[15px] font-bold tracking-[-.01em]">农智通</span>
                    </Link>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => document.getElementById('nz-conversation-search')?.focus()}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand"
                        aria-label="搜索对话"
                        title="搜索对话"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSidebarCollapsed(true)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-brand-tint hover:text-brand"
                        aria-label="收起侧边栏"
                        title="收起侧边栏"
                      >
                        <PanelLeftClose className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <ConversationSidebar />
                </div>
              )}
            </aside>
            <div className="min-w-0 flex-1">
              <ChatInterface />
            </div>
          </div>

          {/* 三项核心能力（随选中智能体切换） */}
          <div className="mt-10 lg:mt-12">
            <p className="text-caption text-muted">{agent.shortName}专家 · 三项核心能力</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {agent.highlights.map((h) => (
                <div key={h.title} className="rounded-xl border border-faint bg-surface p-5 shadow-sm">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: agent.soft, color: agent.accent }}
                  >
                    <h.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3.5 font-display text-[16px] font-bold text-ink">{h.title}</h3>
                  <p className="mt-1.5 text-small leading-6 text-muted">{h.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  );
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialSlots, useChatStore } from '@/store/chatStore';

vi.mock('@/lib/nuwax', () => ({
  isNuwaxConfigured: false,
  createConversation: vi.fn(),
  streamChat: vi.fn(),
  uploadFile: vi.fn(),
  getMessages: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  useChatStore.getState().stopGeneration();
  localStorage.clear();
  useChatStore.setState({ activeAgent: 'diagnosis', slots: initialSlots(), isThinking: false, streamingAgent: null, status: '', pendingQueue: [], uploadingCount: 0 });
});

afterEach(() => {
  useChatStore.getState().stopGeneration();
  vi.useRealTimers();
});

describe('演示模式生命周期', () => {
  it('连续发送共用队列，每条回复都正常收尾', async () => {
    await useChatStore.getState().sendMessage('叶片发黄');
    await useChatStore.getState().sendMessage('需要补充什么信息？');
    expect(useChatStore.getState().pendingQueue).toHaveLength(1);
    await vi.runAllTimersAsync();
    const state = useChatStore.getState();
    const replies = state.slots.diagnosis.messages.filter((message) => message.role === 'assistant' && !message.id.startsWith('welcome-'));
    expect(replies).toHaveLength(2);
    expect(replies.every((message) => message.streaming === false && message.content.length > 0)).toBe(true);
    expect(state.streamingAgent).toBeNull();
    expect(state.pendingQueue).toHaveLength(0);
  });

  it('切换专家排队后不会把诊断演示回答发到销售画布', async () => {
    await useChatStore.getState().sendMessage('叶片发黄');
    useChatStore.getState().setActiveAgent('sales');
    await useChatStore.getState().sendMessage('卖玉米');
    await vi.runAllTimersAsync();
    const replies = useChatStore.getState().slots.sales.messages.filter((message) => message.role === 'assistant');
    expect(replies[replies.length - 1].content).toContain('报价');
  });
});

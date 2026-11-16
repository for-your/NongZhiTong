import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialSlots, useChatStore } from '@/store/chatStore';
import * as nuwax from '@/lib/nuwax';

// 只 mock 网络边界（女娲 HTTP/SSE），store 本身走真实实现
vi.mock('@/lib/nuwax', () => ({
  isNuwaxConfigured: true,
  createConversation: vi.fn(async () => 42),
  streamChat: vi.fn(),
  uploadFile: vi.fn(),
  getMessages: vi.fn(async () => []),
}));

const streamChat = vi.mocked(nuwax.streamChat);

/** 取出最后一次调用 streamChat 时传入的 handlers，用于驱动事件 */
const lastHandlers = () => {
  const calls = streamChat.mock.calls;
  const call = calls[calls.length - 1];
  if (!call) throw new Error('streamChat 未被调用');
  return call[3];
};

/** 取当前智能体画布的最后一条消息（三个智能体各画各的消息） */
const lastMessage = () => {
  const { slots, activeAgent } = useChatStore.getState();
  const msgs = slots[activeAgent].messages;
  return msgs[msgs.length - 1];
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useChatStore.setState({
    activeAgent: 'diagnosis',
    slots: initialSlots(),
    isThinking: false,
    streamingAgent: null,
    status: '',
    pendingQueue: [],
    uploadingCount: 0,
  });
});

describe('聊天请求生命周期', () => {
  it('只有 FINAL_RESULT outputText 时仍创建完整助手消息', async () => {
    streamChat.mockImplementation(async () => {});

    await useChatStore.getState().sendMessage('只返回最终正文');
    lastHandlers().onDone('最终正文');

    const messages = useChatStore.getState().slots.diagnosis.messages;
    expect(messages[messages.length - 1]?.content).toBe('最终正文');
    expect(messages[messages.length - 1]?.streaming).toBe(false);
  });

  it('新对话后旧的 createConversation 结果不能回写', async () => {
    let resolveCreate!: (id: number) => void;
    vi.mocked(nuwax.createConversation).mockImplementationOnce(
      () => new Promise((resolve) => { resolveCreate = resolve; }),
    );
    streamChat.mockImplementation(async () => {});

    await useChatStore.getState().sendMessage('旧对话问题');
    await vi.waitFor(() => expect(resolveCreate).toBeTypeOf('function'));
    useChatStore.getState().newConversation();
    resolveCreate(901);
    await vi.waitFor(() => expect(streamChat).not.toHaveBeenCalled());

    expect(useChatStore.getState().slots.diagnosis.conversationId).toBeNull();
    expect(useChatStore.getState().slots.diagnosis.conversations).toHaveLength(0);
  });

  it('乱序历史响应只提交当前会话', async () => {
    const deferred = new Map<string, (messages: nuwax.HistoryMessage[]) => void>();
    vi.mocked(nuwax.getMessages).mockImplementation(
      (id) => new Promise((resolve) => deferred.set(id, resolve)),
    );

    const first = useChatStore.getState().selectConversation('101');
    const second = useChatStore.getState().selectConversation('202');
    deferred.get('202')?.([{ role: 'assistant', text: '会话 B', time: '', attachments: [] }]);
    await second;
    deferred.get('101')?.([{ role: 'assistant', text: '会话 A', time: '', attachments: [] }]);
    await first;

    expect(useChatStore.getState().slots.diagnosis.activeConversationId).toBe('202');
    const messages = useChatStore.getState().slots.diagnosis.messages;
    expect(messages[messages.length - 1]?.content).toBe('会话 B');
  });
});

describe('附件发送边界', () => {
  it('未成功上传的附件不会创建或发送聊天请求', async () => {
    streamChat.mockImplementation(async () => {});

    await useChatStore.getState().sendMessage('', [{ url: '', fileName: '叶片.png', mimeType: 'image/png' }]);

    expect(streamChat).not.toHaveBeenCalled();
    expect(useChatStore.getState().slots.diagnosis.messages).toHaveLength(1);
  });
});

describe('智能体响应超时兜底', () => {
  it('120 秒静默无响应时，收到诚实的超时错误，而不是演示回复或无限等待', async () => {
    vi.useFakeTimers();
    // 模拟智能体挂起：连接建立后既不吐正文也不给 FINAL_RESULT
    streamChat.mockImplementation(async () => {
      /* 永不 resolve */
    });

    await useChatStore.getState().sendMessage('成都明天适合灌溉吗？');
    expect(useChatStore.getState().isThinking).toBe(true);

    await vi.advanceTimersByTimeAsync(120_000);

    expect(useChatStore.getState().isThinking).toBe(false);
    expect(lastMessage().role).toBe('assistant');
    expect(lastMessage().content).toContain('响应超时');
    expect(lastMessage().content).not.toContain('演示回复'); // 关键：不编造默认回答
    expect(lastMessage().error).toBe(true);
    expect(lastMessage().streaming).toBe(false);
    vi.useRealTimers();
  });

  it('女娲事件（心跳）会重置计时：持续有事件则一直等待，只有真静默 120s 才超时', async () => {
    vi.useFakeTimers();
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('诊断一个耗时很长的问题');

    // 模拟三轮心跳：每 100s 一个事件，均低于 120s 静默阈值
    for (let round = 0; round < 3; round += 1) {
      await vi.advanceTimersByTimeAsync(100_000);
      expect(useChatStore.getState().isThinking).toBe(true); // 事件未断，不降级
      lastHandlers().onActivity?.();
    }

    // 最后一个事件之后彻底静默 120s → 才降级
    await vi.advanceTimersByTimeAsync(120_000);
    expect(useChatStore.getState().isThinking).toBe(false);
    expect(lastMessage().content).toContain('响应超时');
    vi.useRealTimers();
  });

  it('超时前已有真实正文时，保留正文并附中断说明，绝不替换成演示回复', async () => {
    vi.useFakeTimers();
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('明天天气适合打药吗？');

    lastHandlers().onDelta('## 🌧 明天天气概况\n\n明天成都中雨，暂停喷药。');
    expect(lastMessage().streaming).toBe(true);

    await vi.advanceTimersByTimeAsync(120_000);

    const msg = lastMessage();
    expect(msg.content).toContain('明天成都中雨'); // 真实内容还在
    expect(msg.content).toContain('响应超时'); // 附中断说明
    expect(msg.content).not.toContain('演示回复');
    expect(msg.error).toBe(true);
    expect(msg.streaming).toBe(false);
    vi.useRealTimers();
  });

  it('用户停止生成后，拒绝的流不会触发演示回复二次兜底', async () => {
    streamChat.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      throw new DOMException('The user aborted a request.', 'AbortError');
    });
    await useChatStore.getState().sendMessage('第一个问题');
    useChatStore.getState().stopGeneration();

    await new Promise((r) => setTimeout(r, 60)); // 让 AbortError 传播进 catch
    const msgs = useChatStore.getState().slots.diagnosis.messages;
    expect(msgs.some((m) => m.content.includes('演示回复'))).toBe(false);
    expect(useChatStore.getState().isThinking).toBe(false);
  });
});

describe('进度状态 status', () => {
  it('流式期间通过 onStatus 更新进度，正文到达时清空', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起，由测试驱动事件 */
    });
    await useChatStore.getState().sendMessage('玉米叶片发黄怎么办？');

    lastHandlers().onStatus?.('正在检索知识库…');
    expect(useChatStore.getState().status).toBe('正在检索知识库…');

    lastHandlers().onDelta('正文开始');
    expect(useChatStore.getState().status).toBe('');
    expect(useChatStore.getState().isThinking).toBe(false);

    lastHandlers().onDone('完成'); // 收尾清理定时器
  });

  it('正常结束时清空进度', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('最近大豆价格怎么样？');

    lastHandlers().onStatus?.('正在执行工具…');
    expect(useChatStore.getState().status).toBe('正在执行工具…');

    lastHandlers().onDone('最终结果');
    expect(useChatStore.getState().status).toBe('');
  });

  it('出错兜底时清空进度', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('最近大豆价格怎么样？');

    lastHandlers().onStatus?.('正在执行工具…');
    lastHandlers().onError('连接中断');

    expect(useChatStore.getState().status).toBe('');
    expect(lastMessage().content).toContain('连接中断');
  });
});

describe('等待期间发送排队', () => {
  it('isThinking 时发送会入队：用户消息上屏，但不立即发起第二次请求', async () => {
    streamChat.mockImplementation(async () => {
      /* 永不 resolve，保持思考态 */
    });
    await useChatStore.getState().sendMessage('第一个问题');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));
    expect(useChatStore.getState().isThinking).toBe(true);

    await useChatStore.getState().sendMessage('第二个问题');

    const msgs = useChatStore.getState().slots.diagnosis.messages;
    expect(msgs[msgs.length - 1].role).toBe('user');
    expect(msgs[msgs.length - 1].content).toBe('第二个问题');
    expect(streamChat).toHaveBeenCalledTimes(1); // 排队中，未发起第二轮
  });

  it('当前轮结束后自动发送队首消息', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('第一个问题');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));

    await useChatStore.getState().sendMessage('第二个问题'); // 入队
    expect(streamChat).toHaveBeenCalledTimes(1);

    lastHandlers().onDone('第一轮结束');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(2));

    expect(streamChat.mock.calls[1][1]).toBe('第二个问题');
    expect(useChatStore.getState().isThinking).toBe(true);
  });

  it('停止生成会清空排队消息', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('第一个问题');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));

    await useChatStore.getState().sendMessage('第二个问题'); // 入队
    expect(useChatStore.getState().pendingQueue).toHaveLength(1);

    useChatStore.getState().stopGeneration();
    expect(useChatStore.getState().pendingQueue).toHaveLength(0);
    expect(useChatStore.getState().isThinking).toBe(false);
    expect(streamChat).toHaveBeenCalledTimes(1); // 不再自动发送
  });

  it('开新对话会清空排队消息，避免幽灵消息', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('第一个问题');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));

    await useChatStore.getState().sendMessage('第二个问题'); // 入队
    expect(useChatStore.getState().pendingQueue).toHaveLength(1);

    useChatStore.getState().newConversation();
    expect(useChatStore.getState().pendingQueue).toHaveLength(0);
  });
});

describe('智能体失败终态', () => {
  it('onFailed 时气泡标记为错误，不追加推荐问题，也不降级为本地演示回复', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('成都未来三天适合灌溉吗？');

    lastHandlers().onFailed?.('智能体中包含付费模型或工具，你的积分不足以完成扣减');

    const msg = lastMessage();
    expect(msg.role).toBe('assistant');
    expect(msg.error).toBe(true);
    expect(msg.content).toContain('积分不足');
    expect(msg.followUps ?? []).toHaveLength(0); // 关键：错误不该配"接着问"推荐
    expect(msg.streaming).toBe(false);
    expect(useChatStore.getState().isThinking).toBe(false);
    expect(useChatStore.getState().status).toBe('');
  });

  it('失败发生在已有流式正文之后时，该气泡整体转为错误态', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('成都未来三天适合灌溉吗？');

    // 真实链路：错误文案会先作为 CHAT 事件流出，随后才给失败的 FINAL_RESULT
    lastHandlers().onDelta('智能体中包含付费模型或工具');
    lastHandlers().onFailed?.('你的积分不足以完成扣减，请增购积分后继续');

    const msg = lastMessage();
    expect(msg.error).toBe(true);
    expect(msg.content).toContain('积分不足');
    expect(msg.followUps ?? []).toHaveLength(0);
  });

  it('失败后清空排队消息，避免连环失败', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('第一个问题');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));
    await useChatStore.getState().sendMessage('第二个问题'); // 入队
    expect(useChatStore.getState().pendingQueue).toHaveLength(1);

    lastHandlers().onFailed?.('模型执行失败');

    expect(useChatStore.getState().pendingQueue).toHaveLength(0);
    expect(streamChat).toHaveBeenCalledTimes(1); // 未自动发起第二轮
  });
});

describe('多智能体隔离', () => {
  it('消息按智能体分槽：切走后原画布消息不串台', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('诊断问题');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));
    expect(streamChat.mock.calls[0][0]).toBe(42); // createConversation(mock 恒返 42)

    useChatStore.getState().setActiveAgent('warning');
    const warningMsgs = useChatStore.getState().slots.warning.messages;
    expect(warningMsgs).toHaveLength(1); // 预警画布只有欢迎语
    expect(warningMsgs[0].role).toBe('assistant');

    // 预警画布上发言，诊断画布不受影响
    await useChatStore.getState().sendMessage('预警问题');
    expect(useChatStore.getState().pendingQueue).toHaveLength(1); // 全局单流，入队
    const warnMsgs = useChatStore.getState().slots.warning.messages;
    const diagMsgs = useChatStore.getState().slots.diagnosis.messages;
    expect(warnMsgs[warnMsgs.length - 1].content).toBe('预警问题');
    expect(diagMsgs).toHaveLength(2); // 欢迎语 + 诊断问题，无预警消息串台
    expect(diagMsgs[diagMsgs.length - 1].content).toBe('诊断问题');
  });

  it('排队条目按归属智能体投递：预警消息轮到后投给预警会话', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('诊断第一问');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));

    useChatStore.getState().setActiveAgent('warning');
    await useChatStore.getState().sendMessage('预警第一问'); // 入队
    expect(useChatStore.getState().pendingQueue).toHaveLength(1);
    expect(useChatStore.getState().pendingQueue[0].agent).toBe('warning');

    lastHandlers().onDone('第一轮结束');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(2));

    expect(streamChat.mock.calls[1][1]).toBe('预警第一问'); // 投递给预警
    expect(useChatStore.getState().streamingAgent).toBe('warning');
    expect(useChatStore.getState().activeAgent).toBe('warning'); // 视图不被抢走
  });

  it('切走 Tab 不打断在途生成：思考进度继续，但只在归属画布可见', async () => {
    streamChat.mockImplementation(async () => {
      /* 挂起 */
    });
    await useChatStore.getState().sendMessage('诊断问题');
    await vi.waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));

    useChatStore.getState().setActiveAgent('sales');
    expect(useChatStore.getState().isThinking).toBe(true); // 流未被打断
    expect(useChatStore.getState().streamingAgent).toBe('diagnosis');
    expect(useChatStore.getState().slots.sales.messages).toHaveLength(1); // 销售画布干净

    useChatStore.getState().stopGeneration();
    expect(useChatStore.getState().isThinking).toBe(false);
  });
});

describe('回复终态保留', () => {
  it('服务端历史不会延迟覆盖刚流出的完整回答', async () => {
    const serverText = '服务端完整回答'.repeat(10);
    vi.mocked(nuwax.getMessages).mockResolvedValueOnce([
      { role: 'user', text: '第一个问题', time: '', attachments: [] },
      { role: 'assistant', text: serverText, time: '', attachments: [] },
    ]);
    streamChat.mockImplementation(async () => {
      /* 挂起，由测试驱动事件 */
    });
    await useChatStore.getState().sendMessage('第一个问题');
    lastHandlers().onDelta(serverText);
    lastHandlers().onDone(serverText);

    const msgs = useChatStore.getState().slots.diagnosis.messages;
    expect(msgs[0].id.startsWith('welcome-')).toBe(true);
    const ai = msgs.filter((m) => m.role === 'assistant');
    expect(ai[ai.length - 1].content).toBe(serverText);
    expect(ai[ai.length - 1].followUps?.length).toBeGreaterThan(0);
  });
});

describe('修改用户消息', () => {
  it('截断该消息及其后的回答，再以新内容重新发起', async () => {
    streamChat.mockImplementation(async () => { /* 挂起 */ });

    await useChatStore.getState().sendMessage('第一问');
    lastHandlers().onDelta('旧回答内容');
    lastHandlers().onDone('旧回答内容');

    const { slots, activeAgent, editUserMessage } = useChatStore.getState();
    const firstUser = slots[activeAgent].messages.find((m) => m.role === 'user');
    expect(firstUser).toBeTruthy();

    await editUserMessage(firstUser!.id, '修改后的问题');

    const after = useChatStore.getState().slots[activeAgent].messages;
    // 欢迎语保留；第一问与旧回答被截断，只剩以新内容重新发送的用户消息
    expect(after.map((m) => m.role)).toEqual(['assistant', 'user']);
    expect(after[1].content).toBe('修改后的问题');
    expect(after.some((m) => m.content.includes('第一问'))).toBe(false);
    expect(after.some((m) => m.content.includes('旧回答'))).toBe(false);
    expect(streamChat).toHaveBeenCalledTimes(2);
    expect(useChatStore.getState().isThinking).toBe(true);
    lastHandlers().onDone('新回答');
  });

  it('保留原消息附件（含本地预览 localUrl），且只有带 key 的附件才发给模型', async () => {
    streamChat.mockImplementation(async () => { /* 挂起 */ });
    const attachment = { key: 'k1', url: 'https://x/1.png', fileName: '1.png', mimeType: 'image/png', localUrl: 'blob:local' };

    await useChatStore.getState().sendMessage('看这张图', [attachment]);
    lastHandlers().onDelta('识别结果');
    lastHandlers().onDone('识别结果');

    const { slots, activeAgent, editUserMessage } = useChatStore.getState();
    const firstUser = slots[activeAgent].messages.find((m) => m.role === 'user')!;
    await editUserMessage(firstUser.id, '再看看这张');

    const after = useChatStore.getState().slots[activeAgent].messages;
    expect(after[1].attachments?.[0].localUrl).toBe('blob:local');
    // 第二次调用 streamChat 时带 key 的附件仍传给模型
    expect(streamChat.mock.calls[1][2]).toEqual([{ fileKey: 'k1', fileUrl: 'https://x/1.png', fileName: '1.png', mimeType: 'image/png' }]);
    lastHandlers().onDone('完成');
  });

  it('空内容且无附件时不执行截断', async () => {
    streamChat.mockImplementation(async () => { /* 挂起 */ });
    await useChatStore.getState().sendMessage('普通一问');
    lastHandlers().onDone('回答');

    const { slots, activeAgent, editUserMessage } = useChatStore.getState();
    const firstUser = slots[activeAgent].messages.find((m) => m.role === 'user')!;
    await editUserMessage(firstUser.id, '   ');

    const after = useChatStore.getState().slots[activeAgent].messages;
    expect(after).toHaveLength(3); // 原对话与仅终态返回的回答保留
  });
});

describe('历史加载竞态', () => {
  it('新建对话取消历史请求后会清除加载状态', async () => {
    let resolveHistory!: (messages: nuwax.HistoryMessage[]) => void;
    vi.mocked(nuwax.getMessages).mockImplementationOnce(
      () => new Promise((resolve) => { resolveHistory = resolve; }),
    );

    const loading = useChatStore.getState().selectConversation('303');
    await vi.waitFor(() => expect(useChatStore.getState().messagesLoading).toBe(true));

    useChatStore.getState().newConversation();
    expect(useChatStore.getState().messagesLoading).toBe(false);

    resolveHistory([]);
    await loading;
  });

  it('历史加载期间不会发送新消息', async () => {
    let resolveHistory!: (messages: nuwax.HistoryMessage[]) => void;
    vi.mocked(nuwax.getMessages).mockImplementationOnce(
      () => new Promise((resolve) => { resolveHistory = resolve; }),
    );

    const loading = useChatStore.getState().selectConversation('404');
    await vi.waitFor(() => expect(useChatStore.getState().messagesLoading).toBe(true));

    await useChatStore.getState().sendMessage('加载期间的问题');

    expect(streamChat).not.toHaveBeenCalled();
    expect(useChatStore.getState().slots.diagnosis.messages).toHaveLength(1);

    resolveHistory([]);
    await loading;
  });
});

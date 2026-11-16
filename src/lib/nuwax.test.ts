import { describe, expect, it, vi } from 'vitest';
import { isFailedResult, mapStatus, streamChat } from '@/lib/nuwax';

// 捕获 streamChat 注册的 onmessage，用于直接驱动 SSE 事件（只在网络边界打桩）
const { messageHandler, closeHandler } = vi.hoisted(() => ({
  messageHandler: { fn: undefined as undefined | ((ev: { data: string }) => void) },
  closeHandler: { fn: undefined as undefined | (() => void) },
}));

vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn(async (_url: string, opts: { onmessage?: (ev: { data: string }) => void; onclose?: () => void }) => {
    messageHandler.fn = opts.onmessage;
    closeHandler.fn = opts.onclose;
  }),
}));

describe('mapStatus：女娲 SSE 事件 → 进度文案', () => {
  it('思考事件映射为「正在思考…」', () => {
    expect(mapStatus({ eventType: 'MESSAGE', data: { type: 'THINK' } })).toBe('正在思考…');
  });

  it('知识库检索映射为「正在检索知识库…」', () => {
    expect(mapStatus({ eventType: 'PROCESSING', data: { type: 'Knowledge' } })).toBe('正在检索知识库…');
  });

  it('工具调用映射为「正在执行工具…」', () => {
    expect(mapStatus({ eventType: 'PROCESSING', data: { type: 'ToolCall' } })).toBe('正在执行工具…');
  });

  it('沙箱启动映射为「正在启动分析沙箱…」', () => {
    expect(mapStatus({ eventType: 'PROCESSING', data: { type: 'SandboxStart' } })).toBe('正在启动分析沙箱…');
  });

  it('插件调用映射为「正在调用插件…」', () => {
    expect(mapStatus({ eventType: 'PROCESSING', data: { type: 'Plugin' } })).toBe('正在调用插件…');
  });

  it('心跳、最终结果与未知事件返回 null（不更新进度）', () => {
    expect(mapStatus({ eventType: 'HEART_BEAT' })).toBeNull();
    expect(mapStatus({ eventType: 'FINAL_RESULT' })).toBeNull();
    expect(mapStatus({ eventType: 'MESSAGE', data: { type: 'CHAT', text: '正文' } })).toBeNull();
    expect(mapStatus({ eventType: 'PROCESSING', data: { type: 'SomethingElse' } })).toBeNull();
  });
});

describe('isFailedResult：FINAL_RESULT 失败终态判定', () => {
  it('data.success 为 false 时判为失败（如积分不足）', () => {
    expect(isFailedResult({ eventType: 'FINAL_RESULT', data: { success: false, error: '积分不足' } })).toBe(true);
  });

  it('顶层 error 字段存在时判为失败（如工具 AK 有误）', () => {
    expect(isFailedResult({ eventType: 'FINAL_RESULT', error: 'AK有误' })).toBe(true);
  });

  it('success 为 true 且无 error 时判为成功', () => {
    expect(isFailedResult({ eventType: 'FINAL_RESULT', data: { success: true, outputText: '正文' } })).toBe(false);
  });

  it('缺少 success 字段但有 outputText 时按成功处理（兼容旧协议）', () => {
    expect(isFailedResult({ eventType: 'FINAL_RESULT', data: { outputText: '正文' } })).toBe(false);
  });
});

describe('streamChat：失败分流', () => {
  const run = async (payload: Record<string, unknown>) => {
    const onDone = vi.fn();
    const onFailed = vi.fn();
    const onError = vi.fn();
    await streamChat(1, '成都未来三天适合灌溉吗？', [], {
      onDelta: vi.fn(),
      onDone,
      onFailed,
      onError,
      signal: new AbortController().signal,
    });
    messageHandler.fn?.({ data: JSON.stringify(payload) });
    return { onDone, onFailed, onError };
  };

  it('FINAL_RESULT 带 success:false 时走 onFailed，不走 onDone', async () => {
    const { onDone, onFailed } = await run({ eventType: 'FINAL_RESULT', data: { success: false, error: '积分不足' } });
    expect(onFailed).toHaveBeenCalledWith('积分不足');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('独立的 ERROR 事件也走 onFailed（避免被当成网络问题降级为演示回复）', async () => {
    const { onFailed, onError } = await run({ eventType: 'ERROR', error: '工具执行失败' });
    expect(onFailed).toHaveBeenCalledWith('工具执行失败');
    expect(onError).not.toHaveBeenCalled();
  });

  it('正常 FINAL_RESULT 仍走 onDone', async () => {
    const { onDone, onFailed } = await run({ eventType: 'FINAL_RESULT', data: { success: true, outputText: '正文' } });
    expect(onDone).toHaveBeenCalledWith('正文');
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('终态后忽略迟到事件，并且只提交一次终态', async () => {
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onFailed = vi.fn();
    await streamChat(1, '终态之后不应继续写入', [], {
      onDelta,
      onDone,
      onFailed,
      onError: vi.fn(),
      signal: new AbortController().signal,
    });

    const onmessage = messageHandler.fn!;
    onmessage({ data: JSON.stringify({ eventType: 'FINAL_RESULT', data: { outputText: '最终正文' } }) });
    onmessage({ data: JSON.stringify({ eventType: 'MESSAGE', data: { type: 'CHAT', text: '迟到正文' } }) });
    onmessage({ data: JSON.stringify({ eventType: 'FINAL_RESULT', data: { outputText: '第二个终态' } }) });

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('最终正文');
    expect(onDelta).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('连接没有终态就关闭时报告诚实错误', async () => {
    const onError = vi.fn();
    await streamChat(1, '连接中途结束', [], {
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError,
      signal: new AbortController().signal,
    });

    closeHandler.fn?.();

    expect(onError).toHaveBeenCalledWith('连接在收到最终结果前结束');
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoRefresh } from '@/lib/useAutoRefresh';

describe('useAutoRefresh：定时轮询 + 回前台补刷', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('到间隔触发，minGap 内的重复触发被节流，手动刷新强制执行', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useAutoRefresh(cb, 1000, 60_000));

    act(() => vi.advanceTimersByTime(1000));
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(1000)); // 间隔到但未过 minGap → 节流
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => result.current()); // 手动刷新默认强制
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('页面回到前台时补刷，且受 minGap 节流', () => {
    const cb = vi.fn();
    renderHook(() => useAutoRefresh(cb, 300_000, 60_000));

    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => document.dispatchEvent(new Event('visibilitychange'))); // minGap 内 → 节流
    expect(cb).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(60_001);
      document.dispatchEvent(new Event('visibilitychange')); // 过了 minGap → 补刷
    });
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

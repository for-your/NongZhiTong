import { useEffect, useRef } from 'react';

/**
 * 实时刷新：定时轮询 + 页面回到前台时补刷（均带最小间隔节流，避免频繁打上游）。
 * 返回的手动刷新默认强制执行（绕过节流），供「刷新」按钮使用。
 */
export function useAutoRefresh(
  cb: () => void,
  intervalMs: number = 5 * 60_000,
  minGapMs: number = 60_000,
): (force?: boolean) => void {
  const lastRun = useRef(0);
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  const runRef = useRef<(force?: boolean) => void>(() => {});
  runRef.current = (force) => {
    const t = Date.now();
    if (!force && t - lastRun.current < minGapMs) return;
    lastRun.current = t;
    cbRef.current();
  };
  useEffect(() => {
    const tick = () => runRef.current();
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return (force = true) => runRef.current(force);
}

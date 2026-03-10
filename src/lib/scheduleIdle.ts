/**
 * Schedule a non-critical task to run during browser idle time.
 * Falls back to setTimeout(0) if requestIdleCallback is unavailable.
 */
export const scheduleIdle = (task: () => void, timeout = 1500) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as Window & {
      requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback(task, { timeout });
    return;
  }
  (window ?? globalThis).setTimeout(task, 0);
};

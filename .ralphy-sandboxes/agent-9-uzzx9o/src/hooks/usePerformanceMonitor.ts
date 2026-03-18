import { useEffect, useRef, useCallback } from 'react';
import { PerformanceMonitor } from '@/utils/performance';

/**
 * Hook to track component performance
 * @param componentName Unique name for the component
 * @param enabled Whether monitoring is enabled (default: true in DEV, false in PROD unless forced)
 */
export function usePerformanceMonitor(
  componentName: string,
  enabled: boolean = import.meta.env.DEV
) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    if (!enabled) return;

    const now = performance.now();

    if (renderCount.current === 0) {
      PerformanceMonitor.mark(`${componentName}-mount`);
    } else {
      PerformanceMonitor.mark(`${componentName}-update-${renderCount.current}`);
    }

    renderCount.current++;
    lastRenderTime.current = now;
  });

  const trackInteraction = useCallback((interactionName: string, fn: () => void) => {
    if (!enabled) {
      fn();
      return;
    }

    const startMark = `${componentName}-${interactionName}-start`;
    PerformanceMonitor.mark(startMark);

    try {
      fn();
    } finally {
      PerformanceMonitor.measure(
        `${componentName}-${interactionName}`,
        startMark
      );
    }
  }, [componentName, enabled]);

  const trackAsyncInteraction = useCallback(async (interactionName: string, fn: () => Promise<void>) => {
    if (!enabled) {
      await fn();
      return;
    }

    const startMark = `${componentName}-${interactionName}-start`;
    PerformanceMonitor.mark(startMark);

    try {
      await fn();
    } finally {
      PerformanceMonitor.measure(
        `${componentName}-${interactionName}`,
        startMark
      );
    }
  }, [componentName, enabled]);

  return {
    trackInteraction,
    trackAsyncInteraction,
    renderCount: renderCount.current
  };
}

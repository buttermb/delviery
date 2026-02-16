/**
 * Performance Utilities
 * Optimizations for large lists, lazy loading, and render performance
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Debounce hook - delays function execution until after wait milliseconds
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook - limits function calls to once per wait milliseconds
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T {
  const lastCall = useRef(0);
  const lastResult = useRef<ReturnType<T>>();

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        lastResult.current = fn(...args) as ReturnType<T>;
      }
      return lastResult.current;
    }) as T,
    [fn, delay]
  );
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
        ...options,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}

/**
 * Virtual scrolling hook for large lists
 */
export interface VirtualListOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export interface VirtualListResult {
  virtualItems: { index: number; offsetTop: number }[];
  totalHeight: number;
  scrollTo: (index: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function useVirtualList({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 5,
}: VirtualListOptions): VirtualListResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const totalHeight = itemCount * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const virtualItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    virtualItems.push({
      index: i,
      offsetTop: i * itemHeight,
    });
  }

  const scrollTo = useCallback(
    (index: number) => {
      containerRef.current?.scrollTo({
        top: index * itemHeight,
        behavior: 'smooth',
      });
    },
    [itemHeight]
  );

  return {
    virtualItems,
    totalHeight,
    scrollTo,
    containerRef,
  };
}

/**
 * Request idle callback wrapper with fallback
 */
export function requestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  // Fallback for Safari - cast to any to avoid type errors
  return (window as any).setTimeout(callback, options?.timeout || 1);
}

export function cancelIdleCallback(id: number): void {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    (window as any).clearTimeout(id);
  }
}

/**
 * Batch DOM updates for better performance
 */
export function batchUpdates(callback: () => void): void {
  if ('startViewTransition' in document) {
    (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(callback);
  } else {
    callback();
  }
}

/**
 * Memory-efficient image loading
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images in parallel with concurrency limit
 */
export async function preloadImages(
  sources: string[],
  concurrency = 4
): Promise<void> {
  const chunks: string[][] = [];
  for (let i = 0; i < sources.length; i += concurrency) {
    chunks.push(sources.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(preloadImage));
  }
}

/**
 * Measure component render performance
 */
export function measurePerformance(name: string): () => void {
  if (typeof performance === 'undefined') {
    return () => {};
  }
  
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    if (duration > 16) {
      // Log slow renders (> 1 frame at 60fps)
      logger.debug(`[Perf] ${name} took ${duration.toFixed(2)}ms`);
    }
  };
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Network information API wrapper
 */
export function getNetworkInfo(): {
  effectiveType: string;
  saveData: boolean;
  online: boolean;
} {
  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      saveData?: boolean;
    };
  }).connection;

  return {
    effectiveType: connection?.effectiveType || '4g',
    saveData: connection?.saveData || false,
    online: navigator.onLine,
  };
}

/**
 * Adaptive quality based on network conditions
 */
export function getAdaptiveQuality(): 'high' | 'medium' | 'low' {
  const { effectiveType, saveData } = getNetworkInfo();
  
  if (saveData) return 'low';
  
  switch (effectiveType) {
    case '4g':
      return 'high';
    case '3g':
      return 'medium';
    default:
      return 'low';
  }
}


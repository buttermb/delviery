/**
 * Performance Utilities
 * Optimizations for large lists, lazy loading, and render performance
 */

import { useCallback, useRef, useState, useEffect } from 'react';

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
 *
 * Uses View Transitions API when available for smooth visual updates.
 * Automatically falls back to immediate execution in unsupported browsers
 * and respects user's reduced motion preferences.
 *
 * @param callback - Function to execute during the update
 * @param options - Optional configuration
 * @returns Promise that resolves when the transition completes
 *
 * @example
 * ```ts
 * batchUpdates(() => {
 *   // Update DOM here
 *   setItems(newItems);
 * });
 * ```
 */
export function batchUpdates(
  callback: () => void,
  options?: { skipTransition?: boolean }
): Promise<void> {
  const { skipTransition = false } = options || {};

  // Skip transitions if user prefers reduced motion
  const shouldSkip = skipTransition || prefersReducedMotion();

  // Check for View Transitions API support
  const hasSupport = typeof document !== 'undefined' && 'startViewTransition' in document;

  if (hasSupport && !shouldSkip) {
    // Use View Transitions API
    return new Promise((resolve) => {
      const transition = (document as Document & {
        startViewTransition: (cb: () => void) => {
          finished: Promise<void>;
          ready: Promise<void>;
          updateCallbackDone: Promise<void>;
        }
      }).startViewTransition(callback);

      // Wait for transition to complete
      transition.finished
        .then(() => resolve())
        .catch(() => {
          // Fallback if transition fails
          resolve();
        });
    });
  } else {
    // Fallback: execute callback immediately
    callback();
    return Promise.resolve();
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
      // eslint-disable-next-line no-console
      console.debug(`[Perf] ${name} took ${duration.toFixed(2)}ms`);
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

/**
 * Check if View Transitions API is supported by the browser
 */
export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/**
 * Execute a callback with View Transitions API support and automatic fallback
 *
 * This is a comprehensive utility that:
 * - Detects View Transitions API support
 * - Respects prefers-reduced-motion preferences
 * - Provides graceful fallback for unsupported browsers
 * - Returns a promise for async handling
 *
 * @param callback - Function to execute during the transition
 * @param options - Configuration options
 * @returns Promise that resolves when transition completes
 *
 * @example
 * ```ts
 * import { withViewTransition } from '@/lib/performance';
 *
 * // Navigate with transition
 * await withViewTransition(() => {
 *   navigate('/new-page');
 * });
 *
 * // Update state with transition
 * await withViewTransition(() => {
 *   setItems(newItems);
 * }, { skipTransition: false });
 * ```
 */
export function withViewTransition(
  callback: () => void | Promise<void>,
  options?: {
    /** Skip transition even if supported */
    skipTransition?: boolean;
    /** Callback when transition is ready */
    onReady?: () => void;
    /** Callback when transition fails */
    onError?: (error: Error) => void;
  }
): Promise<void> {
  const { skipTransition = false, onReady, onError } = options || {};

  // Skip transitions if user prefers reduced motion or explicitly requested
  const shouldSkip = skipTransition || prefersReducedMotion();

  // Check for View Transitions API support
  const hasSupport = supportsViewTransitions();

  if (hasSupport && !shouldSkip) {
    return new Promise((resolve, reject) => {
      try {
        const transition = (document as Document & {
          startViewTransition: (cb: () => void | Promise<void>) => {
            finished: Promise<void>;
            ready: Promise<void>;
            updateCallbackDone: Promise<void>;
          }
        }).startViewTransition(callback);

        // Call onReady when transition is ready
        if (onReady) {
          transition.ready
            .then(() => onReady())
            .catch(() => {
              // Ignore ready errors
            });
        }

        // Wait for transition to complete
        transition.finished
          .then(() => resolve())
          .catch((error) => {
            // Handle transition errors
            const err = error instanceof Error ? error : new Error(String(error));
            if (onError) {
              onError(err);
            }
            // Still resolve to prevent breaking the app
            resolve();
          });
      } catch (error) {
        // Catch any synchronous errors
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(err);
        }
        reject(err);
      }
    });
  } else {
    // Fallback: execute callback immediately
    try {
      const result = callback();
      // Handle async callbacks
      if (result instanceof Promise) {
        return result
          .then(() => undefined)
          .catch((error) => {
            const err = error instanceof Error ? error : new Error(String(error));
            if (onError) {
              onError(err);
            }
            return Promise.reject(err);
          });
      }
      return Promise.resolve();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      }
      return Promise.reject(err);
    }
  }
}


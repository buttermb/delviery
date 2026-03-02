/**
 * useIntersectionObserver Hook
 *
 * Uses the IntersectionObserver API to detect when a sentinel element
 * enters the viewport. Primarily used for infinite scroll triggers.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseIntersectionObserverOptions {
  /** Callback fired when the observed element becomes visible */
  onIntersect: () => void;
  /** Whether the observer is enabled (e.g., disabled when loading or no more data) */
  enabled?: boolean;
  /** Margin around the root element (e.g., "200px" to trigger 200px before visible) */
  rootMargin?: string;
  /** Fraction of element visibility needed to trigger (0 to 1) */
  threshold?: number;
}

export function useIntersectionObserver({
  onIntersect,
  enabled = true,
  rootMargin = '200px',
  threshold = 0,
}: UseIntersectionObserverOptions) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const onIntersectRef = useRef(onIntersect);

  // Keep the callback ref current without re-creating the observer
  onIntersectRef.current = onIntersect;

  useEffect(() => {
    if (!node || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersectRef.current();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node, enabled, rootMargin, threshold]);

  const ref = useCallback((element: HTMLDivElement | null) => {
    setNode(element);
  }, []);

  return { ref };
}

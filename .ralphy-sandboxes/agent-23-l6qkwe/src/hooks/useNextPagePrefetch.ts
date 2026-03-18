/**
 * Hook to prefetch the next page of products when user scrolls near the bottom.
 * Uses IntersectionObserver on a sentinel element to trigger image preloading
 * for the next page, ensuring instant visual transitions on page change.
 */

import { useEffect, useRef, useCallback } from 'react';

import { logger } from '@/lib/logger';

interface UseNextPagePrefetchOptions<T extends { image_url?: string | null }> {
  /** All items (not just current page) */
  allItems: T[];
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether prefetching is enabled */
  enabled?: boolean;
}

/**
 * Preloads images for the next page of items using `<link rel="preload">`.
 * Returns a ref to attach to a sentinel element at the bottom of the product grid.
 */
export function useNextPagePrefetch<T extends { image_url?: string | null }>({
  allItems,
  currentPage,
  pageSize,
  totalPages,
  enabled = true,
}: UseNextPagePrefetchOptions<T>) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prefetchedPageRef = useRef<number | null>(null);

  const prefetchNextPageImages = useCallback(() => {
    if (currentPage >= totalPages) return;

    const nextPage = currentPage + 1;

    // Skip if already prefetched this page
    if (prefetchedPageRef.current === nextPage) return;
    prefetchedPageRef.current = nextPage;

    const startIndex = (nextPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const nextPageItems = allItems.slice(startIndex, endIndex);

    const imageUrls = nextPageItems
      .map((item) => item.image_url)
      .filter((url): url is string => !!url);

    if (imageUrls.length === 0) return;

    logger.debug('Prefetching next page images', {
      nextPage,
      imageCount: imageUrls.length,
    });

    for (const url of imageUrls) {
      // Avoid duplicate preload links
      const existing = document.querySelector(
        `link[rel="preload"][href="${CSS.escape(url)}"]`
      );
      if (existing) continue;

      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    }
  }, [allItems, currentPage, pageSize, totalPages]);

  // Reset prefetched page when current page changes
  useEffect(() => {
    prefetchedPageRef.current = null;
  }, [currentPage]);

  // Set up IntersectionObserver on the sentinel element
  useEffect(() => {
    if (!enabled || currentPage >= totalPages) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          prefetchNextPageImages();
        }
      },
      {
        // Trigger when sentinel is within 200px of the viewport
        rootMargin: '0px 0px 200px 0px',
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [enabled, currentPage, totalPages, prefetchNextPageImages]);

  return { sentinelRef };
}

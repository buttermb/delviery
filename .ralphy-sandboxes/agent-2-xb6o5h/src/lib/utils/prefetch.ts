/**
 * Prefetching Utilities
 * Prefetch routes and data for better perceived performance
 */

import { QueryKey, useQueryClient } from '@tanstack/react-query';

/**
 * Prefetch a route by creating a link element
 * This hints to the browser to prefetch the resource
 */
export function prefetchRoute(href: string): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  link.as = 'document';
  document.head.appendChild(link);
}

/**
 * Prefetch a React Query query
 * Useful for prefetching data before navigation
 * Note: This should be called from a component that has access to QueryClient
 * For use outside components, use the hook version
 */
export async function prefetchQuery<TData = unknown>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
  queryFn: () => Promise<TData>
): Promise<void> {
  try {
    await queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: 60 * 1000, // 1 minute
    });
  } catch {
    // Silently fail - prefetching is optional
    // Prefetch failures are expected and don't need logging
  }
}

/**
 * Prefetch on hover for navigation links
 * Call this in onMouseEnter handler
 */
export function prefetchOnHover(href: string): void {
  if (typeof window === 'undefined') return;
  
  // Only prefetch if not already in cache
  const existingLink = document.querySelector(`link[rel="prefetch"][href="${href}"]`);
  if (existingLink) return;

  prefetchRoute(href);
}

/**
 * Prefetch product data on catalog hover
 * Note: Requires queryClient from useQueryClient hook
 */
export function prefetchProduct(
  queryClient: ReturnType<typeof useQueryClient>,
  productId: string,
  queryFn: () => Promise<unknown>
): void {
  prefetchQuery(queryClient, ['product', productId], queryFn);
}

/**
 * Prefetch order data on list hover
 * Note: Requires queryClient from useQueryClient hook
 */
export function prefetchOrder(
  queryClient: ReturnType<typeof useQueryClient>,
  orderId: string,
  queryFn: () => Promise<unknown>
): void {
  prefetchQuery(queryClient, ['order', orderId], queryFn);
}


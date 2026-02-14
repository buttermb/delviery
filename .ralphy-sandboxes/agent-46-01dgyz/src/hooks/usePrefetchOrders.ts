/**
 * Prefetch Orders Hook
 *
 * Prefetches orders data for the Orders hub to improve navigation performance.
 * This hook pre-loads order lists and related data before the user navigates to the Orders page.
 *
 * Features:
 * - Prefetches order lists (retail, wholesale, menu orders)
 * - Prefetches order counts and stats
 * - Prefetches recent orders for quick display
 * - Configurable debounce delay for hover prefetching
 * - Error handling and logging
 *
 * Usage:
 * ```tsx
 * const { prefetchOrders, isPrefetching } = usePrefetchOrders();
 *
 * // Prefetch on sidebar hover
 * <NavLink
 *   onMouseEnter={() => prefetchOrders()}
 *   to="/orders"
 * >
 *   Orders
 * </NavLink>
 * ```
 */

import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useState, useCallback, useRef } from 'react';

/**
 * Hook options
 */
interface UsePrefetchOrdersOptions {
  /** Enable/disable prefetching */
  enabled?: boolean;
  /** Debounce delay in milliseconds (default: 150ms) */
  debounceMs?: number;
}

/**
 * Hook return value
 */
interface UsePrefetchOrdersReturn {
  /** Prefetch orders data */
  prefetchOrders: () => Promise<boolean>;
  /** Whether prefetch is currently in progress */
  isPrefetching: boolean;
}

/**
 * Hook to prefetch orders data for faster navigation
 *
 * This hook optimizes the Orders hub by prefetching commonly needed data:
 * - Recent orders (last 25)
 * - Order counts by status
 * - Pending orders
 *
 * The data is cached by React Query for instant display when navigating to Orders page.
 *
 * @param options - Hook configuration options
 * @returns Prefetch function and prefetching status
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { prefetchOrders } = usePrefetchOrders();
 *
 * // With custom debounce
 * const { prefetchOrders } = usePrefetchOrders({ debounceMs: 200 });
 *
 * // Use in sidebar navigation
 * <Link onMouseEnter={() => prefetchOrders()} to="/orders">
 *   Orders
 * </Link>
 * ```
 */
export function usePrefetchOrders({
  enabled = true,
  debounceMs = 150,
}: UsePrefetchOrdersOptions = {}): UsePrefetchOrdersReturn {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const [isPrefetching, setIsPrefetching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prefetchInProgressRef = useRef(false);

  /**
   * Prefetch orders data with debouncing
   */
  const prefetchOrders = useCallback(async (): Promise<boolean> => {
    if (!enabled || !tenant?.id) {
      logger.debug('Prefetch orders skipped - disabled or no tenant', {
        component: 'usePrefetchOrders',
        enabled,
        hasTenant: !!tenant?.id,
      });
      return false;
    }

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the prefetch
    return new Promise((resolve) => {
      debounceTimerRef.current = setTimeout(async () => {
        // Prevent concurrent prefetches
        if (prefetchInProgressRef.current) {
          logger.debug('Prefetch already in progress, skipping', {
            component: 'usePrefetchOrders',
          });
          resolve(false);
          return;
        }

        prefetchInProgressRef.current = true;
        setIsPrefetching(true);

        try {
          const tenantId = tenant.id;

          // Prefetch all order-related queries in parallel
          await Promise.allSettled([
            // 1. Recent orders (default list view)
            queryClient.prefetchQuery({
              queryKey: queryKeys.orders.list({ tenantId, limit: 25 }),
              queryFn: async () => {
                const { data, error } = await supabase
                  .from('orders')
                  .select(`
                    *,
                    customer:marketplace_customers(id, first_name, last_name, email),
                    items:order_items(*)
                  `)
                  .eq('tenant_id', tenantId)
                  .order('created_at', { ascending: false })
                  .limit(25);

                if (error) throw error;
                return data || [];
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 2. Pending orders count (for badges)
            queryClient.prefetchQuery({
              queryKey: queryKeys.orders.list({ tenantId, status: 'pending' }),
              queryFn: async () => {
                const { count, error } = await supabase
                  .from('orders')
                  .select('*', { count: 'exact', head: true })
                  .eq('tenant_id', tenantId)
                  .eq('status', 'pending');

                if (error) throw error;
                return { count: count || 0 };
              },
              staleTime: 1 * 60 * 1000, // 1 minute
            }),

            // 3. Wholesale orders (if user views B2B tab)
            queryClient.prefetchQuery({
              queryKey: queryKeys.wholesaleOrders.list({ tenantId, limit: 25 }),
              queryFn: async () => {
                const { data, error } = await supabase
                  .from('wholesale_orders')
                  .select(`
                    *,
                    client:wholesale_clients(id, business_name, contact_name)
                  `)
                  .eq('tenant_id', tenantId)
                  .order('created_at', { ascending: false })
                  .limit(25);

                if (error) throw error;
                return data || [];
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 4. Order stats for quick metrics
            queryClient.prefetchQuery({
              queryKey: ['order-stats', tenantId],
              queryFn: async () => {
                // Get counts by status
                const [pending, confirmed, processing, completed] = await Promise.all([
                  supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'pending'),
                  supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'confirmed'),
                  supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'processing'),
                  supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'completed'),
                ]);

                return {
                  pending: pending.count || 0,
                  confirmed: confirmed.count || 0,
                  processing: processing.count || 0,
                  completed: completed.count || 0,
                };
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),
          ]);

          logger.info('Orders data prefetched successfully', {
            component: 'usePrefetchOrders',
            tenantId,
          });

          resolve(true);
        } catch (error) {
          logger.error('Error prefetching orders data', error, {
            component: 'usePrefetchOrders',
            tenantId: tenant.id,
          });
          resolve(false);
        } finally {
          prefetchInProgressRef.current = false;
          setIsPrefetching(false);
        }
      }, debounceMs);
    });
  }, [enabled, tenant?.id, queryClient, debounceMs]);

  return {
    prefetchOrders,
    isPrefetching,
  };
}

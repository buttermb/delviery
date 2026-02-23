/**
 * Prefetch Inventory Hook
 *
 * Prefetches inventory data for the Inventory hub to improve navigation performance.
 * This hook pre-loads inventory lists, alerts, and related data before the user navigates to the Inventory page.
 *
 * Features:
 * - Prefetches inventory summary statistics
 * - Prefetches low stock alerts
 * - Prefetches inventory locations
 * - Prefetches recent inventory history
 * - Prefetches products list
 * - Configurable debounce delay for hover prefetching
 * - Error handling and logging
 *
 * Usage:
 * ```tsx
 * const { prefetchInventory, isPrefetching } = usePrefetchInventory();
 *
 * // Prefetch on sidebar hover
 * <NavLink
 *   onMouseEnter={() => prefetchInventory()}
 *   to="/inventory"
 * >
 *   Inventory
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
interface UsePrefetchInventoryOptions {
  /** Enable/disable prefetching */
  enabled?: boolean;
  /** Debounce delay in milliseconds (default: 150ms) */
  debounceMs?: number;
}

/**
 * Hook return value
 */
interface UsePrefetchInventoryReturn {
  /** Prefetch inventory data */
  prefetchInventory: () => Promise<boolean>;
  /** Whether prefetch is currently in progress */
  isPrefetching: boolean;
}

/**
 * Hook to prefetch inventory data for faster navigation
 *
 * This hook optimizes the Inventory hub by prefetching commonly needed data:
 * - Inventory summary (total items, value, low stock count)
 * - Low stock alerts
 * - Inventory locations
 * - Recent inventory history (last 25 entries)
 * - Products list (first 50 items)
 *
 * The data is cached by React Query for instant display when navigating to Inventory page.
 *
 * @param options - Hook configuration options
 * @returns Prefetch function and prefetching status
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { prefetchInventory } = usePrefetchInventory();
 *
 * // With custom debounce
 * const { prefetchInventory } = usePrefetchInventory({ debounceMs: 200 });
 *
 * // Use in sidebar navigation
 * <Link onMouseEnter={() => prefetchInventory()} to="/inventory">
 *   Inventory
 * </Link>
 * ```
 */
export function usePrefetchInventory({
  enabled = true,
  debounceMs = 150,
}: UsePrefetchInventoryOptions = {}): UsePrefetchInventoryReturn {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const [isPrefetching, setIsPrefetching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prefetchInProgressRef = useRef(false);

  /**
   * Prefetch inventory data with debouncing
   */
  const prefetchInventory = useCallback(async (): Promise<boolean> => {
    if (!enabled || !tenant?.id) {
      logger.debug('Prefetch inventory skipped - disabled or no tenant', {
        component: 'usePrefetchInventory',
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
            component: 'usePrefetchInventory',
          });
          resolve(false);
          return;
        }

        prefetchInProgressRef.current = true;
        setIsPrefetching(true);

        try {
          const tenantId = tenant.id;

          // Prefetch all inventory-related queries in parallel
          await Promise.allSettled([
            // 1. Inventory summary statistics
            queryClient.prefetchQuery({
              queryKey: queryKeys.inventory.summary(tenantId),
              queryFn: async () => {
                const { data, error } = await supabase
                  .from('products')
                  .select('id, stock_quantity, price')
                  .eq('tenant_id', tenantId);

                if (error) throw error;

                const products = data || [];
                const totalItems = products.length;
                const totalValue = products.reduce(
                  (sum, p) => sum + (p.stock_quantity || 0) * (p.price || 0),
                  0
                );
                const lowStockCount = products.filter(
                  (p) => (p.stock_quantity || 0) < 10
                ).length;

                return {
                  totalItems,
                  totalValue,
                  lowStockCount,
                };
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 2. Low stock alerts
            queryClient.prefetchQuery({
              queryKey: queryKeys.inventory.lowStockAlerts(tenantId),
              queryFn: async () => {
                // Use (supabase as any) to bypass deep type instantiation issues
                const { data, error } = await (supabase as any)
                  .from('products')
                  .select('id, name, stock_quantity, low_stock_threshold')
                  .eq('tenant_id', tenantId)
                  .lt('stock_quantity', 10)
                  .order('stock_quantity', { ascending: true });

                if (error) throw error;
                return data || [];
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 3. Inventory locations
            queryClient.prefetchQuery({
              queryKey: queryKeys.inventory.locations(tenantId),
              queryFn: async () => {
                const { data, error } = await supabase
                  .from('locations')
                  .select('id, name, address, type')
                  .eq('tenant_id', tenantId)
                  .order('name', { ascending: true });

                if (error) throw error;
                return data || [];
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 4. Recent inventory history
            queryClient.prefetchQuery({
              queryKey: queryKeys.inventory.history({ limit: 25 }),
              queryFn: async () => {
                // Use (supabase as any) to bypass deep type instantiation issues
                const { data, error } = await (supabase as any)
                  .from('inventory_history')
                  .select(`
                    *,
                    product:products(id, name),
                    user:profiles(id, email)
                  `)
                  .eq('tenant_id', tenantId)
                  .order('created_at', { ascending: false })
                  .limit(25);

                if (error) throw error;
                return data || [];
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 5. Products list for inventory management
            queryClient.prefetchQuery({
              queryKey: queryKeys.products.list(tenantId, { limit: 50 }),
              queryFn: async () => {
                const { data, error } = await supabase
                  .from('products')
                  .select('id, name, sku, stock_quantity, price, category')
                  .eq('tenant_id', tenantId)
                  .order('name', { ascending: true })
                  .limit(50);

                if (error) throw error;
                return data || [];
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),
          ]);

          logger.info('Inventory data prefetched successfully', {
            component: 'usePrefetchInventory',
            tenantId,
          });

          resolve(true);
        } catch (error) {
          logger.error('Error prefetching inventory data', error, {
            component: 'usePrefetchInventory',
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
    prefetchInventory,
    isPrefetching,
  };
}

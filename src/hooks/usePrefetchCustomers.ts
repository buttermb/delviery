/**
 * Prefetch Customers Hook
 *
 * Prefetches customers data for the Customers hub to improve navigation performance.
 * This hook pre-loads customer lists and related data before the user navigates to the Customers page.
 *
 * Features:
 * - Prefetches customer lists (recent customers, filtered views)
 * - Prefetches customer counts and stats by type and status
 * - Prefetches customer analytics summary
 * - Configurable debounce delay for hover prefetching
 * - Error handling and logging
 *
 * Usage:
 * ```tsx
 * const { prefetchCustomers, isPrefetching } = usePrefetchCustomers();
 *
 * // Prefetch on sidebar hover
 * <NavLink
 *   onMouseEnter={() => prefetchCustomers()}
 *   to="/customers"
 * >
 *   Customers
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
interface UsePrefetchCustomersOptions {
  /** Enable/disable prefetching */
  enabled?: boolean;
  /** Debounce delay in milliseconds (default: 150ms) */
  debounceMs?: number;
}

/**
 * Hook return value
 */
interface UsePrefetchCustomersReturn {
  /** Prefetch customers data */
  prefetchCustomers: () => Promise<boolean>;
  /** Whether prefetch is currently in progress */
  isPrefetching: boolean;
}

/**
 * Hook to prefetch customers data for faster navigation
 *
 * This hook optimizes the Customers hub by prefetching commonly needed data:
 * - Recent customers (last 50)
 * - Customer counts by type (retail, medical, wholesale)
 * - Customer counts by status (active, inactive)
 * - Customer analytics summary
 *
 * The data is cached by React Query for instant display when navigating to Customers page.
 *
 * @param options - Hook configuration options
 * @returns Prefetch function and prefetching status
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { prefetchCustomers } = usePrefetchCustomers();
 *
 * // With custom debounce
 * const { prefetchCustomers } = usePrefetchCustomers({ debounceMs: 200 });
 *
 * // Use in sidebar navigation
 * <Link onMouseEnter={() => prefetchCustomers()} to="/customers">
 *   Customers
 * </Link>
 * ```
 */
export function usePrefetchCustomers({
  enabled = true,
  debounceMs = 150,
}: UsePrefetchCustomersOptions = {}): UsePrefetchCustomersReturn {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const [isPrefetching, setIsPrefetching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prefetchInProgressRef = useRef(false);

  /**
   * Prefetch customers data with debouncing
   */
  const prefetchCustomers = useCallback(async (): Promise<boolean> => {
    if (!enabled || !tenant?.id) {
      logger.debug('Prefetch customers skipped - disabled or no tenant', {
        component: 'usePrefetchCustomers',
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
            component: 'usePrefetchCustomers',
          });
          resolve(false);
          return;
        }

        prefetchInProgressRef.current = true;
        setIsPrefetching(true);

        try {
          const tenantId = tenant.id;

          // Prefetch all customer-related queries in parallel
          await Promise.allSettled([
            // 1. Recent customers (default list view)
            queryClient.prefetchQuery({
              queryKey: queryKeys.customers.list(tenantId, { limit: 50 }),
              queryFn: async () => {
                const { data, error } = await supabase
                  .from('customers')
                  .select('id, tenant_id, first_name, last_name, email, phone, customer_type, total_spent, loyalty_points, loyalty_tier, last_purchase_at, status, medical_card_expiration, created_at')
                  .eq('tenant_id', tenantId)
                  .is('deleted_at', null)
                  .order('created_at', { ascending: false })
                  .limit(50);

                if (error) throw error;
                return data || [];
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 2. Customer counts by type (for filter badges)
            queryClient.prefetchQuery({
              queryKey: ['customer-counts-by-type', tenantId],
              queryFn: async () => {
                const [retail, medical, wholesale, b2b] = await Promise.all([
                  supabase
                    .from('customers')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('customer_type', 'retail')
                    .is('deleted_at', null),
                  supabase
                    .from('customers')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('customer_type', 'medical')
                    .is('deleted_at', null),
                  supabase
                    .from('customers')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('customer_type', 'wholesale')
                    .is('deleted_at', null),
                  supabase
                    .from('customers')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('customer_type', 'b2b')
                    .is('deleted_at', null),
                ]);

                return {
                  retail: retail.count || 0,
                  medical: medical.count || 0,
                  wholesale: wholesale.count || 0,
                  b2b: b2b.count || 0,
                };
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 3. Customer counts by status (for filter badges)
            queryClient.prefetchQuery({
              queryKey: ['customer-counts-by-status', tenantId],
              queryFn: async () => {
                const [active, inactive, pending] = await Promise.all([
                  supabase
                    .from('customers')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active')
                    .is('deleted_at', null),
                  supabase
                    .from('customers')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'inactive')
                    .is('deleted_at', null),
                  supabase
                    .from('customers')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'pending')
                    .is('deleted_at', null),
                ]);

                return {
                  active: active.count || 0,
                  inactive: inactive.count || 0,
                  pending: pending.count || 0,
                };
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),

            // 4. Customer analytics summary (for quick metrics)
            queryClient.prefetchQuery({
              queryKey: ['customer-analytics-summary', tenantId],
              queryFn: async () => {
                // Get total customers and revenue stats
                const { data: customers, error } = await supabase
                  .from('customers')
                  .select('total_spent, loyalty_tier, status')
                  .eq('tenant_id', tenantId)
                  .is('deleted_at', null);

                if (error) throw error;

                const totalCustomers = customers?.length || 0;
                const totalRevenue = customers?.reduce((sum, c) => sum + (c.total_spent || 0), 0) || 0;
                const avgCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

                // Count by loyalty tier
                const tierCounts = customers?.reduce((acc: Record<string, number>, c) => {
                  const tier = c.loyalty_tier || 'none';
                  acc[tier] = (acc[tier] || 0) + 1;
                  return acc;
                }, {}) || {};

                return {
                  totalCustomers,
                  totalRevenue,
                  avgCustomerValue,
                  tierCounts,
                };
              },
              staleTime: 5 * 60 * 1000, // 5 minutes (aggregate data changes less frequently)
            }),

            // 5. Active customers (common filter)
            queryClient.prefetchQuery({
              queryKey: queryKeys.customers.list(tenantId, { status: 'active', limit: 25 }),
              queryFn: async () => {
                const { data, error } = await supabase
                  .from('customers')
                  .select('id, tenant_id, first_name, last_name, email, phone, customer_type, total_spent, loyalty_points, loyalty_tier, last_purchase_at, status, created_at')
                  .eq('tenant_id', tenantId)
                  .eq('status', 'active')
                  .is('deleted_at', null)
                  .order('last_purchase_at', { ascending: false, nullsFirst: false })
                  .limit(25);

                if (error) throw error;
                return data || [];
              },
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),
          ]);

          logger.info('Customers data prefetched successfully', {
            component: 'usePrefetchCustomers',
            tenantId,
          });

          resolve(true);
        } catch (error) {
          logger.error('Error prefetching customers data', error, {
            component: 'usePrefetchCustomers',
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
    prefetchCustomers,
    isPrefetching,
  };
}

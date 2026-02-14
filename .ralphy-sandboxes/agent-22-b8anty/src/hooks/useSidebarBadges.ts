/**
 * Sidebar Badge Counts Hook
 *
 * Fetches badge counts for sidebar navigation items.
 * Lightweight count queries with tenant_id filter.
 * Subscribes to realtime changes for instant updates.
 *
 * @returns {SidebarBadgeCounts} Badge counts and utilities
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * Badge count data structure
 */
export interface SidebarBadgeCounts {
  pendingOrdersCount: number;
  lowStockCount: number;
  unreadNotificationsCount: number;
  pendingDeliveriesCount: number;
}

/**
 * Formatted badge value (string or null if 0)
 */
export type FormattedBadge = string | null;

/**
 * Formatted badge values for display
 */
export interface FormattedBadges {
  pendingOrders: FormattedBadge;
  lowStock: FormattedBadge;
  unreadNotifications: FormattedBadge;
  pendingDeliveries: FormattedBadge;
}

/**
 * Return type for the useSidebarBadges hook
 */
export interface UseSidebarBadgesResult {
  /** Raw badge counts */
  counts: SidebarBadgeCounts;
  /** Formatted badge values for display (null if 0) */
  formattedBadges: FormattedBadges;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
  /** Manual refresh function */
  refresh: () => void;
  /** Whether realtime subscription is active */
  isSubscribed: boolean;
  /** Total count of all badges */
  totalCount: number;
  /** Whether there are any pending items */
  hasAnyBadges: boolean;
}

/**
 * Default empty counts
 */
const DEFAULT_COUNTS: SidebarBadgeCounts = {
  pendingOrdersCount: 0,
  lowStockCount: 0,
  unreadNotificationsCount: 0,
  pendingDeliveriesCount: 0,
};

/**
 * Format a count for badge display
 * Returns null if 0, "99+" if over 99, otherwise the number as string
 */
function formatBadgeValue(count: number): FormattedBadge {
  if (count === 0) return null;
  if (count > 99) return '99+';
  return String(count);
}

/**
 * Hook to fetch and manage sidebar badge counts
 *
 * @example
 * ```tsx
 * const { counts, formattedBadges, isLoading } = useSidebarBadges();
 *
 * // Use in sidebar navigation
 * <NavItem badge={formattedBadges.pendingOrders}>Orders</NavItem>
 * ```
 */
export function useSidebarBadges(): UseSidebarBadgesResult {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  /**
   * Fetch badge counts from database
   */
  const fetchBadgeCounts = useCallback(async (): Promise<SidebarBadgeCounts> => {
    if (!tenant?.id) {
      return DEFAULT_COUNTS;
    }

    try {
      const [
        ordersResult,
        menuOrdersResult,
        stockResult,
        notificationsResult,
        deliveriesResult,
      ] = await Promise.all([
        // Pending wholesale orders (lightweight count)
        supabase
          .from('wholesale_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('status', ['pending', 'assigned', 'confirmed']),

        // Pending menu orders (lightweight count)
        supabase
          .from('menu_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('status', ['pending', 'confirmed', 'processing', 'preparing']),

        // Low stock products (lightweight count)
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .lt('stock_quantity', 10),

        // Unread notifications (lightweight count)
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('is_read', false),

        // Pending deliveries (lightweight count)
        supabase
          .from('wholesale_deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('status', ['assigned', 'picked_up', 'in_transit']),
      ]);

      // Combine wholesale and menu orders for total pending
      const wholesaleOrdersCount = ordersResult.count ?? 0;
      const menuOrdersCount = menuOrdersResult.count ?? 0;
      const pendingOrdersCount = wholesaleOrdersCount + menuOrdersCount;

      const counts: SidebarBadgeCounts = {
        pendingOrdersCount,
        lowStockCount: stockResult.count ?? 0,
        unreadNotificationsCount: notificationsResult.count ?? 0,
        pendingDeliveriesCount: deliveriesResult.count ?? 0,
      };

      logger.debug('Sidebar badge counts fetched', {
        counts,
        tenantId: tenant.id,
        component: 'useSidebarBadges',
      });

      return counts;
    } catch (error) {
      logger.error('Error fetching sidebar badge counts', error, {
        tenantId: tenant.id,
        component: 'useSidebarBadges',
      });
      throw error;
    }
  }, [tenant?.id]);

  /**
   * React Query for badge counts
   */
  const {
    data: counts = DEFAULT_COUNTS,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.sidebarBadges.counts(tenant?.id),
    queryFn: fetchBadgeCounts,
    enabled: !!tenant?.id,
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  });

  /**
   * Setup realtime subscriptions for instant updates
   */
  useEffect(() => {
    if (!tenant?.id) {
      return;
    }

    const tenantId = tenant.id;

    /**
     * Invalidate and refetch badge counts
     */
    const invalidateBadges = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.sidebarBadges.counts(tenantId),
      });
    };

    // Channel 1: Wholesale Orders
    const wholesaleOrdersChannel = supabase
      .channel(`sidebar-badges-wholesale-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          logger.debug('Wholesale order change detected', {
            component: 'useSidebarBadges',
          });
          invalidateBadges();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to wholesale orders', {
            component: 'useSidebarBadges',
          });
        }
      });
    channelsRef.current.push(wholesaleOrdersChannel);

    // Channel 2: Menu Orders
    const menuOrdersChannel = supabase
      .channel(`sidebar-badges-menu-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          logger.debug('Menu order change detected', {
            component: 'useSidebarBadges',
          });
          invalidateBadges();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to menu orders', {
            component: 'useSidebarBadges',
          });
        }
      });
    channelsRef.current.push(menuOrdersChannel);

    // Channel 3: Products (stock changes)
    const productsChannel = supabase
      .channel(`sidebar-badges-products-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          // Only refetch if stock_quantity changed
          const newRecord = payload.new as Record<string, unknown>;
          const oldRecord = payload.old as Record<string, unknown>;
          if (newRecord.stock_quantity !== oldRecord.stock_quantity) {
            logger.debug('Product stock change detected', {
              component: 'useSidebarBadges',
            });
            invalidateBadges();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to products', {
            component: 'useSidebarBadges',
          });
        }
      });
    channelsRef.current.push(productsChannel);

    // Channel 4: Notifications
    const notificationsChannel = supabase
      .channel(`sidebar-badges-notifications-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          logger.debug('Notification change detected', {
            component: 'useSidebarBadges',
          });
          invalidateBadges();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to notifications', {
            component: 'useSidebarBadges',
          });
        }
      });
    channelsRef.current.push(notificationsChannel);

    // Channel 5: Deliveries
    const deliveriesChannel = supabase
      .channel(`sidebar-badges-deliveries-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_deliveries',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          logger.debug('Delivery change detected', {
            component: 'useSidebarBadges',
          });
          invalidateBadges();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to deliveries', {
            component: 'useSidebarBadges',
          });
        }
      });
    channelsRef.current.push(deliveriesChannel);

    // Mark as subscribed when all channels are set up
    setIsSubscribed(true);

    // Cleanup on unmount
    return () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel).catch(() => {
          // Silently ignore cleanup errors
        });
      });
      channelsRef.current = [];
      setIsSubscribed(false);

      logger.debug('Sidebar badge subscriptions cleaned up', {
        component: 'useSidebarBadges',
      });
    };
  }, [tenant?.id, queryClient]);

  /**
   * Format badge values for display
   */
  const formattedBadges: FormattedBadges = useMemo(
    () => ({
      pendingOrders: formatBadgeValue(counts.pendingOrdersCount),
      lowStock: formatBadgeValue(counts.lowStockCount),
      unreadNotifications: formatBadgeValue(counts.unreadNotificationsCount),
      pendingDeliveries: formatBadgeValue(counts.pendingDeliveriesCount),
    }),
    [counts]
  );

  /**
   * Calculate total count
   */
  const totalCount = useMemo(
    () =>
      counts.pendingOrdersCount +
      counts.lowStockCount +
      counts.unreadNotificationsCount +
      counts.pendingDeliveriesCount,
    [counts]
  );

  /**
   * Check if there are any badges
   */
  const hasAnyBadges = totalCount > 0;

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    counts,
    formattedBadges,
    isLoading,
    error: error as Error | null,
    refresh,
    isSubscribed,
    totalCount,
    hasAnyBadges,
  };
}

export default useSidebarBadges;

/**
 * Admin Badge Counts Hook
 * Provides real-time badge counts for admin navigation
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

export interface BadgeCounts {
  pendingOrders: number;
  lowStockItems: number;
  unreadMessages: number;
  pendingShipments: number;
  overduePayments: number;
}

export function useAdminBadgeCounts() {
  const { tenant } = useTenantAdminAuth();
  const [counts, setCounts] = useState<BadgeCounts>({
    pendingOrders: 0,
    lowStockItems: 0,
    unreadMessages: 0,
    pendingShipments: 0,
    overduePayments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!tenant?.id) return;
    
    try {
      const [ordersResult, menuOrdersResult, stockResult, messagesResult, shipmentsResult] = await Promise.all([
        // Pending wholesale orders (count only, no data transfer)
        supabase
          .from('wholesale_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .or('status.eq.pending,status.eq.assigned'),

        // Pending menu orders (count only)
        supabase
          .from('menu_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .in('status', ['pending', 'confirmed', 'processing', 'preparing']),

        // Low stock items (count only)
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .lt('stock_quantity', 10),

        // Unread messages (count only)
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'open'),

        // Pending shipments (count only)
        supabase
          .from('wholesale_deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .or('status.eq.assigned,status.eq.picked_up'),
      ]);

      setCounts({
        pendingOrders: (ordersResult.count || 0) + (menuOrdersResult.count || 0),
        lowStockItems: stockResult.count || 0,
        unreadMessages: messagesResult.count || 0,
        pendingShipments: shipmentsResult.count || 0,
        overduePayments: 0,
      });
    } catch (error) {
      logger.error('Error fetching badge counts', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) {
      setIsLoading(false);
      return;
    }

    fetchCounts();

    // Set up realtime subscription for wholesale orders
    const ordersChannel = supabase
      .channel('admin-badge-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wholesale_orders',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => fetchCounts()
      )
      .subscribe();

    // Set up realtime subscription for menu orders
    const menuOrdersChannel = supabase
      .channel('admin-badge-menu-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_orders',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => fetchCounts()
      )
      .subscribe();

    // Refresh every 30 seconds as a fallback
    const interval = setInterval(fetchCounts, 30000);

    return () => {
      ordersChannel.unsubscribe();
      menuOrdersChannel.unsubscribe();
      clearInterval(interval);
    };
  }, [tenant?.id, fetchCounts]);

  const getBadgeLevel = (type: keyof BadgeCounts): 'critical' | 'warning' | 'success' | 'info' => {
    const count = counts[type];
    
    switch (type) {
      case 'pendingOrders':
        if (count >= 10) return 'critical';
        if (count >= 5) return 'warning';
        return 'info';
      case 'lowStockItems':
        if (count >= 5) return 'critical';
        if (count >= 2) return 'warning';
        return 'info';
      case 'unreadMessages':
        if (count >= 5) return 'critical';
        return 'warning';
      case 'pendingShipments':
        if (count >= 10) return 'warning';
        return 'info';
      case 'overduePayments':
        if (count > 0) return 'critical';
        return 'info';
      default:
        return 'info';
    }
  };

  return {
    counts,
    isLoading,
    getBadgeLevel,
    refresh: fetchCounts,
    hasCritical: counts.pendingOrders >= 10 || counts.lowStockItems >= 5 || counts.unreadMessages >= 5,
    hasWarning: counts.pendingOrders >= 5 || counts.lowStockItems >= 2,
    totalPending: counts.pendingOrders + counts.lowStockItems + counts.unreadMessages,
  };
}

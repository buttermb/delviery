import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/formatters';

export interface MenuDashboardAnalytics {
  totalMenus: number;
  activeMenus: number;
  burnedMenus: number;
  totalViews: number;
  totalOrders: number;
  conversionRate: number;
  avgViewsPerMenu: number;
  avgTimeToFirstView: number;
  burnReasons: Record<string, number>;
  viewsByHour: { hour: number; views: number }[];
  topProducts: { id: string; name: string; orders: number; revenue: number }[];
  viewsOverTime: { date: string; views: number }[];
  ordersOverTime: { date: string; orders: number; revenue: number }[];
  menuStatusBreakdown: { name: string; value: number; color: string }[];
  conversionFunnel: { stage: string; value: number; percentage: number }[];
  totalRevenue: number;
}

interface AccessLogRow {
  id: string;
  menu_id: string;
  accessed_at: string;
  ip_address?: string | null;
}

interface MenuOrderRow {
  id: string;
  menu_id: string;
  total_amount: number | null;
  status: string;
  created_at: string;
  order_data: unknown;
}

interface DisposableMenuRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
  burn_reason: string | null;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  price_per_unit: number;
}

export function useMenuDashboardAnalytics(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const [realtimeViews, setRealtimeViews] = useState(0);
  const [realtimeOrders, setRealtimeOrders] = useState(0);

  // Fetch menus for this tenant
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: queryKeys.menuDashboardAnalytics.menus(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name, status, created_at, burn_reason')
        .eq('tenant_id', tenantId!);

      if (error) {
        logger.warn('Failed to fetch menus for dashboard analytics', { error: error.message });
        return [];
      }
      return (data || []) as DisposableMenuRow[];
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // Fetch access logs for this tenant's menus
  const menuIds = useMemo(() => menus.map(m => m.id), [menus]);

  const { data: accessLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: queryKeys.menuDashboardAnalytics.logs(tenantId, menuIds),
    queryFn: async () => {
      if (menuIds.length === 0) return [];

      const { data, error } = await supabase
        .from('menu_access_logs')
        .select('id, menu_id, accessed_at, ip_address')
        .in('menu_id', menuIds)
        .order('accessed_at', { ascending: false })
        .limit(2000);

      if (error) {
        logger.warn('Failed to fetch access logs for dashboard analytics', { error: error.message });
        return [];
      }
      return (data || []) as AccessLogRow[];
    },
    enabled: !!tenantId && menuIds.length > 0,
    staleTime: 60 * 1000,
  });

  // Fetch orders for this tenant's menus
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: queryKeys.menuDashboardAnalytics.orders(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_orders')
        .select('id, menu_id, total_amount, status, created_at, order_data')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch orders for dashboard analytics', { error: error.message });
        return [];
      }
      return (data || []) as MenuOrderRow[];
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  // Real-time subscription for live updates
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`menu-dashboard-analytics-${tenantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'menu_access_logs',
      }, () => {
        setRealtimeViews(prev => prev + 1);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'menu_orders',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        setRealtimeOrders(prev => prev + 1);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Menu dashboard analytics realtime error', { status });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // Refresh data (resets realtime counters and refetches)
  const refresh = useCallback(() => {
    setRealtimeViews(0);
    setRealtimeOrders(0);
    queryClient.invalidateQueries({ queryKey: queryKeys.menuDashboardAnalytics.menus(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.menuDashboardAnalytics.logs(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.menuDashboardAnalytics.orders(tenantId) });
  }, [tenantId, queryClient]);

  // Compute analytics from the raw data
  const analytics: MenuDashboardAnalytics = useMemo(() => {
    const activeMenus = menus.filter(m => m.status === 'active');
    const burnedMenus = menus.filter(m => m.status === 'soft_burned' || m.status === 'hard_burned');

    const totalViews = accessLogs.length + realtimeViews;
    const totalOrders = orders.length + realtimeOrders;
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;
    const avgViewsPerMenu = menus.length > 0 ? totalViews / menus.length : 0;

    // Average time to first view (in minutes)
    const logsByMenu = accessLogs.reduce<Record<string, string>>((acc, log) => {
      if (!acc[log.menu_id] || new Date(log.accessed_at) < new Date(acc[log.menu_id])) {
        acc[log.menu_id] = log.accessed_at;
      }
      return acc;
    }, {});

    const timesToFirstView: number[] = [];
    menus.forEach(menu => {
      const firstView = logsByMenu[menu.id];
      if (firstView) {
        const diff = (new Date(firstView).getTime() - new Date(menu.created_at).getTime()) / (1000 * 60);
        if (diff >= 0) timesToFirstView.push(diff);
      }
    });
    const avgTimeToFirstView = timesToFirstView.length > 0
      ? timesToFirstView.reduce((a, b) => a + b, 0) / timesToFirstView.length
      : 0;

    // Burn reasons
    const burnReasons: Record<string, number> = {};
    burnedMenus.forEach(m => {
      const reason = m.burn_reason || 'Manual';
      const formatted = reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      burnReasons[formatted] = (burnReasons[formatted] || 0) + 1;
    });

    // Views by hour
    const hourCounts: Record<number, number> = {};
    accessLogs.forEach(log => {
      const hour = new Date(log.accessed_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const viewsByHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      views: hourCounts[i] || 0,
    }));

    // Top products from order data
    const productMap: Record<string, { id: string; name: string; orders: number; revenue: number }> = {};
    orders.forEach(order => {
      const orderData = order.order_data as { items?: OrderItem[] } | null;
      const items = orderData?.items || [];
      items.forEach((item: OrderItem) => {
        const key = item.product_name;
        if (!productMap[key]) {
          productMap[key] = { id: key, name: item.product_name, orders: 0, revenue: 0 };
        }
        productMap[key].orders += item.quantity || 1;
        productMap[key].revenue += (item.price_per_unit || 0) * (item.quantity || 1);
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Views over time (last 30 days)
    const now = new Date();
    const viewsByDate: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      viewsByDate[d.toISOString().split('T')[0]] = 0;
    }
    accessLogs.forEach(log => {
      const date = new Date(log.accessed_at).toISOString().split('T')[0];
      if (viewsByDate[date] !== undefined) {
        viewsByDate[date]++;
      }
    });
    const viewsOverTime = Object.entries(viewsByDate).map(([date, views]) => ({ date, views }));

    // Orders over time (last 30 days)
    const ordersByDate: Record<string, { orders: number; revenue: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      ordersByDate[d.toISOString().split('T')[0]] = { orders: 0, revenue: 0 };
    }
    orders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (ordersByDate[date]) {
        ordersByDate[date].orders++;
        ordersByDate[date].revenue += Number(order.total_amount || 0);
      }
    });
    const ordersOverTime = Object.entries(ordersByDate).map(([date, data]) => ({
      date,
      orders: data.orders,
      revenue: data.revenue,
    }));

    // Menu status breakdown for donut chart
    const STATUS_COLORS: Record<string, string> = {
      'Active': '#22c55e',
      'Soft Burned': '#f59e0b',
      'Hard Burned': '#ef4444',
      'Expired': '#6b7280',
    };
    const menuStatusBreakdown = [
      { name: 'Active', value: activeMenus.length, color: STATUS_COLORS['Active'] },
      { name: 'Soft Burned', value: menus.filter(m => m.status === 'soft_burned').length, color: STATUS_COLORS['Soft Burned'] },
      { name: 'Hard Burned', value: menus.filter(m => m.status === 'hard_burned').length, color: STATUS_COLORS['Hard Burned'] },
      { name: 'Expired', value: menus.filter(m => m.status === 'expired').length, color: STATUS_COLORS['Expired'] },
    ].filter(item => item.value > 0);

    // Conversion funnel
    const uniqueViewers = new Set(accessLogs.map(l => l.ip_address || l.menu_id)).size;
    const ordersPlaced = orders.length;
    const ordersCompleted = orders.filter(o => o.status === 'completed' || o.status === 'delivered').length;
    const maxFunnelValue = Math.max(totalViews, 1);
    const conversionFunnel = [
      { stage: 'Menu Views', value: totalViews, percentage: 100 },
      { stage: 'Unique Visitors', value: uniqueViewers, percentage: (uniqueViewers / maxFunnelValue) * 100 },
      { stage: 'Orders Placed', value: ordersPlaced, percentage: (ordersPlaced / maxFunnelValue) * 100 },
      { stage: 'Completed', value: ordersCompleted, percentage: (ordersCompleted / maxFunnelValue) * 100 },
    ];

    return {
      totalMenus: menus.length,
      activeMenus: activeMenus.length,
      burnedMenus: burnedMenus.length,
      totalViews,
      totalOrders,
      conversionRate,
      avgViewsPerMenu,
      avgTimeToFirstView,
      burnReasons,
      viewsByHour,
      topProducts,
      viewsOverTime,
      ordersOverTime,
      menuStatusBreakdown,
      conversionFunnel,
      totalRevenue,
    };
  }, [menus, accessLogs, orders, realtimeViews, realtimeOrders]);

  // Get export data for CSV/Excel
  const getExportData = useCallback((): Record<string, unknown>[] => {
    const rows: Record<string, unknown>[] = [
      { Metric: 'Total Menus', Value: analytics.totalMenus },
      { Metric: 'Active Menus', Value: analytics.activeMenus },
      { Metric: 'Burned Menus', Value: analytics.burnedMenus },
      { Metric: 'Total Views', Value: analytics.totalViews },
      { Metric: 'Total Orders', Value: analytics.totalOrders },
      { Metric: 'Total Revenue', Value: formatCurrency(analytics.totalRevenue) },
      { Metric: 'Conversion Rate (%)', Value: analytics.conversionRate.toFixed(2) },
      { Metric: 'Avg Views Per Menu', Value: analytics.avgViewsPerMenu.toFixed(1) },
      { Metric: 'Avg Time to First View (min)', Value: analytics.avgTimeToFirstView.toFixed(0) },
    ];

    // Add burn reasons
    Object.entries(analytics.burnReasons).forEach(([reason, count]) => {
      rows.push({ Metric: `Burn Reason: ${reason}`, Value: count });
    });

    // Add top products
    analytics.topProducts.forEach((p, idx) => {
      rows.push({
        Metric: `#${idx + 1} Product: ${p.name}`,
        Value: `${p.orders} orders / ${formatCurrency(p.revenue)}`,
      });
    });

    return rows;
  }, [analytics]);

  return {
    analytics,
    isLoading: menusLoading || logsLoading || ordersLoading,
    realtimeViews,
    realtimeOrders,
    getExportData,
    refresh,
  };
}

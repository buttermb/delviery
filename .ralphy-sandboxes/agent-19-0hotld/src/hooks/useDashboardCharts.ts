/**
 * useDashboardCharts Hook
 * Provides chart data for the Command Center dashboard:
 *   1. Revenue line chart (last 7 days)
 *   2. Orders by status (donut chart)
 *   3. Top 5 products by quantity sold this week
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ---------- Types ----------

export interface RevenueDataPoint {
  date: string;
  label: string;
  revenue: number;
}

export interface OrderStatusSlice {
  status: string;
  count: number;
  color: string;
}

export interface TopProductEntry {
  productName: string;
  quantity: number;
}

// ---------- Revenue Chart (last 7 days) ----------

export function useRevenueChart() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.revenueChart(tenantId),
    queryFn: async (): Promise<RevenueDataPoint[]> => {
      if (!tenantId) return [];

      const now = new Date();
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

      const { data, error } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .in('status', ['completed', 'delivered']);

      if (error) {
        logger.warn('Failed to fetch revenue chart data', error, { component: 'useDashboardCharts' });
        return [];
      }

      // Build a map of date -> revenue
      const revenueByDate = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split('T')[0];
        revenueByDate.set(key, 0);
      }

      (data ?? []).forEach((order) => {
        const dateKey = new Date(order.created_at).toISOString().split('T')[0];
        const current = revenueByDate.get(dateKey) ?? 0;
        revenueByDate.set(dateKey, current + (Number(order.total_amount) || 0));
      });

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const result: RevenueDataPoint[] = [];
      revenueByDate.forEach((revenue, date) => {
        const d = new Date(date + 'T00:00:00');
        result.push({
          date,
          label: days[d.getDay()],
          revenue: Math.round(revenue * 100) / 100,
        });
      });

      return result;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

// ---------- Orders by Status (pie/donut) ----------

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  accepted: '#3b82f6',
  preparing: '#8b5cf6',
  processing: '#8b5cf6',
  out_for_delivery: '#06b6d4',
  in_transit: '#06b6d4',
  delivered: '#22c55e',
  completed: '#10b981',
  cancelled: '#ef4444',
  rejected: '#dc2626',
  refunded: '#f97316',
};

export function useOrdersByStatus() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.ordersByStatus(tenantId),
    queryFn: async (): Promise<OrderStatusSlice[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('status')
        .eq('tenant_id', tenantId)
        .not('status', 'is', null);

      if (error) {
        logger.warn('Failed to fetch orders by status', error, { component: 'useDashboardCharts' });
        return [];
      }

      const countByStatus = new Map<string, number>();
      (data ?? []).forEach((row) => {
        const status = String(row.status);
        countByStatus.set(status, (countByStatus.get(status) ?? 0) + 1);
      });

      const slices: OrderStatusSlice[] = [];
      countByStatus.forEach((count, status) => {
        slices.push({
          status: formatStatus(status),
          count,
          color: STATUS_COLORS[status] ?? '#94a3b8',
        });
      });

      // Sort by count descending
      slices.sort((a, b) => b.count - a.count);
      return slices;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

// ---------- Top 5 Products (bar chart, this week) ----------

export function useTopProducts() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.topProducts(tenantId),
    queryFn: async (): Promise<TopProductEntry[]> => {
      if (!tenantId) return [];

      const now = new Date();
      const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

      // Get order IDs for this tenant in the past week
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', tenantId)
        .gte('created_at', weekAgo.toISOString())
        .in('status', ['completed', 'delivered']);

      if (ordersError || !orders || orders.length === 0) {
        if (ordersError) {
          logger.warn('Failed to fetch orders for top products', ordersError, { component: 'useDashboardCharts' });
        }
        return [];
      }

      const orderIds = orders.map((o) => o.id);

      // Get order items for those orders
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('product_name, quantity')
        .in('order_id', orderIds);

      if (itemsError) {
        logger.warn('Failed to fetch order items for top products', itemsError, { component: 'useDashboardCharts' });
        return [];
      }

      // Aggregate by product name
      const quantityByProduct = new Map<string, number>();
      (items ?? []).forEach((item) => {
        const name = item.product_name || 'Unknown';
        quantityByProduct.set(name, (quantityByProduct.get(name) ?? 0) + (item.quantity ?? 0));
      });

      // Sort and take top 5
      const entries: TopProductEntry[] = [];
      quantityByProduct.forEach((quantity, productName) => {
        entries.push({ productName, quantity });
      });
      entries.sort((a, b) => b.quantity - a.quantity);
      return entries.slice(0, 5);
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

// ---------- Helpers ----------

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

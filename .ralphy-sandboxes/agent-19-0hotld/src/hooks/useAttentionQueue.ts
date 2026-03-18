/**
 * useAttentionQueue Hook
 * 
 * Provides real-time attention queue data for sidebars and notifications.
 * Uses the weighted scoring algorithm to prioritize items.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import {
  AttentionItem,
  AttentionQueue,
} from '@/types/hotbox';
import { PRIORITY_WEIGHTS, CATEGORY_URGENCY } from '@/lib/hotbox';

interface AttentionCounts {
  critical: number;
  important: number;
  info: number;
  total: number;
}

/**
 * Calculate score for an attention item
 */
function calculateScore(item: AttentionItem): number {
  let score = PRIORITY_WEIGHTS[item.priority];
  score += CATEGORY_URGENCY[item.category] || 0;

  // Value factor - parse string value to number (handles "$1,240" format)
  if (item.value) {
    const numValue = parseFloat(String(item.value).replace(/[^0-9.-]/g, ''));
    if (!isNaN(numValue) && numValue > 0) {
      // log10 scaling: $100 = +40, $1K = +60, $10K = +80
      score += Math.min(100, Math.log10(numValue + 1) * 20);
    }
  }

  // Age factor - use real timestamp from database
  const now = Date.now();
  const itemTime = new Date(item.timestamp).getTime();
  const ageHours = (now - itemTime) / (1000 * 60 * 60);

  if (ageHours < 1) {
    score += 20; // Boost for very recent items
  } else if (ageHours > 24) {
    score -= Math.min(50, (ageHours - 24) * 2); // Decay for old items
  }

  return Math.max(0, Math.round(score));
}

export function useAttentionQueue() {
  const { tenant } = useTenantAdminAuth();
  useBusinessTier();
  const { buildAdminUrl } = useTenantNavigation();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.attentionQueue.byTenant(tenant?.id),
    queryFn: async (): Promise<AttentionQueue> => {
      if (!tenant?.id) throw new Error('No tenant');

      const items: AttentionItem[] = [];
      const now = new Date();

      // Fetch queries individually with error handling for resilience
      type OrderRow = { id: string; total_amount: number; created_at: string };
      type DeliveryRow = { id: string; created_at: string };
      type ProductRow = { id: string; name: string; stock_quantity?: number };
      type CustomerRow = { id: string; first_name: string; last_name: string; balance: number };

      const fetchMenuOrders = async (): Promise<OrderRow[]> => {
        try {
          const { data } = await supabase
            .from('menu_orders')
            .select('id, total_amount, created_at')
            .eq('tenant_id', tenant.id)
            .eq('status', 'pending')
            .limit(100);
          return (data as unknown as OrderRow[]) ?? [];
        } catch { return []; }
      };

      const fetchOrders = async (): Promise<OrderRow[]> => {
        try {
          const { data } = await supabase
            .from('orders')
            .select('id, total_amount, created_at')
            .eq('tenant_id', tenant.id)
            .eq('status', 'pending')
            .limit(100);
          return (data as unknown as OrderRow[]) ?? [];
        } catch { return []; }
      };

      const fetchLateDeliveries = async (): Promise<DeliveryRow[]> => {
        try {
          const { data } = await supabase
            .from('deliveries')
            .select('id, created_at')
            .eq('tenant_id', tenant.id)
            .eq('status', 'in_transit')
            .limit(100);
          return (data as unknown as DeliveryRow[]) ?? [];
        } catch { return []; }
      };

      const fetchActiveDeliveries = async (): Promise<DeliveryRow[]> => {
        try {
          const { data } = await supabase
            .from('deliveries')
            .select('id, created_at')
            .eq('tenant_id', tenant.id)
            .eq('status', 'in_transit')
            .limit(100);
          return (data as unknown as DeliveryRow[]) ?? [];
        } catch { return []; }
      };

      const fetchOutOfStock = async (): Promise<ProductRow[]> => {
        try {
          const { data } = await supabase
            .from('products')
            .select('id, name')
            .eq('tenant_id', tenant.id)
            .lte('stock_quantity', 0)
            .limit(100);
          return (data as unknown as ProductRow[]) ?? [];
        } catch { return []; }
      };

      const fetchLowStock = async (): Promise<ProductRow[]> => {
        try {
          const { data } = await supabase
            .from('products')
            .select('id, name, stock_quantity')
            .eq('tenant_id', tenant.id)
            .gt('stock_quantity', 0)
            .lt('stock_quantity', 10)
            .limit(100);
          return (data as unknown as ProductRow[]) ?? [];
        } catch { return []; }
      };

      const fetchCustomerTabs = async (): Promise<CustomerRow[]> => {
        try {
          const { data } = await supabase
            .from('customers')
            .select('id, first_name, last_name, balance')
            .eq('tenant_id', tenant.id)
            .gt('balance', 0)
            .limit(100);
          return (data as unknown as CustomerRow[]) ?? [];
        } catch { return []; }
      };

      const fetchWholesalePending = async (): Promise<OrderRow[]> => {
        try {
          const { data } = await supabase
            .from('wholesale_orders')
            .select('id, total_amount, created_at')
            .eq('tenant_id', tenant.id)
            .eq('status', 'pending');
          return (data as unknown as OrderRow[]) ?? [];
        } catch { return []; }
      };

      const [
        menuOrdersData,
        ordersData,
        lateDeliveriesData,
        activeDeliveriesData,
        outOfStockData,
        lowStockData,
        customerTabsData,
        wholesalePendingData,
      ] = await Promise.all([
        fetchMenuOrders(),
        fetchOrders(),
        fetchLateDeliveries(),
        fetchActiveDeliveries(),
        fetchOutOfStock(),
        fetchLowStock(),
        fetchCustomerTabs(),
        fetchWholesalePending(),
      ]);

      const pendingMenuOrders = { data: menuOrdersData };
      const pendingOrders = { data: ordersData };
      const lateDeliveries = { data: lateDeliveriesData };
      const activeDeliveries = { data: activeDeliveriesData };
      const outOfStock = { data: outOfStockData };
      const lowStock = { data: lowStockData };
      const customerTabs = { data: customerTabsData };
      const wholesalePending = { data: wholesalePendingData };

      // Helper to find oldest timestamp from records
      const getOldestTimestamp = (records: { created_at: string }[]): string => {
        if (!records.length) return now.toISOString();
        return records.reduce((oldest, r) =>
          new Date(r.created_at) < new Date(oldest) ? r.created_at : oldest
          , records[0].created_at);
      };

      // Build attention items with REAL timestamps from database

      // Pending menu orders - use oldest order's created_at for urgency
      if (pendingMenuOrders.data && pendingMenuOrders.data.length > 0) {
        const totalValue = pendingMenuOrders.data.reduce(
          (sum, o) => sum + Number(o.total_amount ?? 0), 0
        );
        const oldestTimestamp = getOldestTimestamp(pendingMenuOrders.data);
        items.push({
          id: 'menu-orders',
          priority: 'critical',
          category: 'orders',
          title: `${pendingMenuOrders.data.length} menu ${pendingMenuOrders.data.length === 1 ? 'order' : 'orders'} waiting`,
          value: String(totalValue),
          actionLabel: 'Process',
          actionUrl: buildAdminUrl('orders?tab=menu'),
          timestamp: oldestTimestamp,
        });
      }

      // Late deliveries - use oldest delivery's created_at
      if (lateDeliveries.data && lateDeliveries.data.length > 0) {
        const oldestTimestamp = getOldestTimestamp(lateDeliveries.data);
        items.push({
          id: 'late-deliveries',
          priority: 'critical',
          category: 'delivery',
          title: `${lateDeliveries.data.length} late ${lateDeliveries.data.length === 1 ? 'delivery' : 'deliveries'}`,
          actionLabel: 'Track',
          actionUrl: buildAdminUrl('delivery-hub?tab=tracking'),
          timestamp: oldestTimestamp,
        });
      }

      // Out of stock - recent check, use now
      if (outOfStock.data && outOfStock.data.length > 0) {
        items.push({
          id: 'out-of-stock',
          priority: 'critical',
          category: 'inventory',
          title: `${outOfStock.data.length} out of stock`,
          actionLabel: 'Restock',
          actionUrl: buildAdminUrl('inventory-hub?tab=stock'),
          timestamp: now.toISOString(),
        });
      }

      // Pending orders - use oldest order's created_at
      if (pendingOrders.data && pendingOrders.data.length > 0) {
        const totalValue = pendingOrders.data.reduce(
          (sum, o) => sum + Number(o.total_amount ?? 0), 0
        );
        const oldestTimestamp = getOldestTimestamp(pendingOrders.data);
        items.push({
          id: 'pending-orders',
          priority: pendingOrders.data.length > 5 ? 'critical' : 'important',
          category: 'orders',
          title: `${pendingOrders.data.length} pending ${pendingOrders.data.length === 1 ? 'order' : 'orders'}`,
          value: String(totalValue),
          actionLabel: 'View',
          actionUrl: buildAdminUrl('orders?status=pending'),
          timestamp: oldestTimestamp,
        });
      }

      // Wholesale pending - use oldest order's created_at
      if (wholesalePending.data && wholesalePending.data.length > 0) {
        const totalValue = wholesalePending.data.reduce(
          (sum, o) => sum + Number(o.total_amount ?? 0), 0
        );
        const oldestTimestamp = getOldestTimestamp(wholesalePending.data);
        items.push({
          id: 'wholesale-pending',
          priority: 'important',
          category: 'orders',
          title: `${wholesalePending.data.length} wholesale ${wholesalePending.data.length === 1 ? 'order' : 'orders'}`,
          value: String(totalValue),
          actionLabel: 'Review',
          actionUrl: buildAdminUrl('orders?tab=wholesale'),
          timestamp: oldestTimestamp,
        });
      }

      // Low stock - recent check, use now
      if (lowStock.data && lowStock.data.length > 0) {
        items.push({
          id: 'low-stock',
          priority: 'important',
          category: 'inventory',
          title: `${lowStock.data.length} ${lowStock.data.length === 1 ? 'item' : 'items'} low`,
          actionLabel: 'Reorder',
          actionUrl: buildAdminUrl('inventory-hub?tab=stock'),
          timestamp: now.toISOString(),
        });
      }

      // Customer tabs - use now (we don't have balance history timestamps)
      if (customerTabs.data && customerTabs.data.length > 0) {
        const totalOwed = customerTabs.data.reduce(
          (sum, c) => sum + Number(c.balance ?? 0), 0
        );
        if (totalOwed > 100) {
          items.push({
            id: 'customer-tabs',
            priority: 'important',
            category: 'customers',
            title: `${customerTabs.data.length} open tabs`,
            value: String(totalOwed),
            actionLabel: 'Collect',
            actionUrl: buildAdminUrl('customer-hub'),
            timestamp: now.toISOString(),
          });
        }
      }

      // Active deliveries (info) - use oldest active delivery
      if (activeDeliveries.data && activeDeliveries.data.length > 0 && !lateDeliveries.data?.length) {
        const oldestTimestamp = getOldestTimestamp(activeDeliveries.data);
        items.push({
          id: 'active-deliveries',
          priority: 'info',
          category: 'delivery',
          title: `${activeDeliveries.data.length} in progress`,
          actionLabel: 'Track',
          actionUrl: buildAdminUrl('delivery-hub?tab=tracking'),
          timestamp: oldestTimestamp,
        });
      }

      // Calculate scores and sort
      const scoredItems = items.map(item => ({
        ...item,
        score: calculateScore(item),
      })).sort((a, b) => (b.score || 0) - (a.score || 0));

      // Split by priority
      const critical = scoredItems.filter(i => i.priority === 'critical');

      return {
        items: scoredItems,
        criticalCount: critical.length,
        totalCount: scoredItems.length,
        lastUpdated: new Date().toISOString(),
      };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Get counts for badges
  const counts: AttentionCounts = {
    critical: data?.criticalCount ?? 0,
    important: data?.items?.filter(i => i.priority === 'important').length ?? 0,
    info: data?.items?.filter(i => i.priority === 'info').length ?? 0,
    total: data?.totalCount ?? 0,
  };

  // Get top N items
  const getTopItems = (n: number = 5) => {
    return data?.items?.slice(0, n) ?? [];
  };

  // Check if there are urgent items
  const hasUrgent = counts.critical > 0;
  const hasImportant = counts.important > 0;

  return {
    queue: data,
    counts,
    isLoading,
    error,
    refetch,
    getTopItems,
    hasUrgent,
    hasImportant,
  };
}

export default useAttentionQueue;


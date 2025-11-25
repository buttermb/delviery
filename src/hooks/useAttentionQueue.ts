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
import { 
  AttentionItem, 
  AttentionQueue,
  AlertCategory,
  PRIORITY_WEIGHTS,
  CATEGORY_URGENCY,
} from '@/types/hotbox';
import { queryKeys } from '@/lib/queryKeys';

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
  
  // Value factor
  if (item.value && typeof item.value === 'number' && item.value > 0) {
    score += Math.min(100, Math.log10(item.value + 1) * 20);
  }
  
  // Age factor
  const now = Date.now();
  const itemTime = item.timestamp instanceof Date 
    ? item.timestamp.getTime() 
    : new Date(item.timestamp).getTime();
  const ageHours = (now - itemTime) / (1000 * 60 * 60);
  
  if (ageHours < 1) {
    score += 20;
  } else if (ageHours > 24) {
    score -= Math.min(50, (ageHours - 24) * 2);
  }
  
  return Math.max(0, Math.round(score));
}

export function useAttentionQueue() {
  const { tenant } = useTenantAdminAuth();
  const { tier } = useBusinessTier();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['attention-queue', tenant?.id],
    queryFn: async (): Promise<AttentionQueue> => {
      if (!tenant?.id) throw new Error('No tenant');

      const items: AttentionItem[] = [];
      const now = new Date();

      // Parallel fetch all attention sources
      const [
        pendingMenuOrders,
        pendingOrders,
        lateDeliveries,
        activeDeliveries,
        outOfStock,
        lowStock,
        customerTabs,
        wholesalePending,
      ] = await Promise.all([
        supabase
          .from('menu_orders')
          .select('id, total_amount, created_at')
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending'),
        
        supabase
          .from('orders')
          .select('id, total_amount, created_at')
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending'),
        
        supabase
          .from('deliveries')
          .select('id, created_at, estimated_delivery_time')
          .eq('tenant_id', tenant.id)
          .eq('status', 'in_transit')
          .lt('estimated_delivery_time', now.toISOString()),
        
        supabase
          .from('deliveries')
          .select('id, created_at')
          .eq('tenant_id', tenant.id)
          .eq('status', 'in_transit')
          .gte('estimated_delivery_time', now.toISOString()),
        
        supabase
          .from('products')
          .select('id, name')
          .eq('tenant_id', tenant.id)
          .lte('stock_quantity', 0)
          .eq('status', 'active'),
        
        supabase
          .from('products')
          .select('id, name, stock_quantity')
          .eq('tenant_id', tenant.id)
          .gt('stock_quantity', 0)
          .lt('stock_quantity', 10)
          .eq('status', 'active'),
        
        supabase
          .from('customers')
          .select('id, first_name, last_name, balance')
          .eq('tenant_id', tenant.id)
          .gt('balance', 0),
        
        supabase
          .from('wholesale_orders')
          .select('id, total_amount, created_at')
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending'),
      ]);

      // Build attention items
      
      // Pending menu orders
      if (pendingMenuOrders.data && pendingMenuOrders.data.length > 0) {
        const totalValue = pendingMenuOrders.data.reduce(
          (sum, o) => sum + Number(o.total_amount || 0), 0
        );
        items.push({
          id: 'menu-orders',
          priority: 'critical',
          category: 'orders',
          title: `${pendingMenuOrders.data.length} menu orders waiting`,
          value: totalValue,
          valueDisplay: `$${totalValue.toLocaleString()}`,
          actionLabel: 'Process',
          actionRoute: '/admin/disposable-menu-orders',
          timestamp: new Date(),
        });
      }

      // Late deliveries
      if (lateDeliveries.data && lateDeliveries.data.length > 0) {
        items.push({
          id: 'late-deliveries',
          priority: 'critical',
          category: 'delivery',
          title: `${lateDeliveries.data.length} late deliveries`,
          actionLabel: 'Track',
          actionRoute: '/admin/deliveries',
          timestamp: new Date(),
        });
      }

      // Out of stock
      if (outOfStock.data && outOfStock.data.length > 0) {
        items.push({
          id: 'out-of-stock',
          priority: 'critical',
          category: 'inventory',
          title: `${outOfStock.data.length} out of stock`,
          actionLabel: 'Restock',
          actionRoute: '/admin/inventory-dashboard',
          timestamp: new Date(),
        });
      }

      // Pending orders
      if (pendingOrders.data && pendingOrders.data.length > 0) {
        const totalValue = pendingOrders.data.reduce(
          (sum, o) => sum + Number(o.total_amount || 0), 0
        );
        items.push({
          id: 'pending-orders',
          priority: pendingOrders.data.length > 5 ? 'critical' : 'important',
          category: 'orders',
          title: `${pendingOrders.data.length} pending orders`,
          value: totalValue,
          valueDisplay: `$${totalValue.toLocaleString()}`,
          actionLabel: 'View',
          actionRoute: '/admin/orders?status=pending',
          timestamp: new Date(),
        });
      }

      // Wholesale pending
      if (wholesalePending.data && wholesalePending.data.length > 0) {
        const totalValue = wholesalePending.data.reduce(
          (sum, o) => sum + Number(o.total_amount || 0), 0
        );
        items.push({
          id: 'wholesale-pending',
          priority: 'important',
          category: 'orders',
          title: `${wholesalePending.data.length} wholesale orders`,
          value: totalValue,
          valueDisplay: `$${totalValue.toLocaleString()}`,
          actionLabel: 'Review',
          actionRoute: '/admin/wholesale-orders',
          timestamp: new Date(),
        });
      }

      // Low stock
      if (lowStock.data && lowStock.data.length > 0) {
        items.push({
          id: 'low-stock',
          priority: 'important',
          category: 'inventory',
          title: `${lowStock.data.length} items low`,
          actionLabel: 'Reorder',
          actionRoute: '/admin/inventory-dashboard',
          timestamp: new Date(),
        });
      }

      // Customer tabs
      if (customerTabs.data && customerTabs.data.length > 0) {
        const totalOwed = customerTabs.data.reduce(
          (sum, c) => sum + Number(c.balance || 0), 0
        );
        if (totalOwed > 100) {
          items.push({
            id: 'customer-tabs',
            priority: 'important',
            category: 'customers',
            title: `${customerTabs.data.length} open tabs`,
            value: totalOwed,
            valueDisplay: `$${totalOwed.toLocaleString()}`,
            actionLabel: 'Collect',
            actionRoute: '/admin/customer-tabs',
            timestamp: new Date(),
          });
        }
      }

      // Active deliveries (info)
      if (activeDeliveries.data && activeDeliveries.data.length > 0 && !lateDeliveries.data?.length) {
        items.push({
          id: 'active-deliveries',
          priority: 'info',
          category: 'delivery',
          title: `${activeDeliveries.data.length} in progress`,
          actionLabel: 'Track',
          actionRoute: '/admin/deliveries',
          timestamp: new Date(),
        });
      }

      // Calculate scores and sort
      const scoredItems = items.map(item => ({
        ...item,
        score: calculateScore(item),
      })).sort((a, b) => (b.score || 0) - (a.score || 0));

      // Split by priority
      const critical = scoredItems.filter(i => i.priority === 'critical');
      const important = scoredItems.filter(i => i.priority === 'important');
      const info = scoredItems.filter(i => i.priority === 'info');

      return {
        critical,
        important,
        info,
        all: scoredItems,
        totalCount: scoredItems.length,
        lastUpdated: new Date(),
      };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Get counts for badges
  const counts: AttentionCounts = {
    critical: data?.critical.length || 0,
    important: data?.important.length || 0,
    info: data?.info.length || 0,
    total: data?.totalCount || 0,
  };

  // Get top N items
  const getTopItems = (n: number = 5) => {
    return data?.all.slice(0, n) || [];
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


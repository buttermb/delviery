import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantContext } from '@/hooks/useTenantContext';

interface BadgeCounts {
  orders: number;
  deliveries: number;
  invoices: number;
  stock: number;
  customers: number;
  payments: number;
}

export function useNotificationBadges() {
  const { tenantId, isReady } = useTenantContext();

  const { data: badgeCounts = null, isLoading } = useQuery({
    queryKey: queryKeys.notifications.byTenant(tenantId!),
    queryFn: async (): Promise<BadgeCounts> => {
      if (!tenantId) {
        throw new Error('Tenant ID required');
      }

      // Fetch pending orders count
      const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      if (ordersError) {
        logger.error('Failed to fetch pending orders count:', ordersError);
      }

      // Fetch active deliveries count
      const { count: deliveriesCount, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      if (deliveriesError) {
        logger.error('Failed to fetch active deliveries count:', deliveriesError);
      }

      // Fetch overdue invoices count
      const { count: invoicesCount, error: invoicesError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'overdue');

      if (invoicesError) {
        logger.error('Failed to fetch overdue invoices count:', invoicesError);
      }

      // Fetch low stock products count
      const { data: lowStockProducts, error: stockError } = await supabase
        .from('products')
        .select('id, current_stock, low_stock_threshold')
        .eq('tenant_id', tenantId)
        .eq('track_inventory', true);

      let stockCount = 0;
      if (!stockError && lowStockProducts) {
        stockCount = lowStockProducts.filter(
          (p) => p.current_stock <= (p.low_stock_threshold || 0)
        ).length;
      } else if (stockError) {
        logger.error('Failed to fetch low stock products:', stockError);
      }

      // Fetch new customers (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count: customersCount, error: customersError } = await supabase
        .from('customer_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', yesterday.toISOString());

      if (customersError) {
        logger.error('Failed to fetch new customers count:', customersError);
      }

      // Fetch pending payments count
      const { count: paymentsCount, error: paymentsError } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      if (paymentsError) {
        logger.error('Failed to fetch pending payments count:', paymentsError);
      }

      return {
        orders: ordersCount || 0,
        deliveries: deliveriesCount || 0,
        invoices: invoicesCount || 0,
        stock: stockCount,
        customers: customersCount || 0,
        payments: paymentsCount || 0,
      };
    },
    enabled: !!tenantId && isReady,
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    badgeCounts,
    isLoading,
  };
}

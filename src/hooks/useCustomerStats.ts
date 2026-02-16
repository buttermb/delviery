/**
 * useCustomerStats Hook
 *
 * Calculates customer statistics (total_spent, order_count, avg_order_value)
 * from the unified_orders table for a given customer.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface CustomerStats {
  total_spent: number;
  order_count: number;
  avg_order_value: number;
}

export function useCustomerStats(customerId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.customers.stats(tenant?.id ?? '', customerId ?? ''),
    queryFn: async (): Promise<CustomerStats> => {
      if (!tenant?.id || !customerId) {
        throw new Error('Missing tenant or customer ID');
      }

      const { data, error } = await supabase
        .from('unified_orders')
        .select('total_amount, status')
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .in('status', ['completed', 'delivered']);

      if (error) {
        logger.error('Failed to fetch customer stats', { error, customerId });
        throw error;
      }

      const orders = data ?? [];
      const total_spent = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const order_count = orders.length;
      const avg_order_value = order_count > 0 ? total_spent / order_count : 0;

      return {
        total_spent,
        order_count,
        avg_order_value,
      };
    },
    enabled: !!tenant?.id && !!customerId,
    staleTime: 60000,
  });
}

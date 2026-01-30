/**
 * useOrderStatusHistory
 * Fetches status change history for an order from the order_status_history table
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: 'customer' | 'courier' | 'admin' | 'merchant' | 'system' | string;
  changed_by_id: string | null;
  notes: string | null;
  created_at: string;
}

interface UseOrderStatusHistoryOptions {
  orderId: string;
  enabled?: boolean;
}

export function useOrderStatusHistory({ orderId, enabled = true }: UseOrderStatusHistoryOptions) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.orders.statusHistory(orderId),
    queryFn: async () => {
      if (!orderId) return [];

      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              order: (column: string, options: { ascending: boolean }) => Promise<{ data: OrderStatusHistoryEntry[] | null; error: Error | null }>;
            };
          };
        };
      })
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch order status history', { error, orderId, tenantId: tenant?.id });
        throw error;
      }

      return (data || []) as OrderStatusHistoryEntry[];
    },
    enabled: enabled && !!orderId,
  });
}

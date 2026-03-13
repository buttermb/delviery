import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

import type { NotificationBadgeCounts } from '@/types/notifications/notification';

export function useNotificationBadges() {
  const { tenantId, isReady } = useTenantContext();

  return useQuery({
    queryKey: queryKeys.notifications.badgeCounts(tenantId ?? ''),
    queryFn: async (): Promise<NotificationBadgeCounts> => {
      if (!tenantId) {
        throw new Error('Tenant ID required');
      }

      logger.info('[NotificationBadges] Fetching badge counts', { tenantId });

      // Fetch pending orders count
      const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      if (ordersError) {
        logger.error('[NotificationBadges] Failed to fetch orders count', { error: ordersError });
      }

      // Fetch active deliveries count
      const { count: deliveriesCount, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      if (deliveriesError) {
        logger.error('[NotificationBadges] Failed to fetch deliveries count', { error: deliveriesError });
      }

      // Fetch overdue invoices count
      const { count: invoicesCount, error: invoicesError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'overdue');

      if (invoicesError) {
        logger.error('[NotificationBadges] Failed to fetch invoices count', { error: invoicesError });
      }

      const counts: NotificationBadgeCounts = {
        orders: ordersCount ?? 0,
        deliveries: deliveriesCount ?? 0,
        invoices: invoicesCount ?? 0,
        total: (ordersCount ?? 0) + (deliveriesCount ?? 0) + (invoicesCount ?? 0),
      };

      logger.info('[NotificationBadges] Badge counts fetched', { counts });

      return counts;
    },
    enabled: isReady && !!tenantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

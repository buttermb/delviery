import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function WholesaleOrderStatusNotifications() {
  const { tenant } = useTenantAdminAuth();

  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`wholesale-order-updates-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `seller_id=eq.${tenant.id}`,
        },
        (payload) => {
          const order = payload.new as { id: string; order_number: string; status: string };
          logger.info('Wholesale order status updated', { orderId: order.id, status: order.status });
          
          toast.success(`Order #${order.order_number} status: ${order.status}`, {
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [tenant?.id]);

  return null;
}

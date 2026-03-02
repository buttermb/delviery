import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playNotificationSound } from '@/utils/notificationSound';
import { formatCurrency } from '@/lib/formatters';

export function useOrderNotifications(enabled: boolean, onNewOrder?: () => void, tenantId?: string) {
  const hasShownNotificationRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel(`new-orders-notification-${tenantId ?? 'global'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
        },
        (payload: { new: { status?: string; courier_id?: string | null; order_number?: string; total_amount?: number | string; id?: string } }) => {
          // Only show notification for pending orders without courier
          if (payload.new.status === 'pending' && !payload.new.courier_id) {
            // Play sound
            playNotificationSound(true);

            // Vibrate if supported
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]);
            }

            // Show browser notification if permission granted
            if (Notification.permission === 'granted') {
              const notification = new Notification('🚀 New Delivery Order!', {
                body: `Order #${payload.new.order_number || 'N/A'} - ${formatCurrency(payload.new.total_amount)}`,
                icon: '/logo.svg',
                badge: '/logo.svg',
                tag: `order-${String(payload.new.id || '')}`,
                requireInteraction: true,
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            }

            // Show toast notification
            toast.success(`Order #${payload.new.order_number || 'N/A'} is ready for pickup`, {
              duration: 5000,
            });

            // Call callback if provided
            if (onNewOrder) {
              onNewOrder();
            }

            hasShownNotificationRef.current = true;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Order notifications subscription error:', status, { component: 'useOrderNotifications' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onNewOrder, tenantId]);
}

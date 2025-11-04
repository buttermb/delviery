import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { playNotificationSound } from '@/utils/notificationSound';

export function useOrderNotifications(enabled: boolean, onNewOrder?: () => void) {
  const { toast } = useToast();
  const hasShownNotificationRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel('new-orders-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload: any) => {
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
                body: `Order #${payload.new.order_number} - $${parseFloat(payload.new.total_amount).toFixed(2)}`,
                icon: '/logo.svg',
                badge: '/logo.svg',
                tag: `order-${payload.new.id}`,
                requireInteraction: true,
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            }

            // Show toast notification
            toast({
              title: '🚀 New Order Available!',
              description: `Order #${payload.new.order_number} is ready for pickup`,
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onNewOrder, toast]);
}

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

import type { NotificationDeliveryLog } from '@/types/notifications/notification';

interface UseRealtimeNotificationsOptions {
  enabled?: boolean;
  onNotification?: (notification: NotificationDeliveryLog) => void;
  showToast?: boolean;
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const { enabled = true, onNotification, showToast = true } = options;
  const { tenantId, isReady } = useTenantContext();
  const queryClient = useQueryClient();

  const handleInsert = useCallback(
    (payload: { new: NotificationDeliveryLog }) => {
      const notification = payload.new;

      logger.info('[RealtimeNotifications] New notification', { notification });

      // Invalidate notification queries
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });

      // Show toast if enabled
      if (showToast && notification.status === 'delivered') {
        toast.info(notification.subject ?? 'New notification', {
          description: notification.message_preview ?? undefined,
        });
      }

      // Call custom handler
      if (onNotification) {
        onNotification(notification);
      }
    },
    [queryClient, showToast, onNotification]
  );

  const handleUpdate = useCallback(
    (payload: { old: NotificationDeliveryLog; new: NotificationDeliveryLog }) => {
      const notification = payload.new;

      logger.info('[RealtimeNotifications] Notification updated', { notification });

      // Invalidate notification queries
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });

      // Show toast for failed notifications
      if (showToast && notification.status === 'failed' && payload.old.status !== 'failed') {
        toast.error('Notification delivery failed', {
          description: notification.error_message ?? 'An error occurred',
        });
      }
    },
    [queryClient, showToast]
  );

  useEffect(() => {
    if (!enabled || !isReady || !tenantId) {
      return;
    }

    logger.info('[RealtimeNotifications] Setting up realtime subscription', { tenantId });

    let channel: RealtimeChannel;

    try {
      channel = (supabase as any)
        .channel(`notifications:tenant_${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notification_delivery_log',
            filter: `tenant_id=eq.${tenantId}`,
          },
          handleInsert
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notification_delivery_log',
            filter: `tenant_id=eq.${tenantId}`,
          },
          handleUpdate
        )
        .subscribe((status) => {
          logger.info('[RealtimeNotifications] Subscription status', { status });
        });
    } catch (error) {
      logger.error('[RealtimeNotifications] Failed to set up subscription', { error });
    }

    return () => {
      if (channel) {
        logger.info('[RealtimeNotifications] Cleaning up subscription');
        supabase.removeChannel(channel);
      }
    };
  }, [enabled, isReady, tenantId, handleInsert, handleUpdate]);
}

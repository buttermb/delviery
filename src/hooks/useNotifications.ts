/**
 * useNotifications Hook
 * Fetches unread notifications for the current user and tenant.
 * Provides real-time updates via Supabase subscription.
 */

import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { RealtimePayload } from '@/hooks/useRealtimeSubscription';
import { useRealTimeSubscription } from '@/hooks/useRealtimeSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { STORAGE_KEYS } from '@/constants/storageKeys';

/**
 * Notification type matching the database schema
 */
export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string | null;
  title: string;
  message: string | null;
  type: 'info' | 'warning' | 'error' | 'success';
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Return type for the useNotifications hook
 */
export interface UseNotificationsResult {
  /** Array of notifications */
  notifications: Notification[];
  /** Count of unread notifications */
  unreadCount: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Mark a single notification as read */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Delete a notification */
  deleteNotification: (id: string) => Promise<void>;
  /** Manually refetch notifications */
  refetch: () => void;
}

/**
 * Hook for managing notifications with real-time updates
 *
 * @example
 * ```tsx
 * const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
 *
 * return (
 *   <div>
 *     <Badge count={unreadCount} />
 *     {notifications.map(n => (
 *       <NotificationItem key={n.id} notification={n} onRead={() => markAsRead(n.id)} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useNotifications(): UseNotificationsResult {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const userId = admin?.userId;
  const queryClient = useQueryClient();

  // Query key for notifications
  const notificationsQueryKey = tenantId
    ? queryKeys.notifications.unread(tenantId)
    : queryKeys.notifications.all;

  // Fetch notifications
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: async (): Promise<Notification[]> => {
      if (!tenantId) return [];

      try {
        // Build query - fetch notifications for this tenant
        // Either targeted at current user or broadcast (user_id is null)
        let query = supabase
          .from('notifications')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        // If we have a userId, filter to user-specific or broadcast notifications
        if (userId) {
          query = query.or(`user_id.eq.${userId},user_id.is.null`);
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          // Table might not exist yet
          if (queryError.code === '42P01') {
            logger.warn('Notifications table does not exist yet', {
              component: 'useNotifications',
              tenantId,
            });
            return [];
          }
          throw queryError;
        }

        return (data ?? []) as Notification[];
      } catch (err) {
        // Handle case where table doesn't exist
        if ((err as { code?: string })?.code === '42P01') {
          return [];
        }
        logger.error('Failed to fetch notifications', err as Error, {
          component: 'useNotifications',
          tenantId,
        });
        throw err;
      }
    },
    enabled: !!tenantId,
    refetchInterval: 15000, // 15 second refetch interval as per requirements
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Handle realtime changes callback
  const handleRealtimeChange = useCallback(
    (payload: RealtimePayload<Notification>) => {
      logger.debug('Notification realtime update received', {
        component: 'useNotifications',
        eventType: payload.eventType,
        notificationId: payload.new?.id || payload.old?.id,
      });

      // Invalidate the query to refetch data
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
    [queryClient]
  );

  // Subscribe to realtime changes on notifications table
  useRealTimeSubscription<Notification>({
    table: 'notifications',
    tenantId: tenantId ?? null,
    callback: handleRealtimeChange,
    event: '*',
    enabled: !!tenantId,
    publishToEvent: 'notification_sent',
  });

  // Mark a single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
    onError: (err) => {
      logger.error('Failed to mark notification as read', err as Error, {
        component: 'useNotifications',
      });
      toast.error('Failed to mark notification as read', { description: humanizeError(err) });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant context');

      // Build the update query
      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('tenant_id', tenantId)
        .eq('read', false);

      // If we have a userId, only mark notifications for this user or broadcast ones
      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { error: updateError } = await query;

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      toast.success('All notifications marked as read');
    },
    onError: (err) => {
      logger.error('Failed to mark all notifications as read', err as Error, {
        component: 'useNotifications',
      });
      toast.error('Failed to mark notifications as read', { description: humanizeError(err) });
    },
  });

  // Delete a notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('tenant_id', tenantId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
    onError: (err) => {
      logger.error('Failed to delete notification', err as Error, {
        component: 'useNotifications',
      });
      toast.error('Failed to delete notification', { description: humanizeError(err) });
    },
  });

  // Wrapper functions for mutations
  const markAsRead = useCallback(
    async (id: string) => {
      await markAsReadMutation.mutateAsync(id);
    },
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(async () => {
    await markAllAsReadMutation.mutateAsync();
  }, [markAllAsReadMutation]);

  const deleteNotification = useCallback(
    async (id: string) => {
      await deleteNotificationMutation.mutateAsync(id);
    },
    [deleteNotificationMutation]
  );

  // Log when hook mounts with valid tenant
  useEffect(() => {
    if (tenantId) {
      logger.debug('useNotifications mounted', {
        component: 'useNotifications',
        tenantId,
        userId,
      });
    }
  }, [tenantId, userId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error: error as Error | null,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch,
  };
}

interface SendNotificationParams {
  orderId: string;
  event: 'order_placed' | 'order_processing' | 'order_completed' | 'order_cancelled';
  customMessage?: string;
}

interface NotificationResult {
  success: boolean;
  message?: string;
  notifications?: Array<{ type: string; status: string }>;
}

export const useSendNotification = () => {
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async ({ orderId, event, customMessage }: SendNotificationParams): Promise<NotificationResult> => {
      // Get notification settings
      const settingsStr = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
      if (!settingsStr) {
        logger.warn('Notification settings not configured, using defaults');
      }

      let settings = {
        channels: { sms: true, email: false },
        templates: [] as Array<{ event: string; enabled: boolean; template?: string }>
      };
      if (settingsStr) {
        try {
          settings = JSON.parse(settingsStr);
        } catch (error) {
          logger.warn('Failed to parse JSON', error);
        }
      }
      
      const template = settings.templates?.find((t: { event: string; enabled: boolean }) => t.event === event);

      if (template && !template.enabled) {
        return { success: false, message: 'Notification disabled for this event' };
      }

      if (!tenant?.id) throw new Error('No tenant');

      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('menu_orders')
        .select('*')
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (orderError) {
        logger.error('Failed to fetch order for notification', { orderId, error: orderError });
        throw orderError;
      }

      if (!order) {
        throw new Error('Order not found');
      }

      // Build message from template or use custom message
      let message = customMessage || (template as unknown as { message?: string })?.message || `Order ${event.replace('_', ' ')} - Order #${order.id.slice(0, 8)}`;
      message = message.replace(/\{\{order_id\}\}/g, order.id.slice(0, 8));
      message = message.replace(/\{\{total_amount\}\}/g, order.total_amount?.toString() || '0');
      message = message.replace(/\{\{customer_name\}\}/g, 'Customer');

      const notifications: Array<{ type: string; status: string }> = [];

      // Send SMS via edge function
      if (settings.channels?.sms && order.contact_phone) {
        try {
          const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-sms', {
            body: {
              to: order.contact_phone,
              message,
              accountId: tenant?.id
            }
          });

          if (smsError) {
            logger.error('SMS send failed', { error: smsError, phone: order.contact_phone });
            notifications.push({ type: 'sms', status: 'failed' });
          } else {
            logger.info('SMS sent successfully', { phone: order.contact_phone, result: smsResult });
            notifications.push({ type: 'sms', status: 'sent' });
          }
        } catch (err) {
          logger.error('SMS edge function error', { error: err });
          notifications.push({ type: 'sms', status: 'error' });
        }
      }

      // Send database notification via edge function
      if (tenant?.id) {
        try {
          const { data: notifResult, error: notifError } = await supabase.functions.invoke('send-notification', {
            body: {
              tenant_id: tenant.id,
              type: 'order_status',
              title: (template as unknown as { subject?: string })?.subject || `Order ${event.replace('_', ' ')}`,
              message,
              channels: ['database'],
              metadata: {
                order_id: orderId,
                event
              }
            }
          });

          if (notifError) {
            logger.error('Database notification failed', { error: notifError });
            notifications.push({ type: 'database', status: 'failed' });
          } else {
            logger.info('Database notification sent', { result: notifResult });
            notifications.push({ type: 'database', status: 'sent' });
          }
        } catch (err) {
          logger.error('Notification edge function error', { error: err });
          notifications.push({ type: 'database', status: 'error' });
        }
      }

      const successCount = notifications.filter(n => n.status === 'sent').length;
      return { 
        success: successCount > 0, 
        notifications,
        message: successCount > 0 ? `${successCount} ${successCount === 1 ? 'notification' : 'notifications'} sent` : 'No notifications sent'
      };
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || 'Notification sent');
      } else {
        toast.warning(result.message || 'Notification not sent');
      }
    },
    onError: (error: Error) => {
      logger.error('Notification mutation error', { error });
      toast.error('Failed to send notification', { description: humanizeError(error) });
    }
  });
};

export const useSendBulkNotification = () => {
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async ({
      recipients,
      message,
      subject,
      channel
    }: {
      recipients: string[];
      message: string;
      subject?: string;
      channel: 'email' | 'sms';
    }) => {
      if (!tenant?.id) {
        throw new Error('Tenant not found');
      }

      const results: Array<{ recipient: string; status: string }> = [];

      // Process in batches to avoid overwhelming the edge function
      const batchSize = 10;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (recipient) => {
          try {
            if (channel === 'sms') {
              const { error } = await supabase.functions.invoke('send-sms', {
                body: {
                  to: recipient,
                  message,
                  accountId: tenant.id
                }
              });
              return { recipient, status: error ? 'failed' : 'sent' };
            } else {
              // Email channel - use send-notification with email channel
              const { error } = await supabase.functions.invoke('send-notification', {
                body: {
                  tenant_id: tenant.id,
                  type: 'bulk_message',
                  title: subject || 'Notification',
                  message,
                  channels: ['email'],
                  metadata: { recipient_email: recipient }
                }
              });
              return { recipient, status: error ? 'failed' : 'sent' };
            }
          } catch (err) {
            logger.error('Bulk notification error', { recipient, error: err });
            return { recipient, status: 'error' };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const sentCount = results.filter(r => r.status === 'sent').length;
      logger.info('Bulk notifications completed', { 
        channel, 
        total: recipients.length, 
        sent: sentCount 
      });

      return { success: sentCount > 0, sent: sentCount, total: recipients.length, results };
    },
    onSuccess: (result) => {
      toast.success(`${result.sent}/${result.total} notifications sent`);
    },
    onError: (error: Error) => {
      logger.error('Bulk notification error', { error });
      toast.error('Failed to send bulk notifications', { description: humanizeError(error) });
    }
  });
};

export default useNotifications;

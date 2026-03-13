import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantContext } from '@/hooks/useTenantContext';
import { playNotificationSound } from '@/utils/notificationSound';

import type { Notification } from './NotificationCenter';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: unknown;
  read: boolean;
  action_url: string | null;
  created_at: string;
  tenant_id: string;
  user_id: string;
}

export function useNotifications() {
  const { tenantId, userId, isReady } = useTenantContext();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: queryKeys.notifications.byUser(tenantId!, userId!),
    queryFn: async () => {
      if (!tenantId || !userId) {
        throw new Error('Tenant ID and User ID required');
      }

      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch notifications:', error);
        throw error;
      }

      return (data || []) as Notification[];
    },
    enabled: !!tenantId && !!userId && isReady,
    staleTime: 30000, // 30 seconds
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!tenantId || !userId || !isReady) {
      return;
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug('[Notifications] New notification received:', payload);

          // Play notification sound
          playNotificationSound(true);

          // Show toast
          const newNotification = payload.new as Notification;
          toast.info(newNotification.title, {
            description: newNotification.message,
          });

          // Invalidate queries
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.byUser(tenantId, userId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.unread(tenantId),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug('[Notifications] Notification updated:', payload);

          // Invalidate queries
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.byUser(tenantId, userId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.unread(tenantId),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, userId, isReady, queryClient]);

  // Count unread notifications
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!tenantId || !userId) {
        throw new Error('Tenant ID and User ID required');
      }

      const { error } = await supabase
        .from('in_app_notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to mark notification as read:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.byUser(tenantId!, userId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unread(tenantId!),
      });
    },
    onError: (error) => {
      logger.error('Failed to mark notification as read:', error);
      toast.error('Failed to mark notification as read');
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) {
        throw new Error('Tenant ID and User ID required');
      }

      const { error } = await supabase
        .from('in_app_notifications')
        .update({ read: true })
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        logger.error('Failed to mark all notifications as read:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.byUser(tenantId!, userId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unread(tenantId!),
      });
      toast.success('All notifications marked as read');
    },
    onError: (error) => {
      logger.error('Failed to mark all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!tenantId || !userId) {
        throw new Error('Tenant ID and User ID required');
      }

      const { error } = await supabase
        .from('in_app_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to delete notification:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.byUser(tenantId!, userId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unread(tenantId!),
      });
      toast.success('Notification deleted');
    },
    onError: (error) => {
      logger.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    deleteNotification: (id: string) => deleteNotificationMutation.mutate(id),
  };
}

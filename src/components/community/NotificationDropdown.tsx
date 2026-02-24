
/**
 * Notification Dropdown Component
 * Real-time forum notifications
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import * as forumApi from '@/lib/api/forum';
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function NotificationDropdown() {
  const [unreadCount, setUnreadCount] = useState(0);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: queryKeys.forum.notifications.lists(),
    queryFn: () => forumApi.getNotifications(20),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => forumApi.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.notifications.lists() });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to mark notification as read'));
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => forumApi.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forum.notifications.lists() });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to mark notifications as read'));
    },
  });

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  // Subscribe to new notifications
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('forum_user_profiles')
        .select('id')
        .eq('customer_user_id', user.id)
        .maybeSingle();

      if (!profile) return;

      channel = supabase
        .channel('forum_notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'forum_notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          (payload) => {
            // Validate payload before using
            if (!payload?.new || typeof payload.new !== 'object') {
              logger.warn('Invalid notification payload received', null, { component: 'NotificationDropdown' });
              return;
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.forum.notifications.lists() });
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.error('Notifications subscription error:', status, { component: 'NotificationDropdown' });
          }
        });
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map(notification => (
              <DropdownMenuItem
                key={notification.id}
                className={!notification.read ? 'bg-muted' : ''}
                asChild
              >
                <Link
                  to={notification.action_url || '#'}
                  onClick={() => handleNotificationClick(notification)}
                  className="flex flex-col gap-1 p-3 cursor-pointer"
                >
                  <div className="font-medium text-sm">{notification.title}</div>
                  {notification.message && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {formatRelativeTime(notification.created_at)}
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


/**
 * NotificationBell Component
 *
 * Bell icon for admin header that shows unread notification count.
 * Click opens dropdown with recent notifications grouped by type.
 * Each notification links to its related entity via useEntityNavigation.
 * Supports mark as read on click and mark all as read.
 * Real-time updates via useNotifications subscription.
 */

import { useState, useMemo, useCallback } from 'react';
import { Bell, Check, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import type { Notification } from '@/hooks/useNotifications';
import type { EntityType } from '@/lib/constants/entityTypes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { useEntityNavigation } from '@/hooks/useEntityNavigation';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

/**
 * Notification type icons mapping
 */
const NOTIFICATION_TYPE_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
} as const;

/**
 * Notification type color classes
 */
const NOTIFICATION_TYPE_COLORS = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
  success: 'text-green-500',
} as const;

/**
 * Map entity_type strings to EntityType constants
 */
const ENTITY_TYPE_MAP: Record<string, EntityType> = {
  order: 'ORDER',
  orders: 'ORDER',
  product: 'PRODUCT',
  products: 'PRODUCT',
  customer: 'CUSTOMER',
  customers: 'CUSTOMER',
  vendor: 'VENDOR',
  vendors: 'VENDOR',
  menu: 'MENU',
  menus: 'MENU',
  disposable_menu: 'MENU',
  disposable_menus: 'MENU',
  delivery: 'DELIVERY',
  deliveries: 'DELIVERY',
  payment: 'PAYMENT',
  payments: 'PAYMENT',
  inventory: 'INVENTORY',
  storefront: 'STOREFRONT',
  storefronts: 'STOREFRONT',
};

/**
 * Grouped notifications by type
 */
interface GroupedNotifications {
  type: Notification['type'];
  label: string;
  notifications: Notification[];
}

/**
 * Props for NotificationBell component
 */
interface NotificationBellProps {
  /** Additional className for styling */
  className?: string;
  /** Maximum notifications to show in dropdown */
  maxNotifications?: number;
}

/**
 * NotificationBell - Bell icon with unread count badge and notification dropdown
 */
export function NotificationBell({
  className,
  maxNotifications = 20,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const { navigateToEntity, isReady: isNavReady } = useEntityNavigation();

  // Group notifications by type
  const groupedNotifications = useMemo((): GroupedNotifications[] => {
    const recentNotifications = notifications.slice(0, maxNotifications);

    const groups: Record<Notification['type'], Notification[]> = {
      error: [],
      warning: [],
      info: [],
      success: [],
    };

    for (const notification of recentNotifications) {
      groups[notification.type].push(notification);
    }

    const typeLabels: Record<Notification['type'], string> = {
      error: 'Errors',
      warning: 'Warnings',
      info: 'Information',
      success: 'Success',
    };

    // Return only non-empty groups, ordered by priority (errors first)
    const typeOrder: Notification['type'][] = ['error', 'warning', 'success', 'info'];

    return typeOrder
      .filter((type) => groups[type].length > 0)
      .map((type) => ({
        type,
        label: typeLabels[type],
        notifications: groups[type],
      }));
  }, [notifications, maxNotifications]);

  // Handle notification click - mark as read and navigate to entity
  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      // Mark as read if unread
      if (!notification.read) {
        try {
          await markAsRead(notification.id);
        } catch (err) {
          logger.error('Failed to mark notification as read', err as Error, {
            component: 'NotificationBell',
            notificationId: notification.id,
          });
        }
      }

      // Navigate to entity if linked
      if (notification.entity_type && notification.entity_id) {
        const entityType = ENTITY_TYPE_MAP[notification.entity_type.toLowerCase()];

        if (entityType && isNavReady) {
          logger.debug('Navigating to notification entity', {
            component: 'NotificationBell',
            entityType,
            entityId: notification.entity_id,
          });
          navigateToEntity(entityType, notification.entity_id);
          setIsOpen(false);
        } else if (!isNavReady) {
          logger.warn('Navigation not ready for notification entity', {
            component: 'NotificationBell',
            entityType: notification.entity_type,
            entityId: notification.entity_id,
          });
        }
      }
    },
    [markAsRead, navigateToEntity, isNavReady]
  );

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      logger.error('Failed to mark all notifications as read', err as Error, {
        component: 'NotificationBell',
      });
    }
  }, [markAllAsRead]);

  // Format notification time
  const formatTime = useCallback((dateString: string): string => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  }, []);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-[20px] px-1 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0"
        aria-label="Notifications"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Notifications list */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : groupedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="py-2">
              {groupedNotifications.map((group, groupIndex) => (
                <div key={group.type}>
                  {groupIndex > 0 && <Separator className="my-2" />}

                  {/* Group header */}
                  <div className="px-4 py-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {group.label}
                    </span>
                  </div>

                  {/* Group notifications */}
                  {group.notifications.map((notification) => {
                    const TypeIcon = NOTIFICATION_TYPE_ICONS[notification.type];
                    const iconColor = NOTIFICATION_TYPE_COLORS[notification.type];
                    const hasLink = notification.entity_type && notification.entity_id;

                    return (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/50',
                          !notification.read && 'bg-muted/30'
                        )}
                      >
                        {/* Icon */}
                        <div className={cn('mt-0.5 flex-shrink-0', iconColor)}>
                          <TypeIcon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                'text-sm',
                                !notification.read && 'font-medium'
                              )}
                            >
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                            )}
                          </div>

                          {notification.message && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {notification.message}
                            </p>
                          )}

                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(notification.created_at)}
                            </span>
                            {hasLink && (
                              <span className="flex items-center text-xs text-primary">
                                <ExternalLink className="mr-0.5 h-3 w-3" />
                                View
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Read indicator */}
                        {notification.read && (
                          <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > maxNotifications && (
          <div className="border-t px-4 py-2 text-center">
            <span className="text-xs text-muted-foreground">
              Showing {maxNotifications} of {notifications.length} notifications
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;

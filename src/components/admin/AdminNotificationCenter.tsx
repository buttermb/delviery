/**
 * AdminNotificationCenter
 * Real-time notification bell for the admin header.
 * Shows unread count badge, grouped notifications by type,
 * clickable links to relevant pages, and mark-as-read functionality.
 *
 * Phase 2: Replaced 8 Supabase realtime channels with eventBus subscriptions.
 * Events flow: DB → useRealtimeSync → eventBus → this component.
 */

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  Info,
  X,
  ShoppingCart,
  Package,
  CreditCard,
  UserPlus,
  Truck,
  Flame,
  RotateCcw,
  CheckCheck,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { eventBus } from '@/lib/eventBus';

// ============================================================================
// Types
// ============================================================================

export type NotificationEventType =
  | 'new_order'
  | 'low_stock'
  | 'payment_received'
  | 'menu_burned'
  | 'new_customer'
  | 'order_ready'
  | 'refund_processed'
  | 'fraud_alert'
  | 'age_verification'
  | 'courier_application';

interface AdminNotification {
  id: string;
  type: NotificationEventType;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
  entityId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_NOTIFICATIONS = 50;
const STORAGE_READ_KEY = STORAGE_KEYS.ADMIN_NOTIFICATIONS_READ;

const NOTIFICATION_TYPE_CONFIG: Record<NotificationEventType, {
  icon: typeof Bell;
  color: string;
  label: string;
}> = {
  new_order: { icon: ShoppingCart, color: 'text-blue-500', label: 'Orders' },
  low_stock: { icon: Package, color: 'text-amber-500', label: 'Inventory' },
  payment_received: { icon: CreditCard, color: 'text-emerald-500', label: 'Payments' },
  menu_burned: { icon: Flame, color: 'text-orange-500', label: 'Menus' },
  new_customer: { icon: UserPlus, color: 'text-violet-500', label: 'Customers' },
  order_ready: { icon: Truck, color: 'text-cyan-500', label: 'Fulfillment' },
  refund_processed: { icon: RotateCcw, color: 'text-rose-500', label: 'Refunds' },
  fraud_alert: { icon: AlertTriangle, color: 'text-red-500', label: 'Security' },
  age_verification: { icon: Info, color: 'text-sky-500', label: 'Verification' },
  courier_application: { icon: Truck, color: 'text-indigo-500', label: 'Couriers' },
};

// ============================================================================
// Helpers
// ============================================================================

function getReadIds(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_READ_KEY);
    if (stored) {
      return new Set(JSON.parse(stored) as string[]);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function persistReadIds(ids: Set<string>): void {
  try {
    // Keep only last 200 IDs to prevent unbounded growth
    const arr = Array.from(ids).slice(-200);
    localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(arr));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Component
// ============================================================================

export const AdminNotificationCenter = () => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Compute unread count
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read && !readIds.has(n.id)).length,
    [notifications, readIds]
  );

  // Group notifications by type for display
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, AdminNotification[]> = {};
    for (const n of notifications) {
      const label = NOTIFICATION_TYPE_CONFIG[n.type]?.label ?? 'Other';
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(n);
    }
    return groups;
  }, [notifications]);

  // Add a notification
  const addNotification = useCallback(
    (data: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>) => {
      const notification: AdminNotification = {
        ...data,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date(),
        read: false,
      };
      setNotifications((prev) => [notification, ...prev].slice(0, MAX_NOTIFICATIONS));
    },
    []
  );

  // Build admin route link
  const adminLink = useCallback(
    (path: string) => (tenantSlug ? `/${tenantSlug}/admin/${path}` : `/admin/${path}`),
    [tenantSlug]
  );

  // Set up eventBus subscriptions (replaces 8 Supabase realtime channels)
  useEffect(() => {
    if (!tenantId) return;

    const unsubscribers: Array<() => void> = [];

    // --- New orders (replaces 4 order table channels + marketplace) ---
    unsubscribers.push(
      eventBus.subscribe('order_created', (payload) => {
        if (payload.tenantId !== tenantId) return;
        const orderNum = payload.orderId.slice(0, 8);
        addNotification({
          type: 'new_order',
          severity: 'info',
          title: 'New Order Received',
          message: `Order #${orderNum}`,
          link: adminLink('orders'),
          entityId: payload.orderId,
        });
      })
    );

    unsubscribers.push(
      eventBus.subscribe('menu_order_created', (payload) => {
        if (payload.tenantId !== tenantId) return;
        const orderNum = payload.orderId.slice(0, 8);
        const amountStr = payload.totalAmount ? ` - ${formatCurrency(payload.totalAmount)}` : '';
        addNotification({
          type: 'new_order',
          severity: 'info',
          title: 'New Menu Order',
          message: `Order #${orderNum}${amountStr}`,
          link: adminLink('orders'),
          entityId: payload.orderId,
        });
      })
    );

    // --- Order ready (delivery status changes) ---
    unsubscribers.push(
      eventBus.subscribe('delivery_status_changed', (payload) => {
        if (payload.tenantId !== tenantId) return;
        if (payload.newStatus === 'ready' || payload.newStatus === 'ready_for_pickup') {
          addNotification({
            type: 'order_ready',
            severity: 'success',
            title: 'Order Ready',
            message: `Order is ready for pickup/delivery`,
            link: adminLink('orders'),
            entityId: payload.orderId,
          });
        }
      })
    );

    // --- Order status → ready notification (from order_updated) ---
    unsubscribers.push(
      eventBus.subscribe('order_updated', (payload) => {
        if (payload.tenantId !== tenantId) return;
        if (payload.status === 'ready' || payload.status === 'ready_for_pickup') {
          const orderNum = payload.orderId.slice(0, 8);
          addNotification({
            type: 'order_ready',
            severity: 'success',
            title: 'Order Ready',
            message: `Order #${orderNum} is ready for pickup/delivery`,
            link: adminLink('orders'),
            entityId: payload.orderId,
          });
        }
      })
    );

    // --- Low stock (replaces products channel) ---
    unsubscribers.push(
      eventBus.subscribe('inventory_changed', (payload) => {
        if (payload.tenantId !== tenantId) return;
        if (payload.newQuantity > 10 || payload.newQuantity < 0) return;

        addNotification({
          type: 'low_stock',
          severity: payload.newQuantity <= 0 ? 'error' : 'warning',
          title: payload.newQuantity <= 0 ? 'Out of Stock' : 'Low Stock Alert',
          message: `${payload.newQuantity} remaining`,
          link: adminLink('inventory'),
          entityId: payload.productId,
        });
      })
    );

    // --- Payments (replaces payments channel) ---
    unsubscribers.push(
      eventBus.subscribe('payment_received', (payload) => {
        if (payload.tenantId !== tenantId) return;
        addNotification({
          type: 'payment_received',
          severity: 'success',
          title: 'Payment Received',
          message: `${formatCurrency(payload.amount)} payment processed`,
          link: adminLink('finance'),
          entityId: payload.paymentId,
        });
      })
    );

    // --- New customers (replaces customers channel) ---
    unsubscribers.push(
      eventBus.subscribe('customer_updated', (payload) => {
        if (payload.tenantId !== tenantId) return;
        if (payload.changes?.type !== 'insert') return;
        addNotification({
          type: 'new_customer',
          severity: 'info',
          title: 'New Customer Signup',
          message: 'New customer registered',
          link: adminLink('customers'),
          entityId: payload.customerId,
        });
      })
    );

    // --- Fraud alerts (replaces fraud_flags channel) ---
    unsubscribers.push(
      eventBus.subscribe('fraud_alert', (payload) => {
        if (payload.tenantId !== tenantId) return;
        addNotification({
          type: 'fraud_alert',
          severity: 'error',
          title: 'Fraud Alert',
          message: `New fraud flag: ${payload.flagType ?? 'Unknown'}`,
          link: adminLink('security'),
          entityId: payload.flagId,
        });
      })
    );

    // --- Order cancelled ---
    unsubscribers.push(
      eventBus.subscribe('order_cancelled', (payload) => {
        if (payload.tenantId !== tenantId) return;
        const orderNum = payload.orderId.slice(0, 8);
        addNotification({
          type: 'new_order',
          severity: 'warning',
          title: 'Order Cancelled',
          message: `Order #${orderNum} was cancelled${payload.reason ? `: ${payload.reason}` : ''}`,
          link: adminLink('orders'),
          entityId: payload.orderId,
        });
      })
    );

    logger.info('Notification center initialized (eventBus mode)', {
      tenantId,
      subscriptionCount: unsubscribers.length,
      component: 'AdminNotificationCenter',
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [tenantId, addNotification, adminLink]);

  // Mark single notification as read
  const markAsRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        persistReadIds(next);
        return next;
      });
    },
    []
  );

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      persistReadIds(next);
      return next;
    });
  }, [notifications]);

  // Clear a notification
  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback(
    (notification: AdminNotification) => {
      markAsRead(notification.id);
      if (notification.link) {
        setOpen(false);
        navigate(notification.link);
      }
    },
    [markAsRead, navigate]
  );

  // Get type icon
  const getTypeIcon = (type: NotificationEventType) => {
    const config = NOTIFICATION_TYPE_CONFIG[type];
    if (!config) return <Bell className="h-4 w-4 text-muted-foreground" />;
    const IconComponent = config.icon;
    return <IconComponent className={cn('h-4 w-4', config.color)} />;
  };

  // Format relative time
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  };

  const hasNotifications = notifications.length > 0;
  const groupKeys = Object.keys(groupedNotifications);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 text-xs">
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[460px]">
          {!hasNotifications ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">
                You will see real-time updates here as events happen.
              </p>
            </div>
          ) : (
            <div>
              {groupKeys.map((groupLabel) => (
                <div key={groupLabel}>
                  <div className="px-3 py-1.5 bg-muted/50 border-b">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {groupLabel}
                    </span>
                  </div>
                  <div className="divide-y">
                    {groupedNotifications[groupLabel].map((notification) => {
                      const isRead = notification.read || readIds.has(notification.id);
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            'p-3 hover:bg-muted/50 transition-colors cursor-pointer group',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            !isRead && 'bg-primary/5 border-l-2 border-l-primary'
                          )}
                          onClick={() => handleNotificationClick(notification)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNotificationClick(notification);
                          }}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex-shrink-0">
                              {getTypeIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={cn(
                                  'text-sm truncate',
                                  !isRead ? 'font-semibold' : 'font-medium'
                                )}>
                                  {notification.title}
                                </p>
                                {notification.link && (
                                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-1">
                                {formatTime(notification.timestamp)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearNotification(notification.id);
                              }}
                              aria-label="Dismiss notification"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {hasNotifications && (
          <div className="border-t p-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setOpen(false);
                navigate(adminLink('activity-logs'));
              }}
            >
              View all activity
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

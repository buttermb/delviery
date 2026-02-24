/**
 * Smart Notifications Center
 * Actionable, prioritized notifications instead of generic alerts
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bell,
  Package,
  CreditCard,
  AlertCircle,
  UserPlus,
  TrendingUp,
  ExternalLink,
  X,
  CheckCheck,
} from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';

// Type definitions
type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';
type NotificationType = 'inventory' | 'payment' | 'order' | 'customer' | 'insight';

interface NotificationAction {
  label: string;
  href: string;
}

interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  action?: NotificationAction;
  read: boolean;
  created_at: string;
}

export function SmartNotificationsCenter() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [open, setOpen] = useState(false);

  // Local state for read/dismissed notifications
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEYS.NOTIFICATIONS_READ_PREFIX}${tenantId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage
  const markAsRead = (id: string) => {
    const newIds = [...readNotificationIds, id];
    setReadNotificationIds(newIds);
    localStorage.setItem(`${STORAGE_KEYS.NOTIFICATIONS_READ_PREFIX}${tenantId}`, JSON.stringify(newIds));
  };

  const markAllAsRead = () => {
    if (!notifications) return;
    const newIds = [...readNotificationIds, ...notifications.map(n => n.id)];
    // Deduplicate
    const uniqueIds = Array.from(new Set(newIds));
    setReadNotificationIds(uniqueIds);
    localStorage.setItem(`${STORAGE_KEYS.NOTIFICATIONS_READ_PREFIX}${tenantId}`, JSON.stringify(uniqueIds));
  };

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: queryKeys.tenantWidgets.smartNotifications(tenantId, readNotificationIds.length),
    queryFn: async () => {
      if (!tenantId) return [];

      // Generate smart notifications based on business data
      const notifs: Notification[] = [];

      // Check for low stock items from products table (CRITICAL)
      const { data: products } = await supabase
        .from('products')
        .select('name, available_quantity, stock_quantity, low_stock_alert')
        .eq('tenant_id', tenantId);

      const DEFAULT_LOW_STOCK_THRESHOLD = 10;
      const lowStockProducts = products?.filter(item => {
        const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
        const threshold = item.low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD;
        return currentQty <= threshold;
      }) || [];

      if (lowStockProducts.length > 0) {
        lowStockProducts.forEach((item) => {
          const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
          notifs.push({
            id: `low-stock-${item.name}`,
            type: 'inventory',
            priority: 'critical',
            title: `${item.name} is low`,
            message: `Only ${currentQty.toFixed(1)} units left. Restock now to avoid stockouts.`,
            action: {
              label: 'Restock Now',
              href: `/${tenantSlug}/admin/inventory/products?search=${encodeURIComponent(item.name || '')}`
            },
            read: false,
            created_at: new Date().toISOString()
          });
        });
      }

      // Check for pending orders >24hrs (HIGH)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: pendingOrders } = await supabase
        .from('wholesale_orders')
        .select('id, client_id, created_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .lt('created_at', oneDayAgo.toISOString());

      if (pendingOrders && pendingOrders.length > 0) {
        notifs.push({
          id: 'pending-orders',
          type: 'order',
          priority: 'high',
          title: `${pendingOrders.length} pending orders`,
          message: `Orders over 24 hours old need attention`,
          action: {
            label: 'Process Orders',
            href: `/${tenantSlug}/admin/wholesale-orders?status=pending`
          },
          read: false,
          created_at: oneDayAgo.toISOString()
        });
      }

      // Check for new customers today (MEDIUM)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: newCustomers } = await supabase
        .from('wholesale_clients')
        .select('id, business_name')
        .eq('tenant_id', tenantId)
        .gte('created_at', today.toISOString());

      if (newCustomers && newCustomers.length > 0) {
        notifs.push({
          id: 'new-customers',
          type: 'customer',
          priority: 'medium',
          title: `${newCustomers.length} new customers`,
          message: 'Send a welcome message to get started',
          action: {
            label: 'View Customers',
            href: `/${tenantSlug}/admin/customers?filter=new`
          },
          read: false,
          created_at: new Date().toISOString()
        });
      }

      // Filter out or mark read
      const processed = notifs.map(n => ({
        ...n,
        read: readNotificationIds.includes(n.id)
      })).filter(n => !n.read);

      return processed.sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: !!tenantId,
    refetchInterval: 60000 // Refresh every minute
  });

  const unreadCount = notifications.length;

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'inventory': return Package;
      case 'payment': return CreditCard;
      case 'order': return AlertCircle;
      case 'customer': return UserPlus;
      case 'insight': return TrendingUp;
    }
  };

  const handleAction = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.action) {
      navigate(notification.action.href);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center animate-pulse"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="glass-card w-96 p-0 border-white/10" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} new</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 opacity-20" />
              </div>
              <p className="font-medium">All caught up!</p>
              <p className="text-xs mt-1">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className="p-4 hover:bg-muted/50 transition-colors bg-background group relative"
                  >
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-full h-fit ${getPriorityColor(notification.priority)} shadow-sm`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 space-y-1 pr-6">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm leading-tight">{notification.title}</h4>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatSmartDate(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">
                          {notification.message}
                        </p>
                        {notification.action && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-xs"
                            onClick={() => handleAction(notification)}
                          >
                            {notification.action.label}
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {/* Dismiss Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

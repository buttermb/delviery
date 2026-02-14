/**
 * NotificationCenter Page
 *
 * Full-page view of all notifications across modules.
 * Tabs: All, Orders, Inventory, Deliveries, Customers, System.
 * Each notification shows title, message, timestamp, related entity link, read status.
 * Bulk mark as read. Filter by type and date. Infinite scroll.
 * Settings link to notification preferences.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  Settings,
  Filter,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import type { Notification } from '@/hooks/useNotifications';
import type { EntityType } from '@/lib/constants/entityTypes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useEntityNavigation } from '@/hooks/useEntityNavigation';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// --- Constants ---

const PAGE_SIZE = 20;

/** Module category tabs mapping entity_type strings to tab categories */
const ENTITY_TO_MODULE: Record<string, string> = {
  order: 'orders',
  orders: 'orders',
  product: 'inventory',
  products: 'inventory',
  inventory: 'inventory',
  customer: 'customers',
  customers: 'customers',
  delivery: 'deliveries',
  deliveries: 'deliveries',
  vendor: 'system',
  vendors: 'system',
  menu: 'system',
  menus: 'system',
  disposable_menu: 'system',
  payment: 'orders',
  payments: 'orders',
  storefront: 'system',
  storefronts: 'system',
};

/** Map entity_type strings to EntityType for navigation */
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
  delivery: 'DELIVERY',
  deliveries: 'DELIVERY',
  payment: 'PAYMENT',
  payments: 'PAYMENT',
  inventory: 'INVENTORY',
  storefront: 'STOREFRONT',
  storefronts: 'STOREFRONT',
};

const NOTIFICATION_TYPE_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
} as const;

const NOTIFICATION_TYPE_COLORS = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
  success: 'text-green-500',
} as const;

type TabValue = 'all' | 'orders' | 'inventory' | 'deliveries' | 'customers' | 'system';
type TypeFilter = 'all' | 'info' | 'warning' | 'error' | 'success';

const TABS: { value: TabValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'orders', label: 'Orders' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'deliveries', label: 'Deliveries' },
  { value: 'customers', label: 'Customers' },
  { value: 'system', label: 'System' },
];

// --- Helper Functions ---

function getModuleForNotification(notification: Notification): string {
  if (!notification.entity_type) return 'system';
  return ENTITY_TO_MODULE[notification.entity_type.toLowerCase()] ?? 'system';
}

function formatTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

// --- Components ---

function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}

function NotificationItem({ notification, onMarkAsRead, onNavigate }: NotificationItemProps) {
  const TypeIcon = NOTIFICATION_TYPE_ICONS[notification.type] ?? Info;
  const iconColor = NOTIFICATION_TYPE_COLORS[notification.type] ?? 'text-muted-foreground';
  const hasLink = notification.entity_type && notification.entity_id;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50',
        !notification.read && 'border-primary/20 bg-muted/30'
      )}
    >
      <div className={cn('mt-0.5 flex-shrink-0', iconColor)}>
        <TypeIcon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm', !notification.read && 'font-semibold')}>
            {notification.title}
          </p>
          <div className="flex items-center gap-2">
            {!notification.read && (
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            )}
          </div>
        </div>

        {notification.message && (
          <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {formatTime(notification.created_at)}
          </span>

          {notification.entity_type && (
            <Badge variant="outline" className="text-xs">
              {notification.entity_type}
            </Badge>
          )}

          {hasLink && (
            <button
              onClick={() => onNavigate(notification)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View
            </button>
          )}

          {!notification.read && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function NotificationCenter() {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const tenantSlug = tenant?.slug;
  const userId = admin?.userId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { navigateToEntity, isReady: isNavReady } = useEntityNavigation();

  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite query for notifications
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.notifications.list(tenantId, { tab: activeTab, type: typeFilter }),
    queryFn: async ({ pageParam = 0 }): Promise<Notification[]> => {
      if (!tenantId) return [];

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      const { data: rows, error: queryError } = await query;

      if (queryError) {
        if (queryError.code === '42P01') {
          logger.warn('Notifications table does not exist yet', {
            component: 'NotificationCenter',
            tenantId,
          });
          return [];
        }
        throw queryError;
      }

      return (rows ?? []) as Notification[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    enabled: !!tenantId,
    staleTime: 10000,
  });

  // Flatten pages
  const allNotifications = useMemo(
    () => data?.pages.flat() ?? [],
    [data]
  );

  // Filter by active tab (module category)
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return allNotifications;
    return allNotifications.filter((n) => getModuleForNotification(n) === activeTab);
  }, [allNotifications, activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<TabValue, number> = {
      all: 0,
      orders: 0,
      inventory: 0,
      deliveries: 0,
      customers: 0,
      system: 0,
    };

    for (const n of allNotifications) {
      if (!n.read) {
        counts.all++;
        const module = getModuleForNotification(n) as TabValue;
        if (module in counts) {
          counts[module]++;
        }
      }
    }

    return counts;
  }, [allNotifications]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Mark single as read
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
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (err) => {
      logger.error('Failed to mark notification as read', err as Error, {
        component: 'NotificationCenter',
      });
      toast.error('Failed to mark notification as read');
    },
  });

  // Bulk mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant context');

      let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('tenant_id', tenantId)
        .eq('read', false);

      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { error: updateError } = await query;
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      toast.success('All notifications marked as read');
    },
    onError: (err) => {
      logger.error('Failed to mark all notifications as read', err as Error, {
        component: 'NotificationCenter',
      });
      toast.error('Failed to mark notifications as read');
    },
  });

  // Navigate to entity
  const handleNavigate = useCallback(
    (notification: Notification) => {
      if (!notification.entity_type || !notification.entity_id) return;

      const entityType = ENTITY_TYPE_MAP[notification.entity_type.toLowerCase()];
      if (entityType && isNavReady) {
        navigateToEntity(entityType, notification.entity_id);
      } else {
        logger.warn('Cannot navigate to entity', {
          component: 'NotificationCenter',
          entityType: notification.entity_type,
          entityId: notification.entity_id,
        });
      }
    },
    [navigateToEntity, isNavReady]
  );

  const handleMarkAsRead = useCallback(
    (id: string) => {
      markAsReadMutation.mutate(id);
    },
    [markAsReadMutation]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  const handleSettingsClick = useCallback(() => {
    if (tenantSlug) {
      navigate(`/${tenantSlug}/admin/notifications`);
    }
  }, [navigate, tenantSlug]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-10 w-full" />
        <NotificationSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Failed to load notifications. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Center</h1>
          <p className="text-muted-foreground">
            Central hub for all module alerts and notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tabCounts.all > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              {markAllAsReadMutation.isPending ? 'Marking...' : 'Mark all as read'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSettingsClick}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={typeFilter}
          onValueChange={(val) => setTypeFilter(val as TypeFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="success">Success</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as TabValue)}
        className="w-full"
      >
        <TabsList className="w-full justify-start">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="relative">
              {tab.label}
              {tabCounts[tab.value] > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1.5 h-5 min-w-[20px] px-1.5 text-xs"
                >
                  {tabCounts[tab.value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="mb-3 h-10 w-10" />
                  <p className="text-sm font-medium">No notifications</p>
                  <p className="mt-1 text-xs">
                    {activeTab === 'all'
                      ? "You're all caught up!"
                      : `No ${tab.label.toLowerCase()} notifications`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
        </div>
      )}
      {!hasNextPage && allNotifications.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          All notifications loaded
        </p>
      )}
    </div>
  );
}

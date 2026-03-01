/**
 * Storefront Live Orders Page
 * Real-time order management with Kanban board view
 * Features: realtime subscription, sound/browser notifications, status progression, delivery/pickup badges
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logActivity } from '@/lib/activityLog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  RefreshCw,
  Search,
  Filter,
  Package,
  LayoutGrid,
  List,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StorefrontLiveOrdersKanban } from '@/components/admin/storefront/StorefrontLiveOrdersKanban';
import { StorefrontLiveOrdersTable } from '@/components/admin/storefront/StorefrontLiveOrdersTable';
import { OrderDetailPanel } from '@/components/admin/storefront/OrderDetailPanel';
import { CancelOrderDialog } from '@/components/admin/storefront/CancelOrderDialog';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { playNewOrderSound as playSoundAlert, initAudio, isSoundEnabled, setSoundEnabled as persistSoundEnabled } from '@/lib/soundAlerts';

/** Status progression order */
const STATUS_PROGRESSION = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Returns valid next statuses for an order based on its current status and fulfillment type.
 * Follows the defined progression: pending → confirmed → preparing → ready → out_for_delivery/completed → delivered
 */
export function getValidNextStatuses(
  currentStatus: string,
  fulfillmentType: 'delivery' | 'pickup'
): Array<{ status: string; label: string; variant: 'default' | 'destructive' }> {
  switch (currentStatus) {
    case 'pending':
      return [
        { status: 'confirmed', label: 'Confirm', variant: 'default' },
        { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
      ];
    case 'confirmed':
      return [
        { status: 'preparing', label: 'Start Preparing', variant: 'default' },
        { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
      ];
    case 'preparing':
      return [
        { status: 'ready', label: 'Mark Ready', variant: 'default' },
        { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
      ];
    case 'ready':
      return fulfillmentType === 'delivery'
        ? [
            { status: 'out_for_delivery', label: 'Out for Delivery', variant: 'default' },
            { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
          ]
        : [
            { status: 'completed', label: 'Mark Completed', variant: 'default' },
            { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
          ];
    case 'out_for_delivery':
      return [
        { status: 'delivered', label: 'Mark Delivered', variant: 'default' },
        { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
      ];
    case 'delivered':
    case 'completed':
    case 'cancelled':
      return [];
    default:
      return [];
  }
}

export interface LiveOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: unknown;
  delivery_notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  total_amount: number;
  status: string;
  shipping_method: string | null;
  created_at: string;
  items: unknown[];
  payment_status: string | null;
  payment_terms: string | null;
  stripe_payment_intent_id: string | null;
}

/** Request browser notification permission */
function requestNotificationPermission(): void {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {
      // Permission request failed, ignore
    });
  }
}

/** Show a browser notification */
function showBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/logo.svg',
      badge: '/logo.svg',
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Notification creation failed, ignore
  }
}

export function StorefrontLiveOrders() {
  const { tenant, admin } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [soundEnabled, setSoundEnabled] = useState(isSoundEnabled);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const previousOrderCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Fetch store
  const { data: store } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch Telegram link from account_settings for contact shortcuts
  const { data: telegramLink } = useQuery({
    queryKey: [...queryKeys.accountSettings.byTenant(tenantId), 'telegram-link'] as const,
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('account_settings')
        .select('telegram_video_link')
        .eq('account_id', tenantId)
        .maybeSingle();
      return (data?.telegram_video_link as string) ?? null;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch live orders
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.storefrontLiveOrders.byStore(store?.id, statusFilter),
    queryFn: async () => {
      if (!store?.id || !tenantId) return [];

      let query = supabase
        .from('marketplace_orders')
        .select('*')
        .eq('store_id', store.id)
        .eq('seller_tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Filter by active statuses if 'all', otherwise specific status
      if (statusFilter === 'all') {
        query = query.in('status', ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']);
      } else {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as LiveOrder[];
    },
    enabled: !!store?.id,
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Initialize audio on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  // Detect new orders and trigger notifications
  useEffect(() => {
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousOrderCountRef.current = pendingOrders;
      return;
    }

    if (pendingOrders > previousOrderCountRef.current) {
      if (soundEnabled) {
        playSoundAlert();
      }

      const newCount = pendingOrders - previousOrderCountRef.current;
      const message = newCount === 1
        ? 'You have a new storefront order.'
        : `You have ${newCount} new storefront orders.`;

      toast.success("New Order!");

      showBrowserNotification('New Storefront Order!', message);
    }

    previousOrderCountRef.current = pendingOrders;
  }, [orders, soundEnabled]);

  // Set up realtime subscription on storefront_orders (marketplace_orders) table
  useEffect(() => {
    if (!store?.id) return;

    const channel = supabase
      .channel(`storefront-live-orders-${store.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `store_id=eq.${store.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Storefront live orders subscription active', {
            storeId: store.id,
            component: 'StorefrontLiveOrders',
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store?.id, refetch]);

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus, previousStatus, cancellationReason }: {
      orderId: string;
      newStatus: string;
      previousStatus: string;
      cancellationReason?: string;
    }) => {
      if (!store?.id || !tenantId) throw new Error('No store or tenant context');

      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: now,
      };

      // Set the corresponding timestamp for each status transition
      const timestampMap: Record<string, string> = {
        confirmed: 'confirmed_at',
        preparing: 'preparing_at',
        ready: 'ready_at',
        out_for_delivery: 'out_for_delivery_at',
        delivered: 'delivered_at',
        completed: 'delivered_at',
        cancelled: 'cancelled_at',
      };
      const tsField = timestampMap[newStatus];
      if (tsField) {
        updateData[tsField] = now;
      }

      if (newStatus === 'cancelled' && cancellationReason) {
        updateData.cancellation_reason = cancellationReason;
      }

      const { error } = await supabase
        .from('marketplace_orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('store_id', store.id)
        .eq('seller_tenant_id', tenantId);

      if (error) throw error;

      // Restore inventory when cancelling
      if (newStatus === 'cancelled') {
        const order = orders.find(o => o.id === orderId);
        const items = Array.isArray(order?.items) ? order.items : [];
        const restoreItems = items
          .map((item) => {
            const i = item as Record<string, unknown>;
            return {
              product_id: i.product_id as string,
              quantity: typeof i.quantity === 'number' ? i.quantity : 0,
            };
          })
          .filter((i) => i.product_id && i.quantity > 0);

        if (restoreItems.length > 0) {
          const { data: restoreResult, error: restoreError } = await supabase
            .rpc('restore_storefront_inventory', { p_items: restoreItems });

          if (restoreError) {
            logger.error('Failed to restore inventory on cancel', restoreError, { component: 'StorefrontLiveOrders', orderId });
          } else {
            logger.info('Inventory restored for cancelled order', { orderId, result: restoreResult }, { component: 'StorefrontLiveOrders' });
          }
        }

        // Send optional cancellation email (fire-and-forget)
        if (order?.customer_email && cancellationReason) {
          const emailItems = items.map((item) => {
            const i = item as Record<string, unknown>;
            return {
              name: (i.name || i.product_name || 'Item') as string,
              quantity: typeof i.quantity === 'number' ? i.quantity : 1,
              price: typeof i.unit_price === 'number' ? i.unit_price : typeof i.price === 'number' ? i.price : 0,
            };
          });

          supabase.functions
            .invoke('send-order-cancellation', {
              body: {
                customer_email: order.customer_email,
                customer_name: order.customer_name || 'Customer',
                order_number: order.order_number,
                cancellation_reason: cancellationReason,
                store_name: store?.name || 'Store',
                items: emailItems,
                total: order.total || order.total_amount || 0,
              },
            })
            .then(({ error: emailError }) => {
              if (emailError) {
                logger.warn('Cancellation email failed (non-blocking)', emailError, { component: 'StorefrontLiveOrders', orderId });
              }
            });
        }
      }

      // Log activity for the timeline (fire-and-forget)
      const userId = admin?.userId;
      if (tenantId && userId) {
        logActivity(
          tenantId,
          userId,
          newStatus,
          'order',
          orderId,
          {
            previous_status: previousStatus,
            new_status: newStatus,
            user_name: admin?.name || admin?.email,
            ...(cancellationReason ? { cancellation_reason: cancellationReason } : {}),
          }
        );
      }
    },
    onMutate: ({ orderId }) => {
      setUpdatingOrderId(orderId);
    },
    onSuccess: (_, { newStatus: _newStatus }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontLiveOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      if (_newStatus === 'cancelled') {
        setCancelDialogOpen(false);
        setCancelOrderId(null);
        toast.success('Order cancelled and inventory restored');
      } else {
        toast.success(`Status changed to ${STATUS_LABELS[_newStatus] || _newStatus}`);
      }
    },
    onError: (error) => {
      logger.error('Failed to update order status', error, { component: 'StorefrontLiveOrders' });
      toast.error('Failed to update order status', { description: humanizeError(error) });
    },
    onSettled: () => {
      setUpdatingOrderId(null);
    },
  });

  const handleStatusChange = (orderId: string, newStatus: string) => {
    if (newStatus === 'cancelled') {
      setCancelOrderId(orderId);
      setCancelDialogOpen(true);
      return;
    }
    const order = orders.find(o => o.id === orderId);
    const previousStatus = order?.status ?? 'unknown';
    updateStatusMutation.mutate({ orderId, newStatus, previousStatus });
  };

  const handleCancelConfirm = (reason: string) => {
    if (!cancelOrderId) return;
    const order = orders.find(o => o.id === cancelOrderId);
    const previousStatus = order?.status ?? 'unknown';
    updateStatusMutation.mutate({
      orderId: cancelOrderId,
      newStatus: 'cancelled',
      previousStatus,
      cancellationReason: reason,
    });
  };

  const cancelOrder = useMemo(
    () => orders.find(o => o.id === cancelOrderId) ?? null,
    [orders, cancelOrderId]
  );

  const handleViewDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailPanelOpen(true);
  };

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  // Filter orders by search
  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(query) ||
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_email?.toLowerCase().includes(query)
    );
  }), [orders, searchQuery]);

  // Stats
  const { pendingCount, preparingCount, readyCount } = useMemo(() => ({
    pendingCount: orders.filter(o => o.status === 'pending').length,
    preparingCount: orders.filter(o => o.status === 'preparing' || o.status === 'confirmed').length,
    readyCount: orders.filter(o => o.status === 'ready').length,
  }), [orders]);

  if (!store) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please create a store first.</p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront-hub`)}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Live Orders
            {pendingCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {pendingCount} new
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">
            {filteredOrders.length} active orders • {preparingCount} preparing • {readyCount} ready
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Sound Toggle */}
          <Button
            variant={soundEnabled ? 'default' : 'outline'}
            size="icon"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              persistSoundEnabled(next);
              initAudio();
            }}
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
            aria-label={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          {/* View Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Board
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>

          {/* Auto-refresh */}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto
            </Label>
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Refresh live orders">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            aria-label="Search orders"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Active" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[400px] rounded-lg" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-semibold">No orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Share your store link to start getting orders!
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <StorefrontLiveOrdersKanban
          orders={filteredOrders}
          onStatusChange={handleStatusChange}
          onViewDetails={handleViewDetails}
          isLoading={isLoading}
          updatingOrderId={updatingOrderId}
          telegramLink={telegramLink}
        />
      ) : (
        <StorefrontLiveOrdersTable
          orders={filteredOrders}
          onStatusChange={handleStatusChange}
          onViewDetails={handleViewDetails}
          isLoading={isLoading}
          updatingOrderId={updatingOrderId}
          telegramLink={telegramLink}
        />
      )}

      {/* Order Detail Slide-Over */}
      <OrderDetailPanel
        order={selectedOrder}
        open={detailPanelOpen}
        onOpenChange={setDetailPanelOpen}
        onStatusChange={handleStatusChange}
        updatingOrderId={updatingOrderId}
        telegramLink={telegramLink}
      />

      {/* Cancel Order Dialog */}
      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) setCancelOrderId(null);
        }}
        orderNumber={cancelOrder?.order_number ?? ''}
        onConfirm={handleCancelConfirm}
        isPending={updateStatusMutation.isPending}
      />
    </div>
  );
}

export default StorefrontLiveOrders;

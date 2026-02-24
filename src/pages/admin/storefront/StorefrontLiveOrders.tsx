/**
 * Storefront Live Orders Page
 * Real-time order management with Kanban board view
 * Features: realtime subscription, sound/browser notifications, status progression, delivery/pickup badges
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
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
  Truck,
  Store,
  User,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StorefrontLiveOrdersKanban } from '@/components/admin/storefront/StorefrontLiveOrdersKanban';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

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
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-cyan-500',
  preparing: 'bg-blue-500',
  ready: 'bg-green-500',
  out_for_delivery: 'bg-purple-500',
  delivered: 'bg-gray-500 dark:bg-gray-600',
};

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
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
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
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch live orders
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.storefrontLiveOrders.byStore(store?.id, statusFilter),
    queryFn: async () => {
      if (!store?.id) return [];

      let query = supabase
        .from('marketplace_orders')
        .select('*')
        .eq('store_id', store.id)
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

  // Play sound on new order
  const playNewOrderSound = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const audio = new Audio('/sounds/new-order.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Autoplay blocked, ignore
      });
    } catch {
      // No sound file, ignore
    }
  }, [soundEnabled]);

  // Detect new orders and trigger notifications
  useEffect(() => {
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousOrderCountRef.current = pendingOrders;
      return;
    }

    if (pendingOrders > previousOrderCountRef.current) {
      playNewOrderSound();

      const newCount = pendingOrders - previousOrderCountRef.current;
      const message = newCount === 1
        ? 'You have a new storefront order.'
        : `You have ${newCount} new storefront orders.`;

      toast.success("New Order!");

      showBrowserNotification('New Storefront Order!', message);
    }

    previousOrderCountRef.current = pendingOrders;
  }, [orders, playNewOrderSound]);

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
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      if (!store?.id) throw new Error('No store context');

      const { error } = await supabase
        .from('marketplace_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('store_id', store.id);

      if (error) throw error;
    },
    onMutate: ({ orderId }) => {
      setUpdatingOrderId(orderId);
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontLiveOrders.all });
      toast.success("Status changed to ${STATUS_LABELS[newStatus] || newStatus}");
    },
    onError: (error) => {
      logger.error('Failed to update order status', error, { component: 'StorefrontLiveOrders' });
      toast.error("Failed to update order status", { description: humanizeError(error) });
    },
    onSettled: () => {
      setUpdatingOrderId(null);
    },
  });

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, newStatus });
  };

  const handleViewDetails = (orderId: string) => {
    navigate(`/${tenantSlug}/admin/storefront-hub?tab=orders&order=${orderId}`);
  };

  /** Determine if order is delivery or pickup based on shipping_method/delivery_address */
  const getOrderFulfillmentType = (order: LiveOrder): 'delivery' | 'pickup' => {
    if (order.shipping_method) {
      const method = order.shipping_method.toLowerCase();
      if (method.includes('pickup') || method.includes('collect')) return 'pickup';
      return 'delivery';
    }
    // Fallback: if no delivery address, assume pickup
    if (!order.delivery_address) return 'pickup';
    return 'delivery';
  };

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
            variant="outline"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
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
            <p className="text-lg font-semibold">No active orders</p>
            <p className="text-sm text-muted-foreground mt-1">
              New orders will appear here in real-time
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
        />
      ) : (
        /* List View with full order details */
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const fulfillmentType = getOrderFulfillmentType(order);
            const items = Array.isArray(order.items) ? order.items : [];
            const orderTotal = order.total || order.total_amount || 0;

            return (
              <Card
                key={order.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: order info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className="font-semibold cursor-pointer hover:underline"
                            onClick={() => handleViewDetails(order.id)}
                          >
                            #{order.order_number}
                          </p>
                          {/* Delivery vs Pickup Badge */}
                          <Badge
                            variant="outline"
                            className={fulfillmentType === 'delivery'
                              ? 'border-blue-300 text-blue-700 bg-blue-50'
                              : 'border-orange-300 text-orange-700 bg-orange-50'
                            }
                          >
                            {fulfillmentType === 'delivery' ? (
                              <><Truck className="h-3 w-3 mr-1" /> Delivery</>
                            ) : (
                              <><Store className="h-3 w-3 mr-1" /> Pickup</>
                            )}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <User className="h-3 w-3" />
                          <span>{order.customer_name || 'Guest'}</span>
                          {order.customer_phone && (
                            <span className="text-xs">• {order.customer_phone}</span>
                          )}
                        </div>
                        {/* Items summary */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Package className="h-3 w-3" />
                          <span>
                            {items.length} item{items.length !== 1 ? 's' : ''}
                            {items.length > 0 && items.length <= 3 && (
                              <span className="ml-1">
                                ({items.map((item: unknown) => {
                                  const i = item as Record<string, unknown>;
                                  return i.name || i.product_name || 'Item';
                                }).join(', ')})
                              </span>
                            )}
                          </span>
                        </div>
                        {order.delivery_notes && (
                          <p className="text-xs text-muted-foreground italic mt-1 truncate max-w-[300px]">
                            Note: {order.delivery_notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: status, amount, time, dropdown */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{getTimeSince(order.created_at)}</span>
                      </div>
                      <Badge className={STATUS_COLORS[order.status] || 'bg-gray-500 dark:bg-gray-600'}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                      <span className="font-semibold text-sm">{formatCurrency(orderTotal)}</span>
                      {/* Status update dropdown */}
                      <Select
                        value={order.status}
                        onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue placeholder="Update status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_PROGRESSION.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Calculate time since order creation */
function getTimeSince(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `${hours}h ${diffMins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default StorefrontLiveOrders;

/**
 * Storefront Orders Page
 * View and manage orders from the online store
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { CustomerLink, ProductLink } from '@/components/admin/cross-links';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  Search,
  ShoppingCart,
  Download,
  RefreshCw,
  Truck,
  Store
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { TruncatedText } from '@/components/shared/TruncatedText';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface MarketplaceOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  items: Array<{ product_name?: string; name?: string; product_id?: string; quantity?: number; price?: number; listing_id?: string }>;
  subtotal: number;
  delivery_fee: number | null;
  total: number;
  delivery_address: Record<string, unknown> | null;
  delivery_notes: string | null;
  tracking_token: string | null;
  store_id: string | null;
  created_at: string;
  updated_at: string;
  fulfillment_method?: string | null;
  // Optional fields not present in storefront_orders view
  discount_amount?: number;
  tip_amount?: number;
  payment_method?: string;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-500' },
  { value: 'preparing', label: 'Preparing', color: 'bg-purple-500' },
  { value: 'ready', label: 'Ready', color: 'bg-indigo-500' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-orange-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
  { value: 'refunded', label: 'Refunded', color: 'bg-gray-500 dark:bg-gray-600' },
];

export default function StorefrontOrders() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<MarketplaceOrder | null>(null);

  // Fetch store
  const { data: store } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('id, slug')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch orders from storefront_orders view (has correct aliased columns)
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.marketplaceOrders.byTenant(store?.id, statusFilter),
    queryFn: async () => {
      if (!store?.id) return [];

      let query = supabase
        .from('storefront_orders')
        .select('id, order_number, status, payment_status, customer_id, customer_name, customer_email, customer_phone, items, subtotal, delivery_fee, total, delivery_address, delivery_notes, tracking_token, store_id, created_at, updated_at, fulfillment_method, discount_amount, tip_amount, payment_method')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as MarketplaceOrder[];
    },
    enabled: !!store?.id,
  });

  // Filter orders by search
  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_email?.toLowerCase().includes(query) ||
      order.customer_phone?.includes(query)
    );
  }), [orders, searchQuery]);

  // Update order status mutation with retry logic
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, retryCount = 0 }: { orderId: string; status: string; retryCount?: number }) => {
      if (!store?.id || !tenantId) throw new Error('No store or tenant context');
      const MAX_RETRIES = 2;
      const updates: Record<string, unknown> = { status };

      // Set delivered_at timestamp when marking as delivered
      if (status === 'delivered') {
        updates.delivered_at = new Date().toISOString();
      }

      try {
        const { error } = await supabase
          .from('marketplace_orders')
          .update(updates)
          .eq('id', orderId)
          .eq('store_id', store.id)
          .eq('seller_tenant_id', tenantId);

        if (error) throw error;
      } catch (error) {
        const isNetworkError = error instanceof Error &&
          (error.message.toLowerCase().includes('network') ||
            error.message.toLowerCase().includes('fetch') ||
            error.message.toLowerCase().includes('timeout'));

        // Retry on network errors
        if (isNetworkError && retryCount < MAX_RETRIES) {
          toast.success("Connection issue, retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          return updateStatusMutation.mutateAsync({ orderId, status, retryCount: retryCount + 1 });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.all });
      toast.success("Order status updated!");
    },
    onError: (error) => {
      logger.error('Failed to update order status', error, { component: 'StorefrontOrders' });
      toast.error("Error", { description: humanizeError(error) });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${statusConfig?.color ?? 'bg-gray-500 dark:bg-gray-600'}`} />
        <span className="capitalize">{status.replace('_', ' ')}</span>
      </Badge>
    );
  };

  const getPaymentBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-700',
      paid: 'bg-green-500/10 text-green-700',
      failed: 'bg-red-500/10 text-red-700',
      refunded: 'bg-gray-500/10 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300',
    };
    return (
      <Badge variant="outline" className={colors[status] ?? ''}>
        {status}
      </Badge>
    );
  };

  const getFulfillmentBadge = (method: string | null | undefined) => {
    if (method === 'pickup') {
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
          <Store className="h-3 w-3 mr-1" />
          Pickup
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
        <Truck className="h-3 w-3 mr-1" />
        Delivery
      </Badge>
    );
  };

  // Order counts by status
  const orderCounts = orders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Realtime subscription for new/updated orders
  useEffect(() => {
    if (!store?.id) return;

    const channel = supabase
      .channel(`storefront-orders-${store.id}`)
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
          logger.debug('Storefront orders subscription active', {
            storeId: store.id,
            component: 'StorefrontOrders',
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store?.id, refetch]);

  if (!store) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please create a store first.</p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Order History</h1>
          <p className="text-muted-foreground">
            {orders.length} total orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Status Quick Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          All ({orders.length})
        </Button>
        {STATUS_OPTIONS.slice(0, 6).map((status) => (
          <Button
            key={status.value}
            variant={statusFilter === status.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status.value)}
          >
            <div className={`w-2 h-2 rounded-full ${status.color} mr-2`} />
            {status.label} ({orderCounts[status.value] ?? 0})
          </Button>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                aria-label="Search by order number, customer name, email, or phone"
                placeholder="Search by order #, customer name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No orders found</p>
              {orders.length === 0 && (
                <p className="text-sm mt-2">Orders will appear here when customers checkout</p>
              )}
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3 p-4">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-semibold text-sm">{order.order_number}</p>
                        <TruncatedText text={order.customer_name ?? 'Guest'} className="text-sm font-medium" as="p" />
                        <TruncatedText text={order.customer_email ?? ''} className="text-xs text-muted-foreground" as="p" />
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-3">
                        <span className="font-bold">{formatCurrency(order.total)}</span>
                        {getPaymentBadge(order.payment_status)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(order.status)}
                        {getFulfillmentBadge(order.fulfillment_method)}
                        <span className="text-xs text-muted-foreground">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatSmartDate(order.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Fulfillment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell
                          className="font-medium"
                          onClick={() => setSelectedOrder(order)}
                        >
                          {order.order_number}
                        </TableCell>
                        <TableCell onClick={() => setSelectedOrder(order)}>
                          <div>
                            <p className="font-medium">
                              <CustomerLink
                                customerId={order.customer_id}
                                customerName={order.customer_name ?? 'Guest'}
                              />
                            </p>
                            <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => setSelectedOrder(order)}>
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </TableCell>
                        <TableCell onClick={() => setSelectedOrder(order)}>
                          {formatCurrency(order.total)}
                        </TableCell>
                        <TableCell onClick={() => setSelectedOrder(order)}>
                          {getPaymentBadge(order.payment_status)}
                        </TableCell>
                        <TableCell onClick={() => setSelectedOrder(order)}>
                          {getFulfillmentBadge(order.fulfillment_method)}
                        </TableCell>
                        <TableCell onClick={() => setSelectedOrder(order)}>
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell onClick={() => setSelectedOrder(order)}>
                          {formatSmartDate(order.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={order.status}
                            onValueChange={(status) =>
                              updateStatusMutation.mutate({ orderId: order.id, status })
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Update status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                    {status.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Sheet */}
      <Sheet open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle>Order {selectedOrder.order_number}</SheetTitle>
                <SheetDescription>
                  {formatSmartDate(selectedOrder.created_at)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Select
                    value={selectedOrder.status}
                    onValueChange={(status) => {
                      updateStatusMutation.mutate({
                        orderId: selectedOrder.id,
                        status,
                      });
                      setSelectedOrder({ ...selectedOrder, status });
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Update status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${status.color}`} />
                            {status.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Customer Info */}
                <div>
                  <h3 className="font-medium mb-3">Customer</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Name:</span>{' '}
                      <CustomerLink
                        customerId={selectedOrder.customer_id}
                        customerName={selectedOrder.customer_name ?? 'Guest'}
                      />
                    </p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedOrder.customer_email}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {selectedOrder.customer_phone}</p>
                  </div>
                </div>

                <Separator />

                {/* Fulfillment Info */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-medium">Fulfillment</h3>
                    {getFulfillmentBadge(selectedOrder.fulfillment_method)}
                  </div>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.fulfillment_method === 'pickup' ? (
                      <p className="text-muted-foreground">Customer will pick up at store</p>
                    ) : (
                      <>
                        {selectedOrder.delivery_address && typeof selectedOrder.delivery_address === 'object' && (
                          <p>
                            {String((selectedOrder.delivery_address as Record<string, string>).street ?? (selectedOrder.delivery_address as Record<string, string>).address ?? '')}
                            {(selectedOrder.delivery_address as Record<string, string>).city ? `, ${String((selectedOrder.delivery_address as Record<string, string>).city)}` : ''}
                          </p>
                        )}
                      </>
                    )}
                    {selectedOrder.delivery_notes && (
                      <p className="text-muted-foreground">Notes: {selectedOrder.delivery_notes}</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Order Items */}
                <div>
                  <h3 className="font-medium mb-3">Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item: Record<string, unknown>, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <div>
                          <p className="font-medium">
                            <ProductLink
                              productId={item.product_id as string}
                              productName={(item.name as string) ?? 'Unknown Product'}
                            />
                          </p>
                          <p className="text-muted-foreground">Qty: {item.quantity as number}</p>
                        </div>
                        <p className="font-medium">{formatCurrency((item.price as number) * (item.quantity as number))}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Order Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span>{selectedOrder.delivery_fee === 0 ? 'FREE' : formatCurrency(selectedOrder.delivery_fee)}</span>
                  </div>
                  {selectedOrder.tip_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tip</span>
                      <span>{formatCurrency(selectedOrder.tip_amount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium capitalize">{selectedOrder.payment_method ?? 'Online'}</p>
                      <p className="text-xs text-muted-foreground">Payment method</p>
                    </div>
                    {getPaymentBadge(selectedOrder.payment_status)}
                  </div>
                </div>

                {/* Tracking Link */}
                {selectedOrder.tracking_token && (
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <p className="text-sm font-medium mb-1">Tracking Link</p>
                    <code className="text-xs text-muted-foreground break-all">
                      {window.location.origin}/shop/{store?.slug ?? store?.id}/track/{selectedOrder.tracking_token}
                    </code>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}





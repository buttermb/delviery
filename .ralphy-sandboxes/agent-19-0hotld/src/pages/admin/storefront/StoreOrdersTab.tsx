/**
 * StoreOrdersTab Component
 * Displays orders from the storefront for a specific store
 * Can be used as a tab in store management pages
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import Search from "lucide-react/dist/esm/icons/search";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Package from "lucide-react/dist/esm/icons/package";
import Clock from "lucide-react/dist/esm/icons/clock";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import Truck from "lucide-react/dist/esm/icons/truck";
import Eye from "lucide-react/dist/esm/icons/eye";
import { formatCurrency } from '@/lib/utils/formatCurrency';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface StoreOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  tip_amount: number;
  total: number;
  delivery_address: DeliveryAddress | null;
  delivery_notes: string | null;
  payment_method: string;
  tracking_token: string;
  created_at: string;
  updated_at: string;
}

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string | null;
  variant?: string;
}

interface DeliveryAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500', icon: Clock },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-500', icon: CheckCircle },
  { value: 'preparing', label: 'Preparing', color: 'bg-purple-500', icon: Package },
  { value: 'ready', label: 'Ready', color: 'bg-indigo-500', icon: Package },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-orange-500', icon: Truck },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500', icon: XCircle },
  { value: 'refunded', label: 'Refunded', color: 'bg-gray-500 dark:bg-gray-600', icon: XCircle },
];

interface StoreOrdersTabProps {
  storeId?: string;
  showHeader?: boolean;
  maxHeight?: string;
}

export function StoreOrdersTab({
  storeId: propStoreId,
  showHeader = true,
  maxHeight,
}: StoreOrdersTabProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);

  // Fetch store if not provided
  const { data: store } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('id, slug, store_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !propStoreId,
  });

  const effectiveStoreId = propStoreId || store?.id;

  // Fetch orders for the store from storefront_orders view (correct aliased columns)
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.storeOrdersTab.byStore(effectiveStoreId, statusFilter),
    queryFn: async () => {
      if (!effectiveStoreId) return [];

      let query = supabase
        .from('storefront_orders')
        .select('id, order_number, status, payment_status, customer_id, customer_name, customer_email, customer_phone, items, subtotal, delivery_fee, discount_amount, tip_amount, total, delivery_address, delivery_notes, payment_method, tracking_token, created_at, updated_at')
        .eq('store_id', effectiveStoreId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        logger.error('Failed to fetch store orders', error, { component: 'StoreOrdersTab' });
        throw error;
      }
      return (data ?? []) as unknown as StoreOrder[];
    },
    enabled: !!effectiveStoreId,
  });

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter((order) =>
      order.order_number?.toLowerCase().includes(query) ||
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_email?.toLowerCase().includes(query) ||
      order.customer_phone?.includes(query)
    );
  }, [orders, searchQuery]);

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      if (!effectiveStoreId) throw new Error('No store');

      const updates: Record<string, unknown> = { status };

      // Set delivered_at timestamp when marking as delivered
      if (status === 'delivered') {
        updates.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('marketplace_orders')
        .update(updates)
        .eq('id', orderId)
        .eq('store_id', effectiveStoreId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storeOrdersTab.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.all });
      toast.success("Order status updated!");
    },
    onError: (error) => {
      logger.error('Failed to update order status', error, { component: 'StoreOrdersTab' });
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

  // Order counts by status
  const orderCounts = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [orders]);

  // Order stats
  const stats = useMemo(() => {
    const pending = orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length;
    const inProgress = orders.filter(o => ['preparing', 'ready', 'out_for_delivery'].includes(o.status)).length;
    const completed = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders
      .filter(o => !['cancelled', 'refunded'].includes(o.status))
      .reduce((sum, o) => sum + (o.total ?? 0), 0);

    return { pending, inProgress, completed, totalRevenue, total: orders.length };
  }, [orders]);

  if (!effectiveStoreId && !isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No store configured.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create a storefront to start receiving orders.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold">Store Orders</h2>
            <p className="text-muted-foreground text-sm">
              {stats.total} total orders • {formatCurrency(stats.totalRevenue)} revenue
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShoppingCart className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
          </div>
        </Card>
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

      {/* Search */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              aria-label="Search by order number, customer name, email, or phone"
              placeholder="Search by order #, customer name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
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
              <p className="font-medium">No orders found</p>
              {orders.length === 0 && (
                <p className="text-sm mt-2">Orders will appear here when customers checkout from your store</p>
              )}
            </div>
          ) : (
            <ScrollArea style={{ maxHeight: maxHeight ?? 'auto' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Payment</TableHead>
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
                          <p className="font-medium">{order.customer_name ?? 'Guest'}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setSelectedOrder(order)}>
                        {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell onClick={() => setSelectedOrder(order)}>
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell onClick={() => setSelectedOrder(order)}>
                        {getPaymentBadge(order.payment_status)}
                      </TableCell>
                      <TableCell onClick={() => setSelectedOrder(order)}>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell onClick={() => setSelectedOrder(order)}>
                        {formatSmartDate(order.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => setSelectedOrder(order)}
                            aria-label="View order"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Select
                            value={order.status}
                            onValueChange={(status) =>
                              updateStatusMutation.mutate({ orderId: order.id, status })
                            }
                          >
                            <SelectTrigger className="w-[130px] h-8">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
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
                    <p><span className="text-muted-foreground">Name:</span> {selectedOrder.customer_name ?? 'Guest'}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedOrder.customer_email ?? '-'}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {selectedOrder.customer_phone ?? '-'}</p>
                  </div>
                </div>

                <Separator />

                {/* Delivery Info */}
                {selectedOrder.delivery_address && (
                  <>
                    <div>
                      <h3 className="font-medium mb-3">Delivery</h3>
                      <div className="space-y-2 text-sm">
                        <p>
                          {selectedOrder.delivery_address.street}
                          {selectedOrder.delivery_address.city && `, ${selectedOrder.delivery_address.city}`}
                        </p>
                        {selectedOrder.delivery_notes && (
                          <p className="text-muted-foreground">Notes: {selectedOrder.delivery_notes}</p>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Order Items */}
                <div>
                  <h3 className="font-medium mb-3">Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-muted-foreground">
                            Qty: {item.quantity}
                            {item.variant && ` • ${item.variant}`}
                          </p>
                        </div>
                        <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
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
                      <p className="text-sm font-medium capitalize">{selectedOrder.payment_method}</p>
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
                      {window.location.origin}/shop/{store?.slug ?? effectiveStoreId}/track/{selectedOrder.tracking_token}
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

export default StoreOrdersTab;

/**
 * Storefront Live Orders Page
 * Real-time order management for the storefront
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  MapPin,
  Package,
  Clock,
  Truck,
  DollarSign,
  CheckCircle,
  Phone,
  User,
  Eye
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LiveOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: any;
  delivery_notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
  items: any[];
}

const STATUS_FLOW = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  preparing: 'bg-purple-500',
  ready: 'bg-indigo-500',
  out_for_delivery: 'bg-orange-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

export default function StorefrontLiveOrders() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch store
  const { data: store } = useQuery({
    queryKey: ['marketplace-store', tenantId],
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
    queryKey: ['storefront-live-orders', store?.id, statusFilter],
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
      return (data || []) as unknown as LiveOrder[];
    },
    enabled: !!store?.id,
    refetchInterval: autoRefresh ? 15000 : false, // Auto-refresh every 15s
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!store?.id) return;

    const channel = supabase
      .channel('storefront-orders-changes')
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
      .subscribe();

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
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-live-orders'] });
      toast({
        title: 'Order updated',
        description: `Status changed to ${formatStatus(newStatus)}`,
      });
    },
    onError: (error) => {
      logger.error('Failed to update order status', error, { component: 'StorefrontLiveOrders' });
      toast({
        title: 'Error',
        description: 'Failed to update order status',
        variant: 'destructive',
      });
    },
  });

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Filter orders by search
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(query) ||
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_email?.toLowerCase().includes(query)
    );
  });

  if (!store) {
    return (
      <div className="container mx-auto p-6">
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Live Orders
              <Badge variant="secondary" className="animate-pulse">
                {filteredOrders.length} active
              </Badge>
            </h1>
            <p className="text-muted-foreground">Real-time order management</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh
            </Label>
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by order #, name, or email..."
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
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-semibold">No active orders</p>
            <p className="text-sm text-muted-foreground">
              New orders will appear here in real-time
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => {
            const nextStatus = STATUS_FLOW[order.status as keyof typeof STATUS_FLOW];

            return (
              <Card key={order.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        Order #{order.order_number}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Clock className="w-4 h-4" />
                        {formatSmartDate(order.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[order.status] || 'bg-gray-500'}>
                        {formatStatus(order.status)}
                      </Badge>
                      {order.payment_method && (
                        <Badge variant="outline" className="capitalize">
                          {order.payment_method}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Customer Info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <User className="w-4 h-4 text-primary" />
                        Customer
                      </div>
                      <div className="text-sm pl-6">
                        <p className="font-medium">{order.customer_name || 'Guest'}</p>
                        {order.customer_email && (
                          <p className="text-muted-foreground">{order.customer_email}</p>
                        )}
                        {order.customer_phone && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.customer_phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Delivery Info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <MapPin className="w-4 h-4 text-primary" />
                        Delivery Address
                      </div>
                      <div className="text-sm pl-6">
                        {order.delivery_address ? (
                          <>
                            <p>{order.delivery_address.street}</p>
                            {order.delivery_address.apartment && (
                              <p>{order.delivery_address.apartment}</p>
                            )}
                            <p className="text-muted-foreground">
                              {order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.zip}
                            </p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">No address provided</p>
                        )}
                        {order.delivery_notes && (
                          <p className="text-muted-foreground italic mt-1">
                            Note: {order.delivery_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Package className="w-4 h-4 text-primary" />
                      Items ({order.items?.length || 0})
                    </div>
                    <div className="pl-6 space-y-1">
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>
                            {item.name} × {item.quantity}
                          </span>
                          <span className="text-muted-foreground">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery</span>
                        <span>
                          {order.delivery_fee === 0 ? (
                            <Badge variant="secondary" className="text-xs">FREE</Badge>
                          ) : (
                            formatCurrency(order.delivery_fee)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>Total</span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {order.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {nextStatus && (
                      <Button
                        size="sm"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            orderId: order.id,
                            newStatus: nextStatus,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as {formatStatus(nextStatus)}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(`/${tenantSlug}/admin/storefront/orders/${order.id}`)
                      }
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
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

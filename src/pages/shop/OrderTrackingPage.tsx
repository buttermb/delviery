/**
 * Order Tracking Page
 * Track order status with timeline
 */

import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  XCircle,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';
import { DeliveryRatingForm } from '@/components/shop/DeliveryRatingForm';
import { queryKeys } from '@/lib/queryKeys';

interface OrderDetails {
  order_id: string;
  order_number: string;
  store_name: string;
  store_logo: string | null;
  status: string;
  items: Array<{ name: string; quantity: number; price: number; weight?: string }>;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total: number;
  customer_name: string | null;
  delivery_address: Record<string, string> | null;
  payment_method: string;
  payment_status: string;
  created_at: string;
  estimated_delivery_at: string | null;
}

const STATUS_STEPS = [
  { status: 'pending', label: 'Order Placed', icon: Package },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'preparing', label: 'Preparing', icon: Clock },
  { status: 'ready', label: 'Ready', icon: Package },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function OrderTrackingPage() {
  const { storeSlug, trackingToken } = useParams<{ storeSlug: string; trackingToken: string }>();
  const { store } = useShop();
  const queryClient = useQueryClient();

  // Fetch order details with retry and auto-refresh
  const { data: order, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.shopPages.orderTracking(trackingToken),
    queryFn: async () => {
      if (!trackingToken) return null;

      try {
        const rpc = supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>;
        const { data, error } = await rpc('get_marketplace_order_by_token', { p_tracking_token: trackingToken }); // Supabase type limitation

        if (error) {
          logger.error('Order tracking fetch failed', error, { trackingToken });
          throw error;
        }
        return data?.[0] as OrderDetails | null;
      } catch (err) {
        logger.error('Order tracking error', err, { trackingToken });
        throw err;
      }
    },
    enabled: !!trackingToken,
    retry: 2, // Retry failed requests
    refetchInterval: (query) => {
      // Auto-refresh every 30s for pending/in-progress orders
      const data = query.state.data as OrderDetails | null | undefined;
      if (!data) return false;
      const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];
      return activeStatuses.includes(data.status) ? 30000 : false;
    },
  });

  // Realtime subscription for instant order status updates
  useEffect(() => {
    if (!order?.order_id) return;

    const channel = supabase
      .channel(`shop-order-tracking-${order.order_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `id=eq.${order.order_id}`,
        },
        (payload) => {
          logger.debug('Order tracking status update received', payload.new, 'ShopOrderTrackingPage');
          queryClient.invalidateQueries({ queryKey: queryKeys.shopPages.orderTracking(trackingToken) });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Realtime subscribed for order tracking', { orderId: order.order_id }, 'ShopOrderTrackingPage');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.order_id, trackingToken, queryClient]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Skeleton className="h-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <XCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
        <p className="text-muted-foreground mb-6">
          We couldn't find an order with this tracking code. Please check the code and try again.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Link to={`/shop/${storeSlug}`}>
            <Button>Return to Store</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Get current step index
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Back Link + Refresh */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to={`/shop/${storeSlug}/account`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Account
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Order Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Order Number</p>
              <p className="text-2xl font-bold">{order.order_number}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Placed on {formatSmartDate(order.created_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p
                className="text-2xl font-bold"
                style={{ color: store?.primary_color }}
              >
                {formatCurrency(order.total)}
              </p>
              <Badge
                variant="outline"
                className={
                  order.payment_status === 'paid'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }
              >
                {order.payment_status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isCancelled ? (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <p className="text-xl font-semibold text-red-600 capitalize">
                Order {order.status}
              </p>
            </div>
          ) : (
            <div className="relative">
              {STATUS_STEPS.map((step, index) => {
                const isComplete = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const Icon = step.icon;

                return (
                  <motion.div
                    key={step.status}
                    className={`flex items-start gap-4 ${index < STATUS_STEPS.length - 1 ? 'pb-8' : ''}`}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.15 }}
                  >
                    {/* Timeline line */}
                    {index < STATUS_STEPS.length - 1 && (
                      <motion.div
                        className={`absolute left-5 w-0.5 ${isComplete ? '' : 'bg-muted'}`}
                        style={{
                          top: `${index * 80 + 40}px`,
                          backgroundColor: isComplete ? store?.primary_color : undefined,
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: 32 }}
                        transition={{ duration: 0.3, delay: index * 0.15 + 0.2 }}
                      />
                    )}

                    {/* Icon */}
                    <motion.div
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCurrent ? 'ring-4 ring-offset-2' : ''}`}
                      style={{
                        backgroundColor: isComplete ? store?.primary_color : '#e5e7eb',
                        '--tw-ring-color': isCurrent ? `${store?.primary_color}40` : undefined,
                      } as React.CSSProperties}
                      animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                      transition={isCurrent ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
                    >
                      <Icon
                        className={`w-5 h-5 ${isComplete ? 'text-white' : 'text-gray-400'}`}
                      />
                    </motion.div>

                    {/* Content */}
                    <div className="flex-1 pt-2">
                      <p
                        className={`font-medium ${isComplete ? '' : 'text-muted-foreground'}`}
                        style={{ color: isCurrent ? store?.primary_color : undefined }}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <Badge
                            className="mt-1"
                            style={{ backgroundColor: store?.primary_color }}
                          >
                            Current Status
                          </Badge>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {order.estimated_delivery_at && !isCancelled && (
            <div
              className="mt-6 p-4 rounded-lg"
              style={{ backgroundColor: `${store?.primary_color}10` }}
            >
              <p className="text-sm font-medium">Estimated Delivery</p>
              <p className="text-lg font-bold" style={{ color: store?.primary_color }}>
                {formatSmartDate(order.estimated_delivery_at)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Rating — shown when order is delivered */}
      {order.status === 'delivered' && store?.tenant_id && trackingToken && (
        <div className="mb-6">
          <DeliveryRatingForm
            tenantId={store.tenant_id}
            orderId={order.order_id}
            trackingToken={trackingToken}
            primaryColor={store.primary_color}
          />
        </div>
      )}

      {/* Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(order.items ?? []).map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span>
                  {order.delivery_fee === 0 ? 'FREE' : formatCurrency(order.delivery_fee)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span style={{ color: store?.primary_color }}>
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Delivery Address</p>
              {order.delivery_address ? (
                <p className="font-medium">
                  {order.delivery_address.street}
                  {order.delivery_address.apartment && `, ${order.delivery_address.apartment}`}
                  <br />
                  {order.delivery_address.city}, {order.delivery_address.state}{' '}
                  {order.delivery_address.zip}
                </p>
              ) : (
                <p className="text-muted-foreground">Not specified</p>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{order.customer_name || 'Guest'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="font-medium capitalize">{order.payment_method}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Continue Shopping */}
      <div className="text-center mt-8">
        <Link to={`/shop/${storeSlug}/products`}>
          <Button variant="outline">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  );
}






/**
 * Order Detail Page
 * Full order details view with timeline, items, actions (cancel, reorder, track)
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { useShopCart } from '@/hooks/useShopCart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { showCopyToast, showErrorToast } from '@/utils/toastHelpers';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  XCircle,
  RefreshCw,
  ShoppingCart,
  CreditCard,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';
import type { StorefrontOrder, StorefrontOrderItem } from '@/hooks/useStorefrontOrders';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import ProductImage from '@/components/ProductImage';

const STATUS_STEPS = [
  { status: 'pending', label: 'Order Placed', icon: Package },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'preparing', label: 'Preparing', icon: Clock },
  { status: 'ready', label: 'Ready', icon: Package },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready: 'bg-indigo-100 text-indigo-800',
  out_for_delivery: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export function OrderDetailPage() {
  const { storeSlug, orderId } = useParams<{ storeSlug: string; orderId: string }>();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const { addItem } = useShopCart({ storeId: store?.id });

  // Get customer ID from localStorage
  const customerId = store?.id
    ? (() => {
        try {
          const saved = localStorage.getItem(`${STORAGE_KEYS.SHOP_CUSTOMER_PREFIX}${store.id}`);
          return saved ? JSON.parse(saved).id : null;
        } catch {
          return null;
        }
      })()
    : null;

  // Fetch order details
  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.storefrontOrders.detail(store?.id, orderId),
    queryFn: async (): Promise<StorefrontOrder | null> => {
      if (!store?.id || !orderId || !customerId) return null;

      const { data, error: fetchError } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('id', orderId)
        .eq('store_id', store.id)
        .eq('customer_id', customerId)
        .maybeSingle();

      if (fetchError) {
        logger.error('Failed to fetch order detail', fetchError);
        throw fetchError;
      }

      return (data as unknown as StorefrontOrder) || null;
    },
    enabled: !!store?.id && !!orderId && !!customerId,
    refetchInterval: (query) => {
      const data = query.state.data as StorefrontOrder | null | undefined;
      if (!data) return false;
      const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];
      return activeStatuses.includes(data.status) ? 30000 : false;
    },
  });

  // Realtime subscription for instant order status updates
  useEffect(() => {
    if (!orderId || !store?.id) return;

    const channel = supabase
      .channel(`shop-order-detail-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          logger.debug('Shop order status update received', payload.new, 'OrderDetailPage');
          queryClient.invalidateQueries({ queryKey: queryKeys.storefrontOrders.detail(store?.id, orderId) });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Realtime subscribed for shop order detail', { orderId }, 'OrderDetailPage');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, store?.id, queryClient]);

  // Cancel order handler
  const handleCancelOrder = async () => {
    if (!order || !store?.id || !customerId) return;

    setIsCancelling(true);
    try {
      const { error: cancelError } = await supabase
        .from('marketplace_orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('store_id', store.id)
        .eq('customer_id', customerId);

      if (cancelError) throw cancelError;

      toast.success('Order cancelled', { description: `Order #${order.order_number} has been cancelled.` });
      refetch();
    } catch (err) {
      logger.error('Failed to cancel order', err);
      toast.error('Cancellation failed', { description: 'Unable to cancel order. Please try again or contact support.' });
    } finally {
      setIsCancelling(false);
      setCancellationReason('');
    }
  };

  // Reorder handler - add all items back to cart
  const handleReorder = () => {
    if (!order?.items || !store?.id) return;

    let addedCount = 0;
    order.items.forEach((item: StorefrontOrderItem) => {
      addItem({
        productId: item.product_id,
        price: item.price,
        name: item.name,
        imageUrl: item.image_url || null,
        variant: item.variant,
        quantity: item.quantity,
      });
      addedCount += item.quantity;
    });

    setCartItemCount(addedCount);
    toast.success('Items added to cart', { description: `${order.items.length} ${order.items.length === 1 ? 'item' : 'items'} from order #${order.order_number}` });
    navigate(`/shop/${storeSlug}/cart`);
  };

  // Copy tracking URL
  const handleCopyTrackingUrl = async () => {
    if (!order?.tracking_token) return;
    const trackingUrl = `${window.location.origin}/shop/${storeSlug}/track/${order.tracking_token}`;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      showCopyToast('Tracking link');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showErrorToast('Failed to copy tracking link');
    }
  };

  if (!store) return null;

  // Not logged in
  if (!customerId) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Sign in required</h1>
        <p className="text-muted-foreground mb-6">Please sign in to view order details.</p>
        <Link to={`/shop/${storeSlug}/account`}>
          <Button style={{ backgroundColor: store.primary_color }}>Sign In</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <XCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
        <p className="text-muted-foreground mb-6">
          We couldn't find this order. It may have been removed or you may not have access.
        </p>
        <Link to={`/shop/${storeSlug}/account`}>
          <Button variant="outline">Back to Account</Button>
        </Link>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const orderTotal = order.total || order.total_amount || 0;
  const deliveryAddress = order.delivery_address;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to={`/shop/${storeSlug}/account`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Orders
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-xl font-bold">Order #{order.order_number}</h1>
          <Badge variant="outline" className={STATUS_COLORS[order.status] ?? ''}>
            {order.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex gap-2">
          {order.tracking_token && (
            <Button variant="outline" size="sm" onClick={handleCopyTrackingUrl}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Share'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReorder}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reorder
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Order Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isCancelled ? (
                <div className="text-center py-6">
                  <XCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
                  <p className="text-lg font-semibold text-red-600 capitalize">
                    Order {order.status}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatSmartDate(order.updated_at || order.created_at)}
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
                        className={`flex items-start gap-4 ${index < STATUS_STEPS.length - 1 ? 'pb-6' : ''}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        {/* Timeline connector */}
                        {index < STATUS_STEPS.length - 1 && (
                          <div
                            className="absolute left-[19px] w-0.5 h-6"
                            style={{
                              top: `${index * 56 + 36}px`,
                              backgroundColor: isComplete ? store.primary_color : '#e5e7eb',
                            }}
                          />
                        )}

                        {/* Icon */}
                        <div
                          className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCurrent ? 'ring-2 ring-offset-2' : ''}`}
                          style={{
                            backgroundColor: isComplete ? store.primary_color : '#e5e7eb',
                            '--tw-ring-color': isCurrent ? `${store.primary_color}40` : undefined,
                          } as React.CSSProperties}
                        >
                          <Icon className={`w-4 h-4 ${isComplete ? 'text-white' : 'text-gray-400'}`} />
                        </div>

                        {/* Label */}
                        <div className="flex-1 pt-2">
                          <p
                            className={`text-sm font-medium ${isComplete ? '' : 'text-muted-foreground'}`}
                            style={{ color: isCurrent ? store.primary_color : undefined }}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <p className="text-xs text-muted-foreground mt-0.5">Current status</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Items ({order.items?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(order.items ?? []).map((item: StorefrontOrderItem, index: number) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <div className="w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <ProductImage
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.variant && (
                        <p className="text-xs text-muted-foreground">{item.variant}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Qty: {item.quantity} x {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs mt-1"
                        onClick={() => {
                          addItem({
                            productId: item.product_id,
                            price: item.price,
                            name: item.name,
                            imageUrl: item.image_url || null,
                            variant: item.variant,
                          });
                          toast.success(`${item.name} added to cart`);
                        }}
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Buy Again
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Totals */}
              <div className="mt-6 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal ?? 0)}</span>
                </div>
                {(order.delivery_fee ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{formatCurrency(order.delivery_fee ?? 0)}</span>
                  </div>
                )}
                {(order.tax_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(order.tax_amount ?? 0)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span style={{ color: store.primary_color }}>{formatCurrency(orderTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cancel Order Section */}
          {canCancel && (
            <Card className="border-yellow-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="font-medium text-sm">Need to cancel this order?</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      You can cancel this order while it's still {order.status}. Once it moves to the next stage, cancellation won't be possible.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="mt-3 text-red-600 border-red-200 hover:bg-red-50">
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancel Order
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Order #{order.order_number}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. The order will be cancelled and you may need to place a new order.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-2">
                          <Textarea
                            placeholder="Reason for cancellation (optional)"
                            value={cancellationReason}
                            onChange={(e) => setCancellationReason(e.target.value)}
                            rows={3}
                            aria-label="Cancellation reason"
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Order</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleCancelOrder}
                            disabled={isCancelling}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {isCancelling ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Cancelling...
                              </>
                            ) : (
                              'Cancel Order'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Order Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Order Number</p>
                <p className="font-semibold">{order.order_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Date Placed</p>
                <p className="text-sm">{formatSmartDate(order.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Payment</p>
                <div className="flex items-center gap-2 mt-1">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <Badge
                    variant="outline"
                    className={order.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}
                  >
                    {order.payment_status || 'pending'}
                  </Badge>
                </div>
              </div>
              {order.tracking_token && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Tracking</p>
                  <Link
                    to={`/shop/${storeSlug}/track/${order.tracking_token}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: store.primary_color }}
                  >
                    View Live Tracking
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Address */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.customer_name && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Recipient</p>
                  <p className="text-sm font-medium">{order.customer_name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Address</p>
                {deliveryAddress ? (
                  <p className="text-sm">
                    {typeof deliveryAddress === 'string'
                      ? deliveryAddress
                      : `${(deliveryAddress as Record<string, string>).street ?? ''}${(deliveryAddress as Record<string, string>).apartment ? `, ${(deliveryAddress as Record<string, string>).apartment}` : ''}, ${(deliveryAddress as Record<string, string>).city ?? ''}, ${(deliveryAddress as Record<string, string>).state ?? ''} ${(deliveryAddress as Record<string, string>).zip ?? ''}`
                    }
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not specified</p>
                )}
              </div>
              {order.delivery_notes && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Notes</p>
                  <p className="text-sm">{order.delivery_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              {order.tracking_token && (
                <Link to={`/shop/${storeSlug}/track/${order.tracking_token}`} className="block">
                  <Button className="w-full" style={{ backgroundColor: store.primary_color }}>
                    <Truck className="w-4 h-4 mr-2" />
                    Track Order
                  </Button>
                </Link>
              )}
              <Button variant="outline" className="w-full" onClick={handleReorder}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reorder All Items
              </Button>
              <Link to={`/shop/${storeSlug}/products`} className="block">
                <Button variant="ghost" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

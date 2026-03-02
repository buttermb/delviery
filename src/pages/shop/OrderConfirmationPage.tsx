/**
 * Order Confirmation Page
 * Success page after placing an order with real-time status tracking timeline
 */

import { useEffect, useState } from 'react';
import { Link, useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import {
  CheckCircle, Package, Clock, Copy, Check, Loader2, ShoppingBag,
  Truck, MessageCircle, XCircle, MapPin, Mail, ExternalLink,
  CreditCard, Store, Banknote, Wallet,
} from 'lucide-react';

import { useShop } from './ShopLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useShopCart } from '@/hooks/useShopCart';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

const STATUS_STEPS = [
  { status: 'pending', label: 'Order Placed', description: 'Your order has been received', icon: Package },
  { status: 'confirmed', label: 'Confirmed', description: 'Store confirmed your order', icon: CheckCircle },
  { status: 'preparing', label: 'Preparing', description: 'Your order is being prepared', icon: Clock },
  { status: 'ready', label: 'Ready', description: 'Ready for pickup or delivery', icon: Package },
  { status: 'out_for_delivery', label: 'Out for Delivery', description: 'On the way to you', icon: Truck },
  { status: 'delivered', label: 'Delivered', description: 'Order has been delivered', icon: CheckCircle },
];

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: typeof CreditCard }> = {
  cash: { label: 'Cash on Delivery', icon: Banknote },
  card: { label: 'Credit/Debit Card', icon: CreditCard },
  venmo: { label: 'Venmo', icon: Wallet },
  zelle: { label: 'Zelle', icon: Wallet },
};

export function OrderConfirmationPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store } = useShop();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [cartCleared, setCartCleared] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { clearCart } = useShopCart({ storeId: store?.id ?? '' });

  const stateData = (location.state || {}) as {
    orderNumber?: string;
    orderId?: string;
    trackingToken?: string;
    total?: number;
    telegramLink?: string;
    telegramButtonLabel?: string;
  };

  const orderNumber = stateData.orderNumber || stateData.orderId || searchParams.get('order') || null;
  const trackingToken = stateData.trackingToken || searchParams.get('token') || null;
  const totalParam = searchParams.get('total');
  const total = stateData.total || (totalParam ? parseFloat(totalParam) : undefined);
  const sessionId = searchParams.get('session_id');

  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(null);
  const effectiveOrderId = orderNumber || resolvedOrderId;

  // Fetch order details
  const { data: orderDetails, isLoading: orderLoading } = useQuery({
    queryKey: queryKeys.shopPages.orderConfirmation(trackingToken || effectiveOrderId || sessionId),
    queryFn: async () => {
      if (!trackingToken && !effectiveOrderId && !sessionId) return null;

      let query = supabase
        .from('storefront_orders')
        .select('order_number, items, subtotal, delivery_fee, total, status, created_at, delivery_address, customer_name, payment_method, fulfillment_method, payment_status, stripe_session_id');

      if (trackingToken) {
        query = query.eq('tracking_token', trackingToken);
      } else if (effectiveOrderId) {
        query = query.or(`id.eq.${effectiveOrderId},order_number.eq.${effectiveOrderId}`);
      } else if (sessionId) {
        query = query.eq('stripe_session_id', sessionId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        logger.warn('Failed to fetch order details', error, { component: 'OrderConfirmationPage' });
        return null;
      }

      return data;
    },
    enabled: !!(trackingToken || effectiveOrderId || sessionId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.status) return false;
      const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];
      return activeStatuses.includes(data.status) ? 30000 : false;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Verify Stripe payment session
  useEffect(() => {
    if (!sessionId) {
      setPaymentVerified(true);
      return;
    }
    if (paymentVerified) return;

    setVerifying(true);
    const verifyPayment = async () => {
      try {
        let lookupId = orderNumber;

        if (!lookupId) {
          const { data: sessionOrder } = await supabase
            .from('storefront_orders')
            .select('id, order_number, tracking_token')
            .eq('stripe_session_id', sessionId)
            .maybeSingle();

          if (sessionOrder) {
            lookupId = sessionOrder.id;
            setResolvedOrderId(sessionOrder.id);
          }
        }

        if (!lookupId) {
          setPaymentVerified(true);
          return;
        }

        const { data: order, error } = await supabase
          .from('storefront_orders')
          .select('payment_status, stripe_session_id')
          .eq('id', lookupId)
          .maybeSingle();

        if (error) {
          logger.warn('Failed to verify payment status', error, { component: 'OrderConfirmationPage' });
        }

        if (order?.payment_status === 'paid' || order?.stripe_session_id === sessionId) {
          setPaymentVerified(true);
        } else {
          setPaymentVerified(true);
          logger.info('Payment pending webhook confirmation', { orderId: lookupId, sessionId }, { component: 'OrderConfirmationPage' });
        }
      } catch (err) {
        logger.warn('Payment verification error', err, { component: 'OrderConfirmationPage' });
        setPaymentVerified(true);
      } finally {
        setVerifying(false);
      }
    };
    verifyPayment();
  }, [sessionId, orderNumber, paymentVerified]);

  // Redirect if no order data
  useEffect(() => {
    if (!effectiveOrderId && !sessionId) {
      navigate(`/shop/${storeSlug}`);
    }
  }, [effectiveOrderId, sessionId, navigate, storeSlug]);

  // Clear cart and confetti
  useEffect(() => {
    if ((effectiveOrderId || sessionId) && !cartCleared) {
      clearCart();
      setCartCleared(true);

      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }
  }, [orderNumber, cartCleared, clearCart]);

  if (!store || !effectiveOrderId) return null;

  if (verifying) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-12 sm:py-16 max-w-2xl text-center">
        <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 animate-spin" style={{ color: store.primary_color }} />
        <h1 className="text-lg sm:text-xl font-semibold mb-2">Verifying Payment...</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Please wait while we confirm your payment.</p>
      </div>
    );
  }

  const displayOrderNumber = orderDetails?.order_number || effectiveOrderId;
  const displayTotal = orderDetails?.total ?? total;
  const items = (orderDetails?.items ?? []) as unknown as OrderItem[];
  const trackingUrl = trackingToken
    ? `${window.location.origin}/shop/${storeSlug}/track/${trackingToken}`
    : null;
  const telegramLink = stateData.telegramLink || null;
  const telegramButtonLabel = stateData.telegramButtonLabel || 'Chat with us on Telegram';
  const isCancelled = orderDetails?.status === 'cancelled';
  const currentStatus = orderDetails?.status ?? 'pending';
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === currentStatus);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 md:py-16 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        {isCancelled ? (
          <>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center bg-destructive/10">
              <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-destructive" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 text-destructive">Order Cancelled</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              This order has been cancelled. Please contact us if you have any questions.
            </p>
          </>
        ) : (
          <>
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${store.primary_color}20` }}
            >
              <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" style={{ color: store.primary_color }} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Thank You!</h1>
            <p className="text-lg sm:text-xl font-semibold mb-1" style={{ color: store.primary_color }}>
              Order #{displayOrderNumber} Confirmed
            </p>
            <p className="text-sm sm:text-base text-muted-foreground">
              We&apos;ll send you updates on your delivery.
            </p>
          </>
        )}
      </div>

      {/* Order Summary Card */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm mb-4 sm:mb-6">
            {displayTotal != null && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold" style={{ color: store.primary_color }}>
                  {formatCurrency(displayTotal)}
                </p>
              </div>
            )}
            {orderDetails?.payment_method && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Payment</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {(() => {
                    const pm = PAYMENT_METHOD_LABELS[orderDetails.payment_method];
                    const Icon = pm?.icon ?? CreditCard;
                    return <Icon className="w-4 h-4 text-muted-foreground" />;
                  })()}
                  <p className="font-medium">
                    {PAYMENT_METHOD_LABELS[orderDetails.payment_method]?.label ?? orderDetails.payment_method}
                  </p>
                </div>
              </div>
            )}
            {orderDetails?.fulfillment_method && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Fulfillment</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {orderDetails.fulfillment_method === 'pickup' ? (
                    <Store className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Truck className="w-4 h-4 text-muted-foreground" />
                  )}
                  <p className="font-medium capitalize">{orderDetails.fulfillment_method}</p>
                </div>
              </div>
            )}
          </div>

          {/* Status Timeline */}
          {!isCancelled && (
            <div className="py-4 sm:py-6 border-t border-b">
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Order Status
              </p>
              <div className="relative pl-10 sm:pl-12 space-y-1">
                {STATUS_STEPS.map((step, index) => {
                  const isComplete = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const Icon = step.icon;
                  const isLast = index === STATUS_STEPS.length - 1;

                  return (
                    <div key={step.status} className="relative pb-5 last:pb-0">
                      {!isLast && (
                        <div
                          className="absolute -left-10 sm:-left-12 top-8 w-0.5 h-[calc(100%-8px)]"
                          style={{
                            backgroundColor: isComplete && index < currentStepIndex
                              ? store.primary_color
                              : 'hsl(var(--border))',
                          }}
                        />
                      )}
                      <div
                        className={`absolute -left-10 sm:-left-12 top-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-500 ${isCurrent ? 'ring-4 ring-offset-2' : ''}`}
                        style={{
                          backgroundColor: isComplete ? store.primary_color : 'hsl(var(--border))',
                          '--tw-ring-color': isCurrent ? `${store.primary_color}30` : 'transparent',
                        } as React.CSSProperties}
                      >
                        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isComplete ? 'text-white' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-h-[28px] flex items-start justify-between gap-2">
                        <div>
                          <p
                            className={`text-sm font-medium leading-7 sm:leading-8 ${isComplete ? '' : 'text-muted-foreground'}`}
                            style={{ color: isCurrent ? store.primary_color : undefined }}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                          )}
                        </div>
                        {isCurrent && (
                          <Badge className="shrink-0 mt-1 text-white text-[10px]" style={{ backgroundColor: store.primary_color }}>
                            Current
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tracking URL */}
          {trackingUrl && (
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-muted rounded-lg">
              <p className="text-xs sm:text-sm font-medium mb-2">Track Your Order</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={trackingUrl}
                  className="flex-1 text-xs sm:text-sm bg-background px-2 sm:px-3 py-2 rounded border min-w-0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(trackingUrl);
                      setCopied(true);
                      toast.success('Tracking link copied!');
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      const textarea = document.createElement('textarea');
                      textarea.value = trackingUrl;
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                      setCopied(true);
                      toast.success('Tracking link copied!');
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                >
                  {copied ? (
                    <><Check className="w-4 h-4 mr-1" /><span className="hidden sm:inline">Copied!</span></>
                  ) : (
                    <><Copy className="w-4 h-4 mr-1" /><span className="hidden sm:inline">Copy</span></>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram Contact */}
      {telegramLink && !isCancelled && (
        <Card className="mb-4 sm:mb-6 overflow-hidden border-2" style={{ borderColor: `${store.primary_color}40` }}>
          <CardContent className="p-0">
            <div className="px-5 py-5 sm:px-6 sm:py-6 text-center" style={{ backgroundColor: `${store.primary_color}08` }}>
              <div className="flex items-center justify-center gap-3 mb-3">
                {store.logo_url ? (
                  <img src={store.logo_url} alt={store.store_name} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover" />
                ) : (
                  <div
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: store.primary_color }}
                  >
                    {store.store_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-base sm:text-lg font-semibold">{store.store_name}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Have questions about your order? Reach out to us directly.
              </p>
              <a href={telegramLink} target="_blank" rel="noopener noreferrer" className="block">
                <Button
                  className="w-full h-14 sm:h-12 text-base font-semibold gap-2.5 text-white shadow-md hover:shadow-lg transition-shadow"
                  style={{ backgroundColor: store.primary_color }}
                  size="lg"
                >
                  <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                  {telegramButtonLabel}
                  <ExternalLink className="w-4 h-4 opacity-70" />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery/Pickup Details */}
      {orderDetails && !isCancelled && (
        <Card className="mb-4 sm:mb-6">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              {orderDetails.fulfillment_method === 'pickup' ? (
                <Store className="w-5 h-5" style={{ color: store.primary_color }} />
              ) : (
                <Truck className="w-5 h-5" style={{ color: store.primary_color }} />
              )}
              <h3 className="font-semibold text-base sm:text-lg">
                {orderDetails.fulfillment_method === 'pickup' ? 'Pickup Details' : 'Delivery Details'}
              </h3>
            </div>
            <div className="space-y-3">
              {orderDetails.customer_name && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <p className="text-sm font-medium">{orderDetails.customer_name}</p>
                </div>
              )}
              {orderDetails.delivery_address && orderDetails.fulfillment_method !== 'pickup' && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <p className="text-sm">{String(orderDetails.delivery_address)}</p>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {orderDetails.fulfillment_method === 'pickup' ? 'Pickup Estimate' : 'Estimated Delivery'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {orderDetails.status === 'delivered'
                      ? 'Delivered'
                      : orderDetails.status === 'out_for_delivery'
                        ? 'Out for delivery — arriving soon'
                        : orderDetails.fulfillment_method === 'pickup'
                          ? 'Ready for pickup in 15–30 minutes'
                          : 'Within 30–60 minutes'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items Ordered */}
      {orderLoading ? (
        <Card className="mb-4 sm:mb-6">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : items.length > 0 ? (
        <Card className="mb-4 sm:mb-6">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <ShoppingBag className="w-5 h-5" style={{ color: store.primary_color }} />
              <h2 className="font-semibold text-base sm:text-lg">Items Ordered</h2>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              ))}
              <Separator />
              {orderDetails?.subtotal != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(orderDetails.subtotal)}</span>
                </div>
              )}
              {orderDetails?.delivery_fee != null && orderDetails.delivery_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>{formatCurrency(orderDetails.delivery_fee)}</span>
                </div>
              )}
              {orderDetails?.delivery_fee === 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="text-success">FREE</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span style={{ color: store.primary_color }}>{formatCurrency(displayTotal ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
        {trackingToken && (
          <Link to={`/shop/${storeSlug}/track/${trackingToken}`} className="w-full sm:w-auto">
            <Button style={{ backgroundColor: store.primary_color }} className="w-full sm:w-auto h-11 sm:h-10 text-sm">
              <Package className="w-4 h-4 mr-2" />
              Track Order
            </Button>
          </Link>
        )}
        <Link to={`/shop/${storeSlug}/products`} className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto h-11 sm:h-10 text-sm">
            Continue Shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default OrderConfirmationPage;

/**
 * Public Delivery Tracking Page
 * Customer-facing page to track delivery status
 * Accessible via SMS link or order confirmation page
 *
 * Features:
 * - Order number + phone lookup (no auth required)
 * - Delivery status timeline
 * - Runner info and live location (if enabled)
 * - Supabase realtime for auto-refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  Navigation,
  RefreshCw,
  Search,
  AlertCircle,
  Loader2,
  Home,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DeliveryInfo {
  id: string;
  order_id: string;
  tracking_code: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  estimated_delivery_at: string | null;
  delivery_scheduled_at: string | null;
  delivery_completed_at: string | null;
  courier_id: string | null;
  courier_name: string | null;
  courier_phone: string | null;
  courier_vehicle: string | null;
  courier_lat: number | null;
  courier_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  store_name: string | null;
  tenant_id: string;
}

type DeliveryStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'nearby'
  | 'delivered'
  | 'cancelled';

// ============================================================================
// Constants
// ============================================================================

const DELIVERY_STEPS: Array<{
  status: DeliveryStatus;
  label: string;
  description: string;
  icon: typeof Package;
}> = [
  {
    status: 'confirmed',
    label: 'Order Confirmed',
    description: 'Your order has been received',
    icon: CheckCircle2
  },
  {
    status: 'picked_up',
    label: 'Picked Up',
    description: 'Runner has picked up your order',
    icon: Package
  },
  {
    status: 'in_transit',
    label: 'In Transit',
    description: 'Your order is on the way',
    icon: Truck
  },
  {
    status: 'nearby',
    label: 'Nearby',
    description: 'Your delivery is almost there',
    icon: Navigation
  },
  {
    status: 'delivered',
    label: 'Delivered',
    description: 'Order has been delivered',
    icon: CheckCircle2
  },
];

// Form validation schema
const lookupSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
});

type LookupFormData = z.infer<typeof lookupSchema>;

// ============================================================================
// Component
// ============================================================================

export default function DeliveryTrackingPage() {
  const { trackingCode } = useParams<{ trackingCode?: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // State for lookup mode
  const [lookupOrderNumber, setLookupOrderNumber] = useState<string | null>(null);
  const [lookupPhone, setLookupPhone] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Form for lookup
  const form = useForm<LookupFormData>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      orderNumber: searchParams.get('order') || '',
      phone: searchParams.get('phone') || '',
    },
  });

  // Determine if we're in direct tracking mode (via tracking code URL)
  const isDirectMode = Boolean(trackingCode);
  const shouldFetch = isDirectMode || Boolean(lookupOrderNumber && lookupPhone);

  // ============================================================================
  // Query: Fetch delivery info
  // ============================================================================

  const {
    data: delivery,
    isLoading,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['public-delivery-tracking', trackingCode, lookupOrderNumber, lookupPhone],
    queryFn: async (): Promise<DeliveryInfo | null> => {
      try {
        let query = (supabase as any)
          .from('orders')
          .select(`
            id,
            tracking_code,
            status,
            customer_name,
            customer_phone,
            delivery_address,
            total_amount,
            created_at,
            delivery_scheduled_at,
            delivery_completed_at,
            courier_id,
            delivery_lat,
            delivery_lng,
            tenant_id,
            couriers:courier_id (
              full_name,
              phone,
              vehicle_type,
              current_lat,
              current_lng
            ),
            tenants:tenant_id (
              business_name
            )
          `);

        if (isDirectMode && trackingCode) {
          // Direct mode: lookup by tracking code
          query = query.eq('tracking_code', trackingCode);
        } else if (lookupOrderNumber && lookupPhone) {
          // Lookup mode: order number + phone (last 4 digits)
          const phoneDigits = lookupPhone.replace(/\D/g, '').slice(-4);
          query = query
            .ilike('tracking_code', `%${lookupOrderNumber}%`)
            .ilike('customer_phone', `%${phoneDigits}`);
        } else {
          return null;
        }

        const { data, error: queryError } = await query.maybeSingle();

        if (queryError) {
          logger.error('Delivery tracking query failed', queryError, {
            component: 'DeliveryTrackingPage',
            trackingCode,
            lookupOrderNumber
          });
          throw queryError;
        }

        if (!data) {
          return null;
        }

        // Transform the data
        const courier = data.couriers as Record<string, unknown> | null;
        const tenant = data.tenants as Record<string, unknown> | null;

        return {
          id: data.id,
          order_id: data.id,
          tracking_code: data.tracking_code || '',
          status: data.status || 'pending',
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          delivery_address: data.delivery_address,
          total_amount: data.total_amount || 0,
          created_at: data.created_at,
          updated_at: data.created_at,
          estimated_delivery_at: null,
          delivery_scheduled_at: data.delivery_scheduled_at,
          delivery_completed_at: data.delivery_completed_at,
          courier_id: data.courier_id,
          courier_name: courier?.full_name as string | null,
          courier_phone: courier?.phone as string | null,
          courier_vehicle: courier?.vehicle_type as string | null,
          courier_lat: courier?.current_lat as number | null,
          courier_lng: courier?.current_lng as number | null,
          delivery_lat: data.delivery_lat,
          delivery_lng: data.delivery_lng,
          store_name: tenant?.business_name as string | null,
          tenant_id: data.tenant_id,
        };
      } catch (err) {
        logger.error('Delivery tracking fetch error', err, {
          component: 'DeliveryTrackingPage'
        });
        throw err;
      }
    },
    enabled: shouldFetch,
    refetchInterval: (query) => {
      // Auto-refresh every 15 seconds for active deliveries
      const data = query.state.data as DeliveryInfo | null | undefined;
      if (!data) return false;
      const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'nearby'];
      return activeStatuses.includes(data.status) ? 15000 : false;
    },
    retry: 2,
  });

  // ============================================================================
  // Realtime Subscription
  // ============================================================================

  useEffect(() => {
    if (!delivery?.id || !delivery?.tenant_id) return;

    const channel = supabase
      .channel(`delivery-tracking-${delivery.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${delivery.id}`,
        },
        (payload) => {
          logger.debug('Delivery tracking realtime update', {
            orderId: delivery.id,
            newStatus: payload.new?.status
          });
          // Invalidate query to refetch
          queryClient.invalidateQueries({
            queryKey: ['public-delivery-tracking']
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [delivery?.id, delivery?.tenant_id, queryClient]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const onSubmit = useCallback((data: LookupFormData) => {
    setLookupError(null);
    setLookupOrderNumber(data.orderNumber);
    setLookupPhone(data.phone);
  }, []);

  const handleReset = useCallback(() => {
    setLookupOrderNumber(null);
    setLookupPhone(null);
    setLookupError(null);
    form.reset();
  }, [form]);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getStatusIndex = (status: string): number => {
    const statusMap: Record<string, number> = {
      pending: -1,
      confirmed: 0,
      preparing: 0,
      ready_for_pickup: 1,
      picked_up: 1,
      in_transit: 2,
      nearby: 3,
      delivered: 4,
      cancelled: -1,
    };
    return statusMap[status] ?? -1;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_transit':
      case 'nearby':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const formatPhoneDisplay = (phone: string | null): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  // ============================================================================
  // Render: Lookup Form
  // ============================================================================

  if (!isDirectMode && !lookupOrderNumber) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Truck className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Track Your Delivery</h1>
            <p className="text-slate-500 mt-2">
              Enter your order details to see delivery status
            </p>
          </div>

          {/* Lookup Form */}
          <Card className="shadow-xl border-0">
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Order Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="e.g., ORD-ABC123"
                              className="pl-10"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>Phone Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="(555) 123-4567"
                              type="tel"
                              className="pl-10"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {lookupError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {lookupError}
                    </div>
                  )}

                  <Button type="submit" className="w-full" size="lg">
                    <Search className="h-4 w-4 mr-2" />
                    Track Order
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-sm text-slate-400 mt-6">
            Can&apos;t find your order?{' '}
            <Link to="/support" className="text-primary hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Not Found
  // ============================================================================

  if (error || !delivery) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center py-8 px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Order Not Found</h1>
          <p className="text-slate-500 mb-6">
            We couldn&apos;t find an order with those details. Please check your information and try again.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleReset}>
              Try Again
            </Button>
            <Link to="/">
              <Button>
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Delivery Details
  // ============================================================================

  const currentStepIndex = getStatusIndex(delivery.status);
  const isCancelled = delivery.status === 'cancelled';
  const isDelivered = delivery.status === 'delivered';

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isDirectMode && (
              <Button variant="ghost" size="icon" onClick={handleReset}>
                <ChevronRight className="h-5 w-5 rotate-180" />
              </Button>
            )}
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Order #{delivery.tracking_code}
              </h1>
              <p className="text-sm text-slate-500">
                {delivery.store_name && `From ${delivery.store_name} • `}
                {format(new Date(delivery.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Status Banner */}
        {isDelivered && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-700">Delivered Successfully!</p>
              <p className="text-sm text-green-600">
                {delivery.delivery_completed_at &&
                  `Delivered on ${format(new Date(delivery.delivery_completed_at), 'MMM d, yyyy \'at\' h:mm a')}`
                }
              </p>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-700">Order Cancelled</p>
              <p className="text-sm text-red-600">
                This order has been cancelled.
              </p>
            </div>
          </div>
        )}

        {/* Status Timeline Card */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Delivery Status
              </CardTitle>
              <Badge className={getStatusColor(delivery.status)}>
                {delivery.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            {delivery.delivery_scheduled_at && !isDelivered && !isCancelled && (
              <CardDescription>
                Estimated delivery: {format(new Date(delivery.delivery_scheduled_at), 'h:mm a')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!isCancelled && (
              <div className="relative">
                {DELIVERY_STEPS.map((step, index) => {
                  const isComplete = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.status}
                      className={cn(
                        'flex items-start gap-4 pb-8 last:pb-0',
                        index < DELIVERY_STEPS.length - 1 && 'relative'
                      )}
                    >
                      {/* Connector line */}
                      {index < DELIVERY_STEPS.length - 1 && (
                        <div
                          className={cn(
                            'absolute left-5 top-10 w-0.5 h-8',
                            isComplete ? 'bg-primary' : 'bg-slate-200'
                          )}
                        />
                      )}

                      {/* Icon */}
                      <div
                        className={cn(
                          'relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                          isComplete
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-400',
                          isCurrent && 'ring-4 ring-primary/20'
                        )}
                      >
                        {isCurrent && !isDelivered ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-2">
                        <p className={cn(
                          'font-medium',
                          isComplete ? 'text-slate-900' : 'text-slate-400'
                        )}>
                          {step.label}
                        </p>
                        <p className="text-sm text-slate-500">
                          {step.description}
                        </p>
                        {isCurrent && (
                          <Badge variant="secondary" className="mt-2">
                            Current Status
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Runner Info Card */}
        {delivery.courier_id && delivery.courier_name && !isDelivered && !isCancelled && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Delivery Runner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{delivery.courier_name}</p>
                  <p className="text-sm text-slate-500">
                    {delivery.courier_vehicle || 'Delivery Partner'}
                  </p>
                </div>
                {delivery.courier_phone && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={`tel:${delivery.courier_phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>

              {/* Live location indicator */}
              {delivery.courier_lat && delivery.courier_lng && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-blue-600 animate-pulse" />
                  <span className="text-sm text-blue-700">
                    Live location tracking enabled
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delivery Details Card */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Delivery Address</p>
              <p className="font-medium text-slate-900">
                {delivery.delivery_address || 'Not specified'}
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <p className="font-medium text-slate-900">
                  {delivery.customer_name || 'Guest'}
                </p>
              </div>
              {delivery.customer_phone && (
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-medium text-slate-900">
                    {formatPhoneDisplay(delivery.customer_phone)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Order Total</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(delivery.total_amount)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-slate-400">
          <p>
            Questions about your delivery?{' '}
            <Link to="/support" className="text-primary hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * OrderDeliveryStatusSync Component
 *
 * Displays real-time delivery status for an order with:
 * - Delivery status from deliveries table
 * - Runner name, current status, estimated time
 * - Real-time location if available
 * - Real-time updates via Supabase subscription
 * - Auto-update order status when delivery is completed
 */

import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealTimeSubscription } from '@/hooks/useRealtimeSubscription';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import Truck from 'lucide-react/dist/esm/icons/truck';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import User from 'lucide-react/dist/esm/icons/user';
import Phone from 'lucide-react/dist/esm/icons/phone';
import Navigation from 'lucide-react/dist/esm/icons/navigation';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';

/** Delivery record type */
interface DeliveryRecord {
  id: string;
  order_id: string;
  tenant_id: string;
  courier_id: string | null;
  status: string;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  created_at: string;
  updated_at: string | null;
  courier?: {
    id: string;
    full_name: string;
    phone: string | null;
  } | null;
}

/** Props for OrderDeliveryStatusSync */
interface OrderDeliveryStatusSyncProps {
  /** The order ID to track delivery for */
  orderId: string;
  /** Whether to auto-update order status on delivery completion */
  autoUpdateOrderStatus?: boolean;
  /** Callback when delivery status changes */
  onDeliveryStatusChange?: (newStatus: string) => void;
}

/** Delivery status configuration for visual display */
function getDeliveryStatusConfig(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'delivered':
    case 'completed':
      return {
        icon: CheckCircle,
        label: 'Delivered',
        variant: 'default' as const,
        className: 'bg-success/10 text-success border-success/20',
      };
    case 'in_transit':
    case 'out_for_delivery':
      return {
        icon: Truck,
        label: 'In Transit',
        variant: 'secondary' as const,
        className: 'bg-info/10 text-info border-info/20',
      };
    case 'picked_up':
      return {
        icon: Navigation,
        label: 'Picked Up',
        variant: 'secondary' as const,
        className: 'bg-info/10 text-info border-info/20',
      };
    case 'assigned':
      return {
        icon: User,
        label: 'Assigned',
        variant: 'secondary' as const,
        className: 'bg-warning/10 text-warning border-warning/20',
      };
    case 'pending':
      return {
        icon: Clock,
        label: 'Pending',
        variant: 'outline' as const,
        className: 'bg-muted text-muted-foreground',
      };
    case 'failed':
    case 'cancelled':
      return {
        icon: AlertCircle,
        label: status.charAt(0).toUpperCase() + status.slice(1),
        variant: 'destructive' as const,
        className: 'bg-destructive/10 text-destructive border-destructive/20',
      };
    default:
      return {
        icon: Clock,
        label: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
        variant: 'outline' as const,
        className: '',
      };
  }
}

export function OrderDeliveryStatusSync({
  orderId,
  autoUpdateOrderStatus = true,
  onDeliveryStatusChange,
}: OrderDeliveryStatusSyncProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Query key for delivery data
  const deliveryQueryKey = tenant?.id
    ? queryKeys.deliveries.byOrder(tenant.id, orderId)
    : ['deliveries', 'order', orderId];

  // Fetch delivery record for this order
  const {
    data: delivery,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: deliveryQueryKey,
    queryFn: async (): Promise<DeliveryRecord | null> => {
      if (!tenant?.id || !orderId) return null;

      const { data, error: fetchError } = await supabase
        .from('deliveries')
        .select(`
          id,
          order_id,
          tenant_id,
          courier_id,
          status,
          estimated_delivery_time,
          actual_delivery_time,
          current_lat,
          current_lng,
          last_location_update,
          created_at,
          updated_at,
          courier:couriers(id, full_name, phone)
        `)
        .eq('order_id', orderId)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (fetchError) {
        // Handle case where deliveries table doesn't exist
        if (fetchError.code === '42P01') {
          logger.debug('Deliveries table does not exist', {
            component: 'OrderDeliveryStatusSync',
            orderId,
          });
          return null;
        }
        logger.error('Failed to fetch delivery record', fetchError, {
          component: 'OrderDeliveryStatusSync',
          orderId,
          tenantId: tenant.id,
        });
        throw fetchError;
      }

      return data as unknown as DeliveryRecord | null;
    },
    enabled: !!tenant?.id && !!orderId,
    staleTime: 30_000,
  });

  // Real-time subscription for delivery changes
  const { status: subscriptionStatus } = useRealTimeSubscription({
    table: 'deliveries',
    tenantId: tenant?.id ?? null,
    event: '*',
    enabled: !!tenant?.id && !!orderId,
    callback: useCallback(
      (payload) => {
        const newRecord = payload.new as unknown as DeliveryRecord | null;
        const oldRecord = payload.old as unknown as DeliveryRecord | null;

        // Only process if related to this order
        if (
          (newRecord?.order_id === orderId) ||
          (oldRecord?.order_id === orderId)
        ) {
          logger.debug('Delivery update received', {
            component: 'OrderDeliveryStatusSync',
            eventType: payload.eventType,
            orderId,
            deliveryId: newRecord?.id || oldRecord?.id,
            newStatus: newRecord?.status,
          });

          // Invalidate queries to refetch
          queryClient.invalidateQueries({ queryKey: deliveryQueryKey });
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });

          // Notify parent of status change
          if (newRecord?.status && onDeliveryStatusChange) {
            onDeliveryStatusChange(newRecord.status);
          }

          // Auto-update order status if delivery is completed
          if (
            autoUpdateOrderStatus &&
            payload.eventType === 'UPDATE' &&
            (newRecord?.status === 'delivered' || newRecord?.status === 'completed')
          ) {
            updateOrderDeliveryStatus('delivered');
          }
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- updateOrderDeliveryStatus is a stable helper wrapping a mutation; tenant?.id is accessed from closure
      [orderId, queryClient, deliveryQueryKey, onDeliveryStatusChange, autoUpdateOrderStatus]
    ),
  });

  // Mutation to update order status when delivery is completed
  const updateOrderStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!tenant?.id || !orderId) throw new Error('Missing required data');

      const updateData = {
        status: newStatus,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Try unified_orders first
      const { error: unifiedError } = await supabase
        .from('unified_orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (!unifiedError) {
        logger.debug('Updated order status in unified_orders', {
          component: 'OrderDeliveryStatusSync',
          orderId,
          newStatus,
        });
        return;
      }

      logger.warn('unified_orders update failed, falling back to orders table', {
        component: 'OrderDeliveryStatusSync',
        orderId,
        error: unifiedError,
      });

      // Fallback to orders table
      const { error: ordersError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (ordersError) {
        throw ordersError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
      toast.success('Order marked as delivered');
    },
    onError: (err) => {
      logger.error('Failed to update order status', err, {
        component: 'OrderDeliveryStatusSync',
        orderId,
      });
      toast.error('Failed to update order status', { description: humanizeError(err) });
    },
  });

  // Helper to update order status
  const updateOrderDeliveryStatus = async (newStatus: string) => {
    if (!tenant?.id || !orderId) return;

    try {
      await updateOrderStatusMutation.mutateAsync(newStatus);
    } catch (err) {
      logger.error('Error updating order delivery status', err, {
        component: 'OrderDeliveryStatusSync',
        orderId,
      });
    }
  };

  // Effect to notify parent when delivery status changes
  useEffect(() => {
    if (delivery?.status && onDeliveryStatusChange) {
      onDeliveryStatusChange(delivery.status);
    }
  }, [delivery?.status, onDeliveryStatusChange]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Delivery Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Delivery Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Unable to load delivery information
          </div>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No delivery associated with this order
  if (!delivery) {
    return null;
  }

  const statusConfig = getDeliveryStatusConfig(delivery.status);
  const StatusIcon = statusConfig.icon;

  const isDelivered = delivery.status === 'delivered' || delivery.status === 'completed';
  const isInTransit = delivery.status === 'in_transit' || delivery.status === 'out_for_delivery';
  const hasLocation = delivery.current_lat !== null && delivery.current_lng !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Delivery Status
          {subscriptionStatus === 'connected' && (
            <span className="ml-auto flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delivery Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge variant={statusConfig.variant} className={statusConfig.className}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Runner Information */}
        {delivery.courier && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Runner</span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{delivery.courier.full_name}</span>
                </div>
              </div>
              {delivery.courier.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`tel:${delivery.courier.phone}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {delivery.courier.phone}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Estimated/Actual Delivery Time */}
        {(delivery.estimated_delivery_time || delivery.actual_delivery_time) && (
          <>
            <Separator />
            {isDelivered && delivery.actual_delivery_time ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Delivered At</span>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-sm">{formatSmartDate(delivery.actual_delivery_time)}</span>
                </div>
              </div>
            ) : delivery.estimated_delivery_time ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated Arrival</span>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{formatSmartDate(delivery.estimated_delivery_time)}</span>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Real-time Location */}
        {isInTransit && hasLocation && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Location</span>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-info" />
                  <span className="text-xs text-muted-foreground font-mono">
                    {delivery.current_lat?.toFixed(6)}, {delivery.current_lng?.toFixed(6)}
                  </span>
                </div>
              </div>
              {delivery.last_location_update && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="text-xs text-muted-foreground">
                    {formatSmartDate(delivery.last_location_update)}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const url = `https://www.google.com/maps?q=${delivery.current_lat},${delivery.current_lng}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                <Navigation className="w-4 h-4 mr-2" />
                View on Map
              </Button>
            </div>
          </>
        )}

        {/* Created/Updated timestamps */}
        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Created</span>
            <span>{formatSmartDate(delivery.created_at)}</span>
          </div>
          {delivery.updated_at && (
            <div className="flex justify-between">
              <span>Last Update</span>
              <span>{formatSmartDate(delivery.updated_at)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default OrderDeliveryStatusSync;

import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, MapPin, ShoppingBag } from "lucide-react";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format } from "date-fns";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { OrderProgressBar } from "@/components/customer/OrderProgressBar";
import { OrderTrackingMap } from "@/components/customer/OrderTrackingMap";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { queryKeys } from '@/lib/queryKeys';

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled";

interface OrderItemWithProduct {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  products: {
    id: string;
    name: string;
    image_url: string | null;
  } | null;
}

interface CourierInfo {
  full_name: string;
  current_lat: number | null;
  current_lng: number | null;
  vehicle_type: string;
}

interface OrderWithDetails {
  id: string;
  status: string;
  tracking_code: string | null;
  delivery_address: string;
  total_amount: number;
  delivery_fee: number;
  delivered_at: string | null;
  created_at: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  courier_id: string | null;
  order_items: OrderItemWithProduct[];
  courier: CourierInfo | null;
}

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { customer, tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;
  const customerEmail = customer?.email;

  // Fetch order details (try orders table first, then marketplace_orders for storefront orders)
  const { data: order, isLoading } = useQuery({
    queryKey: queryKeys.customerOrderTracking.byId(orderId, tenantId, customerId, customerEmail),
    queryFn: async (): Promise<OrderWithDetails | null> => {
      if (!orderId || !tenantId) return null;

      // Try orders table first (admin/POS orders)
      if (customerId) {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            *,
            order_items (
              id,
              product_id,
              product_name,
              quantity,
              price,
              products (
                id,
                name,
                image_url
              )
            ),
            courier:courier_id (
              full_name,
              current_lat,
              current_lng,
              vehicle_type
            )
          `)
          .eq("id", orderId)
          .eq("tenant_id", tenantId)
          .eq("customer_id", customerId)
          .maybeSingle();

        if (error) {
          logger.warn('Orders table query failed, trying marketplace_orders', error, { component: 'OrderTrackingPage' });
        }
        if (data) return data as unknown as OrderWithDetails;
      }

      // Fallback: try marketplace_orders (storefront orders)
      if (customerEmail) {
        const { data: sfData, error: sfError } = await supabase
          .from("marketplace_orders")
          .select('id, status, tracking_token, shipping_address, total_amount, shipping_cost, delivered_at, created_at, items, delivery_notes')
          .eq("id", orderId)
          .eq("seller_tenant_id", tenantId)
          .eq("customer_email", customerEmail.toLowerCase())
          .maybeSingle();

        if (sfError) throw sfError;
        if (sfData) {
          // Parse items from JSONB
          const rawItems = (sfData.items as unknown as Array<{ product_id?: string; name?: string; quantity: number; price: number }>) ?? [];
          // Parse delivery address
          let deliveryAddr = '';
          if (typeof sfData.shipping_address === 'string') {
            deliveryAddr = sfData.shipping_address;
          } else if (sfData.shipping_address && typeof sfData.shipping_address === 'object') {
            const addr = sfData.shipping_address as Record<string, unknown>;
            deliveryAddr = (addr.street as string) || (addr.address as string) || JSON.stringify(sfData.shipping_address);
          }

          return {
            id: sfData.id,
            status: sfData.status || 'pending',
            tracking_code: sfData.tracking_token,
            delivery_address: deliveryAddr || sfData.delivery_notes || '',
            total_amount: sfData.total_amount ?? 0,
            delivery_fee: sfData.shipping_cost ?? 0,
            delivered_at: sfData.delivered_at,
            created_at: sfData.created_at,
            dropoff_lat: null,
            dropoff_lng: null,
            courier_id: null,
            order_items: rawItems.map((item, idx) => ({
              id: `sf-item-${idx}`,
              product_id: item.product_id ?? '',
              product_name: item.name || 'Product',
              quantity: item.quantity,
              price: item.price,
              products: null,
            })),
            courier: null,
          };
        }
      }

      return null;
    },
    enabled: !!orderId && !!tenantId && (!!customerId || !!customerEmail),
    refetchInterval: 10000, // Poll every 10 seconds as fallback
  });

  // Track previous status to show toast on change
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (order?.status && prevStatusRef.current && order.status !== prevStatusRef.current) {
      const label = order.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      toast.info(`Order status updated to ${label}`);
    }
    if (order?.status) {
      prevStatusRef.current = order.status;
    }
  }, [order?.status]);

  // Realtime subscription for instant order status updates (orders + marketplace_orders)
  useEffect(() => {
    if (!orderId || !tenantId) return;

    const channel = supabase
      .channel(`customer-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          logger.debug('Order status update received (orders)', payload.new, 'OrderTrackingPage');
          queryClient.invalidateQueries({ queryKey: queryKeys.customerOrder.byId(orderId) });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          logger.debug('Order status update received (marketplace_orders)', payload.new, 'OrderTrackingPage');
          queryClient.invalidateQueries({ queryKey: queryKeys.customerOrder.byId(orderId) });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Realtime subscribed for order tracking', { orderId }, 'OrderTrackingPage');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, tenantId, queryClient]);

  if (isLoading) {
    return <EnhancedLoadingState variant="list" message="Loading order..." />;
  }

  if (!order) {
    return (
      <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
        <CustomerMobileNav />
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="mb-4">Order not found</p>
              <Button onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}>
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
        <CustomerMobileBottomNav />
      </div>
    );
  }

  const orderStatus = (order.status as OrderStatus) || "pending";

  return (
    <div className="min-h-dvh bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
      <CustomerMobileNav />

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${tenant?.slug}/shop/orders`)}
            className="hover:bg-gray-100 rounded-full"
            aria-label="Back to orders"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--customer-text))]">Order Tracking</h1>
            <p className="text-sm text-[hsl(var(--customer-text-light))]">#{order.tracking_code}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Status & Map */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Bar */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="pt-6 pb-8">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-primary mb-1">
                    {orderStatus === 'delivered' ? 'Order Delivered!' :
                      orderStatus === 'out_for_delivery' ? 'Arriving Soon' :
                        'Estimated Delivery'}
                  </h2>
                  <p className="text-3xl font-bold text-gray-900">
                    {orderStatus === 'delivered' && order.delivered_at
                      ? format(new Date(order.delivered_at), 'h:mm a')
                      : '25-35 min'}
                  </p>
                </div>
                <OrderProgressBar status={orderStatus} />
              </CardContent>
            </Card>

            {/* Map */}
            <OrderTrackingMap order={{
              id: order.id,
              status: order.status,
              dropoff_lat: order.dropoff_lat ?? undefined,
              dropoff_lng: order.dropoff_lng ?? undefined,
              courier_id: order.courier_id ?? undefined,
              courier: order.courier ?? undefined,
            }} />

            {/* Courier Info (if assigned) */}
            {order.courier && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                    🚗
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{order.courier.full_name}</h3>
                    <p className="text-sm text-gray-500">{order.courier.vehicle_type || 'Delivery Partner'}</p>
                  </div>
                  <Button variant="outline" size="icon" className="rounded-full" aria-label="Call delivery driver">
                    <Phone className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Order Details */}
          <div className="space-y-6">
            {/* Delivery Info */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Delivery Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Delivery Address</p>
                    <p className="text-sm text-gray-500">{order.delivery_address}</p>
                  </div>
                </div>
                {tenant?.business_name && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Store</p>
                      <p className="text-sm text-gray-500">{tenant.business_name}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {item.products?.image_url ? (
                          <img src={item.products.image_url} alt={item.products.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <ShoppingBag className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-medium text-sm text-gray-900 truncate pr-2">
                            {item.quantity}x {item.products?.name || item.product_name}
                          </p>
                          <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item.price)} / unit
                        </p>
                      </div>
                    </div>
                  ))}

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium">{formatCurrency(order.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Delivery Fee</span>
                      <span className="font-medium">{formatCurrency(order.delivery_fee)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
                onClick={() => navigate(`/${tenant?.slug}/shop/orders`)}
              >
                View All Orders
              </Button>
              {orderStatus === "delivered" && (
                <Button
                  className="flex-1 bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white"
                  onClick={() => {
                    toast.info("Reorder functionality coming soon");
                  }}
                >
                  Reorder
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <CustomerMobileBottomNav />
    </div>
  );
}

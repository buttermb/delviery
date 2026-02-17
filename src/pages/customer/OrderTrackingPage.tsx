import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, MapPin, ShoppingBag, Loader2 } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format } from "date-fns";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";
import { OrderProgressBar } from "@/components/customer/OrderProgressBar";
import { OrderTrackingMap } from "@/components/customer/OrderTrackingMap";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled";

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { customer, tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;

  // Fetch order details
  const { data: order, isLoading } = useQuery({
    queryKey: ["customer-order", orderId, tenantId, customerId],
    queryFn: async () => {
      if (!orderId || !tenantId || !customerId) return null;

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
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

      if (error) throw error;
      if (!data) throw new Error("Order not found");

      return data;
    },
    enabled: !!orderId && !!tenantId && !!customerId,
    refetchInterval: 10000, // Poll every 10 seconds as fallback
  });

  // Realtime subscription for instant order status updates
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
          logger.debug('Order status update received', payload.new, 'OrderTrackingPage');
          queryClient.invalidateQueries({ queryKey: ['customer-order', orderId] });
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
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
                    {/* @ts-ignore - Property exists at runtime */}
                    {orderStatus === 'delivered' ? format(new Date(order.updated_at), 'h:mm a') : '25-35 min'}
                  </p>
                </div>
                <OrderProgressBar status={orderStatus} />
              </CardContent>
            </Card>

            {/* Map */}
            {/* @ts-ignore - Order type mismatch with map component */}
            <OrderTrackingMap order={order} />

            {/* Courier Info (if assigned) */}
            {/* @ts-ignore - Courier properties exist at runtime */}
            {order.courier && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                    🚗
                  </div>
                  <div className="flex-1">
                    {/* @ts-ignore - Property exists at runtime */}
                    <h3 className="font-bold text-gray-900">{order.courier.full_name}</h3>
                    {/* @ts-ignore - Property exists at runtime */}
                    <p className="text-sm text-gray-500">{order.courier.vehicle_type || 'Delivery Partner'}</p>
                  </div>
                  <Button variant="outline" size="icon" className="rounded-full">
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
                {/* @ts-ignore - Phone property exists in some tenant configurations */}
                {tenant?.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Store Contact</p>
                      {/* @ts-ignore - Phone property exists in some tenant configurations */}
                      <p className="text-sm text-gray-500">{tenant.phone}</p>
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
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {item.products?.image_url ? (
                          <img src={item.products.image_url} alt={item.products.name} className="h-full w-full object-cover" />
                        ) : (
                          <ShoppingBag className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-medium text-sm text-gray-900 truncate pr-2">
                            {item.quantity}x {item.products?.name}
                          </p>
                          <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.total_price)}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item.unit_price)} / unit
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
                      <span className="font-medium">{formatCurrency(0)}</span>
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
                    toast({
                      title: "Reorder",
                      description: "Reorder functionality coming soon",
                    });
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

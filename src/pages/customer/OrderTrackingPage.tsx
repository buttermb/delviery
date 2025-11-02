import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { validateRouteUUID } from "@/lib/utils/uuidValidation";
import { toast } from "@/hooks/use-toast";
import { CustomerMobileNav } from "@/components/customer/CustomerMobileNav";
import { CustomerMobileBottomNav } from "@/components/customer/CustomerMobileBottomNav";

type OrderStatus = "pending" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

interface StatusStep {
  status: OrderStatus;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const statusSteps: StatusStep[] = [
  {
    status: "pending",
    label: "Order Placed",
    icon: <Package className="h-5 w-5" />,
    description: "Your order has been received",
  },
  {
    status: "accepted",
    label: "Order Accepted",
    icon: <CheckCircle2 className="h-5 w-5" />,
    description: "We've confirmed your order",
  },
  {
    status: "preparing",
    label: "Preparing",
    icon: <Clock className="h-5 w-5" />,
    description: "Your order is being prepared",
  },
  {
    status: "out_for_delivery",
    label: "Out for Delivery",
    icon: <Truck className="h-5 w-5" />,
    description: "On the way to you",
  },
  {
    status: "delivered",
    label: "Delivered",
    icon: <CheckCircle2 className="h-5 w-5" />,
    description: "Order has been delivered",
  },
];

export default function OrderTrackingPage() {
  const { orderId: orderIdParam } = useParams<{ orderId: string }>();
  const orderId = validateRouteUUID(orderIdParam);
  const navigate = useNavigate();
  const { customer, tenant } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;

  // Fetch order details
  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ["customer-order", orderId, tenantId, customerId],
    queryFn: async () => {
      if (!orderId || !tenantId || !customerId) return null;

      // @ts-expect-error - Deep nesting causes TS2589, safe to ignore
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
  });

  const getStatusIndex = (status: OrderStatus) => {
    return statusSteps.findIndex(step => step.status === status);
  };

  const currentStatusIndex = order ? getStatusIndex((order.status as OrderStatus) || "pending") : -1;

  const getETA = () => {
    if (!order) return null;
    if (order.eta_minutes) {
      const eta = new Date();
      eta.setMinutes(eta.getMinutes() + order.eta_minutes);
      return eta;
    }
    if (order.estimated_delivery) {
      return new Date(order.estimated_delivery);
    }
    return null;
  };

  const eta = getETA();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <p className="text-[hsl(var(--customer-text-light))]">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[hsl(var(--customer-bg))]">
        <div className="container mx-auto p-6">
          <Card className="bg-white border-[hsl(var(--customer-border))]">
            <CardContent className="pt-6">
              <p className="text-center text-[hsl(var(--customer-text-light))] mb-4">Order not found</p>
              <Button
                variant="outline"
                className="w-full border-[hsl(var(--customer-border))] text-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-surface))]"
                onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const orderStatus = (order.status as OrderStatus) || "pending";

  return (
    <div className="min-h-screen bg-[hsl(var(--customer-bg))] pb-16 lg:pb-0">
      {/* Mobile Top Navigation */}
      <CustomerMobileNav />
      
      {/* Desktop Header */}
      <header className="hidden lg:block border-b border-[hsl(var(--customer-border))] bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate(`/${tenant?.slug}/shop/dashboard`)}
                className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-[hsl(var(--customer-text))]">📦 Track Your Order</h1>
                <p className="text-sm text-[hsl(var(--customer-text-light))] mt-1">
                  Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-surface))]"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Status Progress */}
        <Card className="bg-white border-[hsl(var(--customer-border))]">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--customer-text))]">Order Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusSteps.map((step, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                const isUpcoming = index > currentStatusIndex;

                return (
                  <div key={step.status} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                          isCompleted
                            ? "bg-[hsl(var(--customer-primary))] text-white"
                            : isCurrent
                            ? "bg-[hsl(var(--customer-primary))]/20 text-[hsl(var(--customer-primary))] border-2 border-[hsl(var(--customer-primary))]"
                            : "bg-[hsl(var(--customer-surface))] text-[hsl(var(--customer-text-light))]"
                        }`}
                      >
                        {step.icon}
                      </div>
                      {index < statusSteps.length - 1 && (
                        <div
                          className={`w-0.5 h-16 mt-2 transition-colors ${
                            isCompleted
                              ? "bg-[hsl(var(--customer-primary))]"
                              : "bg-[hsl(var(--customer-surface))]"
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3
                          className={`font-semibold ${
                            isCurrent
                              ? "text-[hsl(var(--customer-primary))]"
                              : isCompleted
                              ? "text-[hsl(var(--customer-text))]"
                              : "text-[hsl(var(--customer-text-light))]"
                          }`}
                        >
                          {step.label}
                        </h3>
                        {isCurrent && (
                          <Badge className="bg-[hsl(var(--customer-primary))]/20 text-[hsl(var(--customer-primary))] border-[hsl(var(--customer-primary))]/30">
                            Current
                          </Badge>
                        )}
                        {isCompleted && !isCurrent && (
                          <Badge variant="outline" className="border-green-500/30 text-green-600">
                            ✓ Complete
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-[hsl(var(--customer-text-light))]">{step.description}</p>
                      {isCurrent && index === 3 && order.eta_minutes && (
                        <p className="text-sm text-[hsl(var(--customer-primary))] font-medium mt-2">
                          ⏱️ Estimated arrival: {order.eta_minutes} minutes
                        </p>
                      )}
                      {isCompleted && index === 0 && order.created_at && (
                        <p className="text-xs text-[hsl(var(--customer-text-light))] mt-1">
                          {formatSmartDate(order.created_at)}
                        </p>
                      )}
                      {isCompleted && index === 4 && order.delivered_at && (
                        <p className="text-xs text-[hsl(var(--customer-text-light))] mt-1">
                          Delivered: {formatSmartDate(order.delivered_at)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ETA & Delivery Info */}
        {eta && orderStatus !== "delivered" && orderStatus !== "cancelled" && (
          <Card className="bg-gradient-to-r from-[hsl(var(--customer-primary))]/10 to-[hsl(var(--customer-secondary))]/10 border-[hsl(var(--customer-primary))]/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-[hsl(var(--customer-text))] mb-1">
                    🚚 Estimated Delivery Time
                  </h3>
                  <p className="text-2xl font-bold text-[hsl(var(--customer-primary))]">
                    {eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                  {order.eta_minutes && (
                    <p className="text-sm text-[hsl(var(--customer-text-light))] mt-1">
                      In approximately {order.eta_minutes} minutes
                    </p>
                  )}
                </div>
                <div className="text-5xl">🚗</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Address */}
        {order.delivery_address && (
          <Card className="bg-white border-[hsl(var(--customer-border))]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--customer-text))] flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-[hsl(var(--customer-text))] font-medium">{order.delivery_address}</p>
                {order.delivery_borough && (
                  <p className="text-sm text-[hsl(var(--customer-text-light))]">
                    {order.delivery_borough}
                  </p>
                )}
                {order.delivery_notes && (
                  <div className="mt-3 p-3 bg-[hsl(var(--customer-surface))] rounded-lg">
                    <p className="text-sm font-medium text-[hsl(var(--customer-text))] mb-1">Delivery Notes:</p>
                    <p className="text-sm text-[hsl(var(--customer-text-light))]">{order.delivery_notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Information */}
        {tenant && (
          <Card className="bg-white border-[hsl(var(--customer-border))]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--customer-text))]">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(tenant as any).phone && (
                <Button
                  variant="outline"
                  className="w-full justify-start border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
                  onClick={() => window.open(`tel:${(tenant as any).phone}`)}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call: {(tenant as any).phone}
                </Button>
              )}
              {(tenant as any).owner_email && (
                <Button
                  variant="outline"
                  className="w-full justify-start border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]"
                  onClick={() => window.open(`mailto:${(tenant as any).owner_email}`)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email: {(tenant as any).owner_email}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card className="bg-white border-[hsl(var(--customer-border))]">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--customer-text))]">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Order Items */}
            {order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0 && (
              <div className="space-y-3">
                {order.order_items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.products?.image_url ? (
                        <img
                          src={item.products.image_url}
                          alt={item.products.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-[hsl(var(--customer-surface))] flex items-center justify-center">
                          <Package className="h-6 w-6 text-[hsl(var(--customer-text-light))]" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-[hsl(var(--customer-text))]">
                          {item.products?.name || "Product"}
                        </p>
                        <p className="text-sm text-[hsl(var(--customer-text-light))]">
                          {item.quantity} × {formatCurrency(item.unit_price || 0)}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-[hsl(var(--customer-text))]">
                      {formatCurrency(item.total_price || 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-[hsl(var(--customer-text))]">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal || order.total_amount || 0)}</span>
              </div>
              {order.delivery_fee && order.delivery_fee > 0 && (
                <div className="flex justify-between text-[hsl(var(--customer-text))]">
                  <span>Delivery Fee:</span>
                  <span>{formatCurrency(order.delivery_fee)}</span>
                </div>
              )}
              {order.discount_amount && order.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold text-[hsl(var(--customer-text))]">
                <span>Total:</span>
                <span className="text-[hsl(var(--customer-primary))]">
                  {formatCurrency(order.total_amount || 0)}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            {order.payment_method && (
              <div className="pt-4 border-t">
                <p className="text-sm text-[hsl(var(--customer-text-light))] mb-1">Payment Method:</p>
                <p className="font-medium text-[hsl(var(--customer-text))] capitalize">
                  {order.payment_method}
                </p>
              </div>
            )}
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

      {/* Mobile Bottom Navigation */}
      <CustomerMobileBottomNav />
    </div>
  );
}


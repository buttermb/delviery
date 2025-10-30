import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Package, MapPin, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import CustomerLayout from "@/layouts/CustomerLayout";
import { CustomerLocationSharing } from "@/components/CustomerLocationSharing";
import PostPurchaseSignupPrompt from "@/components/PostPurchaseSignupPrompt";

const OrderConfirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!orderId) {
      navigate("/");
      return;
    }

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .maybeSingle();

      if (error || !data) {
        console.error("Error fetching order:", error);
        navigate("/");
        return;
      }

      setOrder(data);
      setLoading(false);
    };

    fetchOrder();
  }, [orderId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <CustomerLayout>
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="container max-w-3xl mx-auto">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
            <p className="text-muted-foreground">
              Your order has been placed successfully
            </p>
            <div className="mt-4 p-4 bg-gradient-to-r from-primary/20 to-emerald-500/20 border border-primary/30 rounded-lg">
              <p className="text-sm font-semibold text-primary flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                🎉 You earned 5 giveaway entries with this purchase!
              </p>
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Order ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-lg">{order.id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(order.id);
                      alert("Order ID copied!");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Status</span>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  {order.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Estimated Delivery</span>
                <span className="font-semibold">30-45 minutes</span>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Address</div>
                <div className="font-medium">{order.delivery_address}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Borough</div>
                <div className="font-medium">{order.delivery_borough}</div>
              </div>
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  ⚠️ Valid 21+ ID required at delivery
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-medium">{order.payment_method}</div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{item.product_name}</div>
                    <div className="text-sm text-muted-foreground">Qty: {item.quantity}</div>
                  </div>
                  <div className="font-medium">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery Fee</span>
                  <span>${order.delivery_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>${order.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <CustomerLocationSharing orderId={orderId} />

          {/* Post-purchase signup prompt for guest orders */}
          {!user && order.customer_name && (
            <div className="mb-6">
              <PostPurchaseSignupPrompt 
                orderEmail={order.customer_phone || "guest@example.com"}
                orderNumber={order.order_number || order.id.slice(0, 8)}
              />
            </div>
          )}

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/")}
            >
              Return to Shop
            </Button>
            <Button
              variant="hero"
              className="flex-1"
              onClick={() => navigate(`/track/${order?.tracking_code || orderId}`)}
            >
              Track Your Order
            </Button>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default OrderConfirmation;

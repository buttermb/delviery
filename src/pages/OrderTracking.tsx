import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, Truck, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) {
        toast({
          title: "Invalid Order",
          description: "Please provide a valid order ID.",
          variant: "destructive",
        });
        navigate("/track-order");
        return;
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(orderId)) {
        toast({
          title: "Invalid Order ID",
          description: "The order ID format is invalid.",
          variant: "destructive",
        });
        navigate("/track-order");
        return;
      }

      try {
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();

        if (orderError) throw orderError;

        if (!orderData) {
          toast({
            title: "Order Not Found",
            description: "The order you're looking for doesn't exist.",
            variant: "destructive",
          });
          navigate("/track-order");
          return;
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", orderId);

        if (itemsError) throw itemsError;

        setOrder(orderData);
        setOrderItems(itemsData || []);
      } catch (error) {
        console.error("Error fetching order:", error);
        toast({
          title: "Error",
          description: "Failed to load order details.",
          variant: "destructive",
        });
        navigate("/track-order");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();

    // Set up real-time subscription for order updates
    if (orderId) {
      const channel = supabase
        .channel(`order-${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            console.log("Order status updated:", payload);
            setOrder(payload.new as any);
            
            // Show toast notification for status changes
            const newStatus = (payload.new as any).status;
            if (newStatus === "delivered") {
              toast({
                title: "Order Delivered! 🎉",
                description: "Your order has been successfully delivered.",
              });
            } else if (newStatus === "out_for_delivery") {
              toast({
                title: "Out for Delivery",
                description: "Your order is on its way!",
              });
            } else if (newStatus === "preparing") {
              toast({
                title: "Order Being Prepared",
                description: "Your order is being prepared for delivery.",
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [orderId, navigate, toast]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "Order Received", icon: Package, color: "bg-blue-500" };
      case "processing":
        return { label: "Being Prepared", icon: Clock, color: "bg-yellow-500" };
      case "out_for_delivery":
        return { label: "Out for Delivery", icon: Truck, color: "bg-orange-500" };
      case "delivered":
        return { label: "Delivered", icon: CheckCircle, color: "bg-green-500" };
      default:
        return { label: "Unknown", icon: Package, color: "bg-gray-500" };
    }
  };

  const statusInfo = order ? getStatusInfo(order.status) : null;
  const StatusIcon = statusInfo?.icon;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-16">
          <div className="text-center">Loading order details...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/track-order")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tracking
        </Button>

        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Order Tracking</h1>
            <p className="text-muted-foreground">Order ID: {order.id}</p>
          </div>

          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                {StatusIcon && (
                  <div className={`w-12 h-12 rounded-full ${statusInfo?.color} flex items-center justify-center`}>
                    <StatusIcon className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold">{statusInfo?.label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {order.status === "delivered" 
                      ? "Your order has been delivered"
                      : "Estimated delivery: 30-45 minutes"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${order.status !== "pending" ? "bg-primary" : "bg-muted"}`} />
                  <span className={order.status !== "pending" ? "font-medium" : "text-muted-foreground"}>
                    Order Received
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${order.status === "processing" || order.status === "out_for_delivery" || order.status === "delivered" ? "bg-primary" : "bg-muted"}`} />
                  <span className={order.status === "processing" || order.status === "out_for_delivery" || order.status === "delivered" ? "font-medium" : "text-muted-foreground"}>
                    Being Prepared
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${order.status === "out_for_delivery" || order.status === "delivered" ? "bg-primary" : "bg-muted"}`} />
                  <span className={order.status === "out_for_delivery" || order.status === "delivered" ? "font-medium" : "text-muted-foreground"}>
                    Out for Delivery
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${order.status === "delivered" ? "bg-primary" : "bg-muted"}`} />
                  <span className={order.status === "delivered" ? "font-medium" : "text-muted-foreground"}>
                    Delivered
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Date</span>
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method</span>
                  <Badge variant="outline">
                    {order.payment_method === "cash" ? "Cash on Delivery" : "Bitcoin/USDC"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Address</span>
                  <span className="text-right">{order.delivery_address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Borough</span>
                  <span className="capitalize">{order.delivery_borough}</span>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Items</h4>
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.product_name} x{item.quantity}
                      </span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${Number(order.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delivery Fee</span>
                  <span>${Number(order.delivery_fee).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <h4 className="font-semibold">Need Help?</h4>
                <p className="text-sm text-muted-foreground">
                  If you have any questions about your order, please contact our support team.
                </p>
                <Button variant="outline" onClick={() => navigate("/support")}>
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderTracking;

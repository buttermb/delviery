import CustomerLayout from "@/layouts/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const OrderLookup = () => {
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderId.trim()) {
      toast({
        title: "Error",
        description: "Please enter an order ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, user_id, tracking_code")
        .eq("id", orderId.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        navigate(`/track/${data.tracking_code || data.id}`);
      } else {
        toast({
          title: "Order Not Found",
          description: "No order found with this ID. Please check and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error looking up order:", error);
      toast({
        title: "Error",
        description: "Failed to lookup order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Track Your Order</h1>
            <p className="text-lg text-muted-foreground">
              Enter your order ID to view the status and details of your delivery
            </p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleLookup} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="orderId">Order ID</Label>
                <div className="relative">
                  <Input
                    id="orderId"
                    placeholder="e.g., 550e8400-e29b-41d4-a716-446655440000"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="pr-10"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your order ID can be found in your confirmation email or on the order confirmation page
                </p>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Looking up..." : "Track Order"}
              </Button>
            </form>
          </Card>

          <div className="mt-12 space-y-6">
            <h2 className="text-2xl font-semibold text-center">Need Help?</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold mb-2">Can't find your order ID?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Check your email confirmation or log in to view your order history.
                </p>
                <Button variant="outline" onClick={() => navigate("/my-orders")} className="w-full">
                  View My Orders
                </Button>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-2">Having issues?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Our support team is here to help with any questions or concerns.
                </p>
                <Button variant="outline" onClick={() => navigate("/support")} className="w-full">
                  Contact Support
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default OrderLookup;

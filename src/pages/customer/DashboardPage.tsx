import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingBag,
  Package,
  ArrowRight,
  Settings
} from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Link, useNavigate } from "react-router-dom";
import { MenuList } from "@/components/customer/MenuList";

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { customer, tenant, logout } = useCustomerAuth();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;

  // Fetch recent orders
  const { data: recentOrders } = useQuery({
    queryKey: ["customer-orders", tenantId, customerId],
    queryFn: async () => {
      if (!tenantId || !customerId) return [];

      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total_amount, status, created_at")
        .eq("tenant_id", tenantId)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!tenantId && !!customerId,
  });

  const handleLogout = async () => {
    await logout();
    navigate(`/${tenant?.slug}/shop/login`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      delivered: "default",
      pending: "secondary",
      processing: "outline",
      cancelled: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{tenant?.business_name || "Customer Portal"}</h1>
            <p className="text-sm text-muted-foreground">Welcome, {customer?.first_name || customer?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to={`/${tenant?.slug}/shop/settings`}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Available Menus */}
        <Card>
          <CardHeader>
            <CardTitle>📱 Available Menus</CardTitle>
          </CardHeader>
          <CardContent>
            <MenuList />
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>🛒 Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/${tenant?.slug}/shop/orders/${order.id}`)}
                  >
                    <div>
                      <p className="font-medium">#{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(order.total_amount || 0)}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No orders yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Browse menus to place your first order
                </p>
              </div>
            )}
            {recentOrders && recentOrders.length > 0 && (
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to={`/${tenant?.slug}/shop/orders`}>
                  View All Orders <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


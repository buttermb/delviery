import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingBag,
  Package,
  ArrowRight,
  Settings,
  Sparkles,
  TrendingUp,
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
    const statusConfig: Record<string, { label: string; className: string }> = {
      delivered: { label: "Delivered", className: "bg-green-100 text-green-700 border-green-200" },
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
      processing: { label: "Processing", className: "bg-blue-100 text-blue-700 border-blue-200" },
      cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
    };

    const config = statusConfig[status] || { label: status.toUpperCase(), className: "" };

    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--customer-bg))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--customer-border))] bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--customer-text))]">{tenant?.business_name || "Customer Portal"}</h1>
            <p className="text-sm text-[hsl(var(--customer-text-light))]">
              Welcome back, {customer?.first_name || customer?.email}! 👋
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]">
              <Link to={`/${tenant?.slug}/shop/settings`}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-[hsl(var(--customer-primary))]/10 to-[hsl(var(--customer-primary))]/5 border-[hsl(var(--customer-primary))]/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--customer-text))]">📦 Total Orders</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--customer-primary))]/20 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-[hsl(var(--customer-primary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--customer-text))]">{recentOrders?.length || 0}</div>
              <p className="text-xs text-[hsl(var(--customer-text-light))] mt-1">All time</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[hsl(var(--customer-secondary))]/10 to-[hsl(var(--customer-secondary))]/5 border-[hsl(var(--customer-secondary))]/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--customer-text))]">💰 Total Spent</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--customer-secondary))]/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[hsl(var(--customer-secondary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--customer-text))]">
                {formatCurrency(
                  recentOrders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0
                )}
              </div>
              <p className="text-xs text-[hsl(var(--customer-text-light))] mt-1">Lifetime value</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-100 to-purple-50 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--customer-text))]">✨ Member Since</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-purple-200 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--customer-text))]">
                {customer?.created_at ? new Date(customer.created_at).getFullYear() : "--"}
              </div>
              <p className="text-xs text-[hsl(var(--customer-text-light))] mt-1">Years with us</p>
            </CardContent>
          </Card>
        </div>

        {/* Available Menus */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--customer-text))]">📱 Available Menus</CardTitle>
              <Button variant="ghost" size="sm" className="text-[hsl(var(--customer-primary))]">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <MenuList />
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="bg-white border-[hsl(var(--customer-border))] shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--customer-text))]">🛒 Recent Orders</CardTitle>
              {recentOrders && recentOrders.length > 0 && (
                <Button variant="ghost" size="sm" asChild className="text-[hsl(var(--customer-primary))]">
                  <Link to={`/${tenant?.slug}/shop/orders`}>
                    View All <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border border-[hsl(var(--customer-border))] rounded-lg hover:bg-[hsl(var(--customer-surface))] cursor-pointer transition-colors"
                    onClick={() => navigate(`/${tenant?.slug}/shop/orders/${order.id}`)}
                  >
                    <div>
                      <p className="font-medium text-[hsl(var(--customer-text))]">#{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-[hsl(var(--customer-text-light))]">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-[hsl(var(--customer-text))]">{formatCurrency(order.total_amount || 0)}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[hsl(var(--customer-surface))] mb-4">
                  <ShoppingBag className="h-10 w-10 text-[hsl(var(--customer-text-light))]" />
                </div>
                <p className="text-lg font-medium text-[hsl(var(--customer-text))] mb-2">No orders yet</p>
                <p className="text-sm text-[hsl(var(--customer-text-light))] mb-4">
                  Browse menus to place your first order
                </p>
                <Button className="bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white">
                  Browse Menus <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

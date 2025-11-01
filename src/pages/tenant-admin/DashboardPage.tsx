import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Package, 
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Settings
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Link } from "react-router-dom";

export default function TenantAdminDashboardPage() {
  const navigate = useNavigate();
  const { admin, tenant, logout } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Fetch today's metrics
  const { data: todayMetrics } = useQuery({
    queryKey: ["tenant-dashboard-today", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's orders
      const { data: orders } = await supabase
        .from("wholesale_orders")
        .select("total_amount, status")
        .eq("tenant_id", tenantId)
        .gte("created_at", today.toISOString());

      const sales = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
      const orderCount = orders?.length || 0;

      // Get low stock items
      const { data: inventory } = await supabase
        .from("wholesale_inventory")
        .select("strain, weight_lbs, low_stock_threshold")
        .eq("tenant_id", tenantId);

      const lowStock = inventory?.filter(
        (item) => Number(item.weight_lbs || 0) <= Number(item.low_stock_threshold || 10)
      ) || [];

      return {
        sales,
        orderCount,
        lowStock: lowStock.slice(0, 5),
      };
    },
    enabled: !!tenantId,
  });

  // Fetch recent orders
  const { data: recentOrders } = useQuery({
    queryKey: ["tenant-recent-orders", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("wholesale_orders")
        .select("id, order_number, total_amount, status, created_at, client_name")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!tenantId,
  });

  const handleLogout = async () => {
    await logout();
    navigate(`/${tenant?.slug}/admin/login`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      delivered: "default",
      pending: "secondary",
      in_transit: "outline",
      cancelled: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  // Check if trial is ending soon
  const trialEndingSoon = tenant?.trial_ends_at && new Date(tenant.trial_ends_at) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🎛️ {tenant?.business_name || "Dashboard"}</h1>
            <p className="text-sm text-muted-foreground">Admin Panel</p>
          </div>
          <div className="flex items-center gap-4">
            {admin && (
              <div className="text-sm text-muted-foreground">
                {admin.email}
              </div>
            )}
            <Button variant="ghost" asChild>
              <Link to={`/${tenant?.slug}/admin/settings`}>
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
        {/* Trial Ending Alert */}
        {trialEndingSoon && tenant?.subscription_status === "trial" && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-semibold">⚠️ Trial Ending Soon</p>
                    <p className="text-sm text-muted-foreground">
                      Your trial ends in {Math.ceil((new Date(tenant.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days.
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link to={`/${tenant?.slug}/admin/billing`}>
                    Upgrade to keep using features →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-xl font-semibold">
                  {tenant?.subscription_plan?.charAt(0).toUpperCase() + tenant?.subscription_plan?.slice(1)} - {formatCurrency(tenant?.mrr || 0)}/month
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Next billing: {tenant?.next_billing_date ? new Date(tenant.next_billing_date).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to={`/${tenant?.slug}/admin/billing`}>
                  View billing details →
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">💰 Today's Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(todayMetrics?.sales || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {todayMetrics?.orderCount || 0} orders today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">📦 Recent Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentOrders?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Last 5 orders
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/${tenant?.slug}/admin/orders/${order.id}`)}
                  >
                    <div>
                      <p className="font-medium">#{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">{order.client_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(order.total_amount || 0)}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No recent orders</p>
            )}
            <Button variant="outline" className="w-full mt-4" asChild>
              <Link to={`/${tenant?.slug}/admin/orders`}>
                View All Orders <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        {todayMetrics?.lowStock && todayMetrics.lowStock.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Low Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todayMetrics.lowStock.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{item.strain}</p>
                      <p className="text-sm text-muted-foreground">
                        {Number(item.weight_lbs || 0).toFixed(2)} lbs remaining
                      </p>
                    </div>
                    <Badge variant="destructive">Low Stock</Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link to={`/${tenant?.slug}/admin/inventory`}>
                  Manage Inventory <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}


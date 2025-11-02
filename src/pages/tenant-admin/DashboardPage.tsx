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
  Settings,
  Users,
  Activity,
  Zap,
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
    queryFn: async (): Promise<any> => {
      if (!tenantId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's orders
      const { data: orders } = await (supabase
        .from("wholesale_orders") as any)
        .select("total_amount, status")
        .eq("tenant_id", tenantId)
        .gte("created_at", today.toISOString());

      const sales = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
      const orderCount = orders?.length || 0;

      // Get low stock items
      const { data: inventory } = await (supabase
        .from("wholesale_inventory") as any)
        .select("strain, weight_lbs, low_stock_threshold")
        .eq("tenant_id", tenantId);

      const lowStock = inventory?.filter(
        (item: any) => Number(item.weight_lbs || 0) <= Number(item.low_stock_threshold || 10)
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

      const { data } = await (supabase
        .from("wholesale_orders") as any)
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
    const statusConfig: Record<string, { label: string; className: string }> = {
      delivered: { label: "Delivered", className: "bg-green-100 text-green-700 border-green-200" },
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
      in_transit: { label: "In Transit", className: "bg-blue-100 text-blue-700 border-blue-200" },
      cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
    };

    const config = statusConfig[status] || { label: status.toUpperCase(), className: "" };

    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // Check if trial is ending soon
  const trialEndingSoon = (tenant as any)?.trial_ends_at && new Date((tenant as any).trial_ends_at) < new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  
  // Calculate setup progress
  const setupProgress = {
    hasProducts: false,
    hasCustomers: false,
    hasOrders: (recentOrders?.length || 0) > 0,
    hasInventory: (todayMetrics?.lowStock?.length || 0) > 0,
  };
  const completedSteps = Object.values(setupProgress).filter(Boolean).length;
  const totalSteps = Object.keys(setupProgress).length;
  const progressPercentage = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-[hsl(var(--tenant-bg))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--tenant-border))] bg-white sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--tenant-text))]">🎛️ {tenant?.business_name || "Dashboard"}</h1>
            <p className="text-sm text-[hsl(var(--tenant-text-light))]">Admin Panel</p>
          </div>
          <div className="flex items-center gap-4">
            {admin && (
              <div className="text-sm text-[hsl(var(--tenant-text-light))]">
                {admin.email}
              </div>
            )}
            <Button variant="ghost" asChild className="text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]">
              <Link to={`/${tenant?.slug}/admin/settings`}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Setup Progress */}
        {progressPercentage < 100 && (
          <Card className="border-[hsl(var(--tenant-primary))] bg-gradient-to-r from-[hsl(var(--tenant-primary))]/5 to-[hsl(var(--tenant-primary))]/10 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-[hsl(var(--tenant-text))] text-lg">🚀 Get Started</p>
                  <p className="text-sm text-[hsl(var(--tenant-text-light))]">
                    Complete your setup to unlock all features
                  </p>
                </div>
                <div className="text-2xl font-bold text-[hsl(var(--tenant-primary))]">
                  {progressPercentage}%
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-[hsl(var(--tenant-primary))] h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-3 rounded-lg ${setupProgress.hasProducts ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'} border`}>
                  <p className="text-sm font-medium">{setupProgress.hasProducts ? '✅' : '📦'} Products</p>
                </div>
                <div className={`p-3 rounded-lg ${setupProgress.hasCustomers ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'} border`}>
                  <p className="text-sm font-medium">{setupProgress.hasCustomers ? '✅' : '👥'} Customers</p>
                </div>
                <div className={`p-3 rounded-lg ${setupProgress.hasOrders ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'} border`}>
                  <p className="text-sm font-medium">{setupProgress.hasOrders ? '✅' : '🛒'} Orders</p>
                </div>
                <div className={`p-3 rounded-lg ${setupProgress.hasInventory ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'} border`}>
                  <p className="text-sm font-medium">{setupProgress.hasInventory ? '✅' : '📊'} Inventory</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trial Ending Alert */}
        {trialEndingSoon && tenant?.subscription_status === "trial" && (
          <Card className="border-yellow-400 bg-yellow-50 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-semibold text-yellow-900">⚠️ Trial Ending Soon</p>
                    <p className="text-sm text-yellow-700">
                      Your trial ends in {Math.ceil((new Date((tenant as any).trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days.
                    </p>
                  </div>
                </div>
                <Button className="bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white" asChild>
                  <Link to={`/${tenant?.slug}/admin/billing`}>
                    Upgrade Now →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Plan & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Current Plan Info */}
          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm lg:col-span-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--tenant-text-light))]">Current Plan</p>
                  <p className="text-xl font-semibold text-[hsl(var(--tenant-text))]">
                    {tenant?.subscription_plan?.charAt(0).toUpperCase() + tenant?.subscription_plan?.slice(1)} - {formatCurrency((tenant as any)?.mrr || 0)}/month
                  </p>
                  <p className="text-sm text-[hsl(var(--tenant-text-light))] mt-1">
                    Next billing: {(tenant as any)?.next_billing_date ? new Date((tenant as any).next_billing_date).toLocaleDateString() : "N/A"}
                  </p>
                  <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-2">
                    💎 Platform fee: {formatCurrency(((tenant as any)?.mrr || 0) * 0.02)}/month (2%)
                  </p>
                </div>
                <Button variant="outline" asChild className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-surface))]">
                  <Link to={`/${tenant?.slug}/admin/billing`}>
                    Manage Plan →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--tenant-text))] text-base">⚡ Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={`/${tenant?.slug}/admin/products`}>
                  <Package className="h-4 w-4 mr-2" />
                  Add Product
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={`/${tenant?.slug}/admin/orders`}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  View Orders
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={`/${tenant?.slug}/admin/settings`}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Today's Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text))]">💰 Today's Sales</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--tenant-primary))]/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--tenant-text))]">{formatCurrency(todayMetrics?.sales || 0)}</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {todayMetrics?.orderCount || 0} orders today
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text))]">📦 Orders</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--tenant-secondary))]/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-[hsl(var(--tenant-secondary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--tenant-text))]">{recentOrders?.length || 0}</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-1">
                Recent orders
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text))]">👥 Customers</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--tenant-text))]">--</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-1">
                Active customers
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text))]">⚡ Activity</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--tenant-accent))]/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-[hsl(var(--tenant-accent))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--tenant-text))]">--</div>
              <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-1">
                This week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--tenant-text))]">Recent Orders</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-[hsl(var(--tenant-primary))]">
                <Link to={`/${tenant?.slug}/admin/orders`}>
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border border-[hsl(var(--tenant-border))] rounded-lg hover:bg-[hsl(var(--tenant-surface))] cursor-pointer transition-colors"
                    onClick={() => navigate(`/${tenant?.slug}/admin/orders/${order.id}`)}
                  >
                    <div>
                      <p className="font-medium text-[hsl(var(--tenant-text))]">#{order.order_number}</p>
                      <p className="text-sm text-[hsl(var(--tenant-text-light))]">{order.client_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-[hsl(var(--tenant-text))]">{formatCurrency(order.total_amount || 0)}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-[hsl(var(--tenant-text-light))] mb-4" />
                <p className="text-[hsl(var(--tenant-text-light))]">No recent orders</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        {todayMetrics?.lowStock && todayMetrics.lowStock.length > 0 && (
          <Card className="bg-white border-yellow-300 border-2 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[hsl(var(--tenant-text))]">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayMetrics.lowStock.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                    <div>
                      <p className="font-medium text-[hsl(var(--tenant-text))]">{item.strain}</p>
                      <p className="text-sm text-[hsl(var(--tenant-text-light))]">
                        {Number(item.weight_lbs || 0).toFixed(2)} lbs remaining
                      </p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Low Stock</Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-surface))]" asChild>
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

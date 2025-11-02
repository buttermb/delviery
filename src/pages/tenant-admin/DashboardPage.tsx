import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Smartphone,
  Plus,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Link } from "react-router-dom";
import { LimitGuard } from "@/components/whitelabel/LimitGuard";
import { OnboardingCompletionModal } from "@/components/onboarding/OnboardingCompletionModal";

export default function TenantAdminDashboardPage() {
  const navigate = useNavigate();
  const { admin, tenant, logout } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [showCompletionModal, setShowCompletionModal] = useState(false);

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

  const handleLogout = async () => {
    await logout();
    navigate(`/${tenant?.slug}/admin/login`);
  };

  // Calculate trial days remaining
  const trialEndsAt = (tenant as any)?.trial_ends_at;
  const trialDaysRemaining = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const trialEndingSoon = trialDaysRemaining !== null && trialDaysRemaining <= 10 && trialDaysRemaining > 0;

  // Get usage and limits
  const usage = (tenant as any)?.usage || {};
  const limits = (tenant as any)?.limits || {};

  // Calculate onboarding progress
  const onboardingSteps = [
    { id: "products", completed: (usage.products || 0) > 0 },
    { id: "customers", completed: (usage.customers || 0) > 0 },
    { id: "menu", completed: (usage.menus || 0) > 0 },
  ];
  const completedSteps = onboardingSteps.filter((s) => s.completed).length;
  const onboardingProgress = (completedSteps / onboardingSteps.length) * 100;
  const isComplete = onboardingProgress === 100 && !(tenant as any)?.onboarding_completed;

  // Show completion modal when onboarding is 100% complete (first time only)
  useEffect(() => {
    if (isComplete && !showCompletionModal && tenantId) {
      const timer = setTimeout(() => {
        setShowCompletionModal(true);
      }, 1000); // Small delay after page load
      return () => clearTimeout(timer);
    }
  }, [isComplete, showCompletionModal, tenantId]);

  // Fetch recent activity (menu views, orders, menu creations)
  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const activities: any[] = [];

      // Get tenant's menus first to filter activity
      const { data: tenantMenus } = await supabase
        .from("disposable_menus")
        .select("id, name, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!tenantMenus || tenantMenus.length === 0) return [];

      const menuIds = tenantMenus.map((m) => m.id);

      // Get recent menu views (from menu_access_logs via menus)
      const { data: menuLogs } = await supabase
        .from("menu_access_logs")
        .select("menu_id, accessed_at, actions_taken, disposable_menus(name)")
        .in("menu_id", menuIds)
        .order("accessed_at", { ascending: false })
        .limit(5);

      menuLogs?.forEach((log: any) => {
        activities.push({
          type: "menu_view",
          message: `Customer viewed menu "${log.disposable_menus?.name || "Unknown"}"`,
          timestamp: log.accessed_at,
        });
      });

      // Get recent orders (via menu_id)
      const { data: orders } = await supabase
        .from("menu_orders")
        .select("id, total_amount, created_at, disposable_menus(name)")
        .in("menu_id", menuIds)
        .order("created_at", { ascending: false })
        .limit(5);

      orders?.forEach((order: any) => {
        activities.push({
          type: "order_placed",
          message: `Order #${order.id.slice(0, 8)} placed - ${formatCurrency(order.total_amount || 0)}`,
          timestamp: order.created_at,
        });
      });

      // Get recent menu creations (most recent 5)
      tenantMenus.slice(0, 5).forEach((menu: any) => {
        activities.push({
          type: "menu_created",
          message: `Menu "${menu.name}" created`,
          timestamp: menu.created_at,
        });
      });

      // Sort by timestamp and return top 5
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    },
    enabled: !!tenantId,
  });

  // Calculate revenue and commission from actual transaction data
  const { data: revenueData } = useQuery({
    queryKey: ["revenue-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return { total: 0, commission: 0 };

      // Get tenant's menus first
      const { data: tenantMenus } = await supabase
        .from("disposable_menus")
        .select("id")
        .eq("tenant_id", tenantId);

      if (!tenantMenus || tenantMenus.length === 0) return { total: 0, commission: 0 };

      const menuIds = tenantMenus.map((m) => m.id);

      // Get confirmed orders from these menus for total revenue
      const { data: orders } = await supabase
        .from("menu_orders")
        .select("total_amount")
        .in("menu_id", menuIds)
        .eq("status", "confirmed");

      const total = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;

      // Get actual commission transactions (more accurate than calculating)
      const { data: commissions } = await supabase
        .from("commission_transactions")
        .select("commission_amount, customer_payment_amount")
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "processed", "paid"]);

      const commission = commissions?.reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0) || 0;

      return { total, commission };
    },
    enabled: !!tenantId,
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--tenant-bg))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--tenant-border))] bg-white sticky top-0 z-50 shadow-sm safe-area-top">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold text-[hsl(var(--tenant-text))] truncate">
              🎛️ {tenant?.business_name || "Dashboard"}
            </h1>
            <p className="text-xs sm:text-sm text-[hsl(var(--tenant-text-light))] hidden sm:block">Admin Panel</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {admin && (
              <div className="text-xs sm:text-sm text-[hsl(var(--tenant-text-light))] hidden sm:block truncate max-w-[120px]">
                {admin.email}
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              asChild 
              className="text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))] min-h-[44px] px-2 sm:px-3"
            >
              <Link to={`/${tenant?.slug}/admin/settings`}>
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout} 
              className="border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))] min-h-[44px] px-2 sm:px-3"
            >
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Trial Countdown Banner */}
        {tenant?.subscription_status === "trial" && trialDaysRemaining !== null && (
          <Card className={`border-2 ${
            trialDaysRemaining <= 3 
              ? "border-red-400 bg-red-50" 
              : trialDaysRemaining <= 10 
              ? "border-yellow-400 bg-yellow-50" 
              : "border-blue-400 bg-blue-50"
          }`}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`h-5 w-5 ${
                    trialDaysRemaining <= 3 ? "text-red-600" : trialDaysRemaining <= 10 ? "text-yellow-600" : "text-blue-600"
                  }`} />
                  <div>
                    <p className={`font-semibold ${
                      trialDaysRemaining <= 3 ? "text-red-900" : trialDaysRemaining <= 10 ? "text-yellow-900" : "text-blue-900"
                    }`}>
                      {trialDaysRemaining <= 0 
                        ? "⚠️ Trial Expired" 
                        : trialDaysRemaining <= 3 
                        ? "⚠️ Trial Ending in " + trialDaysRemaining + " days"
                        : "⏰ Trial Ending in " + trialDaysRemaining + " days"}
                    </p>
                    <p className={`text-sm ${
                      trialDaysRemaining <= 3 ? "text-red-700" : trialDaysRemaining <= 10 ? "text-yellow-700" : "text-blue-700"
                    }`}>
                      {trialDaysRemaining <= 0 
                        ? "Upgrade to continue using the platform"
                        : "Upgrade now to keep your data and continue using all features"}
                    </p>
                  </div>
                </div>
                <Button 
                  className="bg-[hsl(var(--tenant-primary))] hover:bg-[hsl(var(--tenant-primary))]/90 text-white whitespace-nowrap min-h-[44px] px-3 sm:px-4 text-sm sm:text-base touch-manipulation" 
                  asChild
                >
                  <Link to={`/${tenant?.slug}/admin/billing`}>
                    <span className="hidden sm:inline">Upgrade Now →</span>
                    <span className="sm:hidden">Upgrade →</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Progress Widget */}
        {onboardingProgress < 100 && (
          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-[hsl(var(--tenant-text))]">
                  📊 Setup Progress: {Math.round(onboardingProgress)}% Complete
                </CardTitle>
                <Badge variant="outline">{completedSteps}/{onboardingSteps.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {(usage.products || 0) > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="text-sm text-[hsl(var(--tenant-text))]">
                    Products Added {(usage.products || 0) > 0 ? `(${usage.products})` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(usage.customers || 0) > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="text-sm text-[hsl(var(--tenant-text))]">
                    Customers Added {(usage.customers || 0) > 0 ? `(${usage.customers})` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(usage.menus || 0) > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="text-sm text-[hsl(var(--tenant-text))]">
                    Menu Created {(usage.menus || 0) > 0 ? `(${usage.menus})` : ""}
                  </span>
                  {onboardingProgress < 100 && (
                <Button
                  variant="link"
                  size="sm"
                  className="ml-auto min-h-[44px] text-xs sm:text-sm"
                  onClick={() => {
                    if ((usage.menus || 0) === 0) {
                      navigate(`/${tenant?.slug}/admin/disposable-menus`);
                    }
                  }}
                >
                  {onboardingProgress < 100 ? (
                    <>
                      <span className="hidden sm:inline">Let's finish this! →</span>
                      <span className="sm:hidden">Finish →</span>
                    </>
                  ) : ""}
                </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usage Limit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text))]">📦 Products</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--tenant-primary))]/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-[hsl(var(--tenant-primary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[hsl(var(--tenant-text))]">
                {usage.products || 0}/{limits.products || 100}
              </div>
              <Progress 
                value={((usage.products || 0) / (limits.products || 100)) * 100} 
                className="mt-2 h-2"
              />
              {((usage.products || 0) / (limits.products || 100)) * 100 >= 80 && (
                <p className="text-sm text-yellow-600 mt-2">
                  ⚠️ You're at {Math.round(((usage.products || 0) / (limits.products || 100)) * 100)}% capacity. Upgrade to add more.
                </p>
              )}
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
              <div className="text-3xl font-bold text-[hsl(var(--tenant-text))]">
                {usage.customers || 0}/{limits.customers || 50}
              </div>
              <Progress 
                value={((usage.customers || 0) / (limits.customers || 50)) * 100} 
                className="mt-2 h-2"
              />
              {((usage.customers || 0) / (limits.customers || 50)) * 100 >= 80 && (
                <p className="text-sm text-yellow-600 mt-2">
                  ⚠️ You're at {Math.round(((usage.customers || 0) / (limits.customers || 50)) * 100)}% capacity. Upgrade to add more.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text))]">📱 Menus</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--tenant-secondary))]/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-[hsl(var(--tenant-secondary))]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[hsl(var(--tenant-text))]">
                {usage.menus || 0}/{limits.menus || 3}
              </div>
              <Progress 
                value={((usage.menus || 0) / (limits.menus || 3)) * 100} 
                className="mt-2 h-2"
              />
              {((usage.menus || 0) / (limits.menus || 3)) * 100 >= 80 && (
                <p className="text-sm text-yellow-600 mt-2">
                  ⚠️ You're at {Math.round(((usage.menus || 0) / (limits.menus || 3)) * 100)}% capacity. Upgrade to add more.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--tenant-text))]">💰 Revenue</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[hsl(var(--tenant-text))]">
                {formatCurrency(revenueData?.total || 0)}
              </div>
              <p className="text-sm text-[hsl(var(--tenant-text-light))] mt-1">
                Platform fee: {formatCurrency(revenueData?.commission || 0)} (2%)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--tenant-text))]">🚀 Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <LimitGuard resource="products">
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] sm:min-h-[56px] h-auto py-3 sm:py-4 flex flex-col items-center gap-2 touch-manipulation"
                  onClick={() => navigate(`/${tenant?.slug}/admin/inventory/products`)}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-sm sm:text-base">Add Products</span>
                </Button>
              </LimitGuard>
              <LimitGuard resource="customers">
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] sm:min-h-[56px] h-auto py-3 sm:py-4 flex flex-col items-center gap-2 touch-manipulation"
                  onClick={() => navigate(`/${tenant?.slug}/admin/customers`)}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-sm sm:text-base">Add Customer</span>
                </Button>
              </LimitGuard>
              <LimitGuard resource="menus">
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] sm:min-h-[56px] h-auto py-3 sm:py-4 flex flex-col items-center gap-2 touch-manipulation"
                  onClick={() => navigate(`/${tenant?.slug}/admin/disposable-menus`)}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-sm sm:text-base">Create Menu</span>
                </Button>
              </LimitGuard>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="bg-white border-[hsl(var(--tenant-border))] shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[hsl(var(--tenant-text))]">📋 Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 border border-[hsl(var(--tenant-border))] rounded-lg hover:bg-[hsl(var(--tenant-surface))] transition-colors"
                  >
                    <div className="mt-0.5">
                      {activity.type === "order_placed" ? (
                        <ShoppingCart className="h-4 w-4 text-green-600" />
                      ) : activity.type === "menu_created" ? (
                        <Smartphone className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Activity className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[hsl(var(--tenant-text))]">
                        • {activity.message}
                      </p>
                      <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-[hsl(var(--tenant-text-light))] mb-4" />
                <p className="text-[hsl(var(--tenant-text-light))]">No recent activity</p>
                <p className="text-xs text-[hsl(var(--tenant-text-light))] mt-2">
                  Activity will appear here as you use the platform
                </p>
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

      {/* Onboarding Completion Modal */}
      {isComplete && (
        <OnboardingCompletionModal
          open={showCompletionModal}
          onOpenChange={setShowCompletionModal}
          tenantSlug={tenant?.slug}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}

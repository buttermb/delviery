import { useState, useEffect, useMemo, useCallback, memo } from "react";
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
import { useTenantLimits } from "@/hooks/useTenantLimits";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { logger } from "@/utils/logger";
import { TakeTourButton } from "@/components/tutorial/TakeTourButton";
import { dashboardTutorial } from "@/lib/tutorials/tutorialConfig";

export default function TenantAdminDashboardPage() {
  const navigate = useNavigate();
  const { admin, tenant, logout, loading: authLoading } = useTenantAdminAuth();
  const { getLimit, getCurrent } = useTenantLimits();
  const tenantId = tenant?.id;
  
  // Defensive check: if auth loading takes >15s, show error
  useEffect(() => {
    if (authLoading) {
      const loadingTimeout = setTimeout(() => {
        if (authLoading) {
          logger.warn('Auth loading timeout (>15s) in DashboardPage', undefined, 'DashboardPage');
        }
      }, 15000);
      
      return () => clearTimeout(loadingTimeout);
    }
  }, [authLoading, tenantId, tenant]);
  
  // Early return if auth loading takes too long
  if (authLoading) {
    // Show loading fallback, but with timeout protection
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Enable real-time sync for dashboard data
  useRealtimeSync({
    tenantId,
    tables: ['wholesale_orders', 'wholesale_inventory', 'disposable_menus', 'customers'],
    enabled: !!tenantId,
  });

  // Memoized helper functions for handling unlimited limits
  const isUnlimited = useCallback((resource: 'customers' | 'menus' | 'products') => {
    const limit = getLimit(resource);
    return limit === Infinity;
  }, [getLimit]);

  const getDisplayLimit = useCallback((resource: 'customers' | 'menus' | 'products') => {
    return isUnlimited(resource) ? '∞' : getLimit(resource);
  }, [isUnlimited, getLimit]);

  const getUsagePercentage = useCallback((resource: 'customers' | 'menus' | 'products') => {
    if (isUnlimited(resource)) return 0;
    const current = getCurrent(resource);
    const limit = getLimit(resource);
    return limit > 0 ? (current / limit) * 100 : 0;
  }, [isUnlimited, getCurrent, getLimit]);

  // Fetch today's metrics
  const { data: todayMetrics } = useQuery({
    queryKey: ["tenant-dashboard-today", tenantId],
    queryFn: async (): Promise<any> => {
      if (!tenantId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      try {
        // Get today's orders with error handling - handle missing tenant_id gracefully
        interface OrderRow {
          total_amount: number | null;
          status: string;
        }
        
        // Try with tenant_id filter first
        // @ts-ignore - Supabase complex query types cause TS2589
        let ordersResult: any = await supabase.from("wholesale_orders").select("total_amount, status").eq("tenant_id", tenantId).gte("created_at", today.toISOString());
        
        // Check if error is 400 (bad request) - likely means tenant_id column doesn't exist
        if (ordersResult.error && (ordersResult.error.code === '42703' || ordersResult.error.message?.includes('column'))) {
          logger.warn("tenant_id column may not exist in wholesale_orders, querying without filter", ordersResult.error, 'DashboardPage');
          // Retry without tenant_id filter
          ordersResult = await supabase
            .from("wholesale_orders")
            .select("total_amount, status")
            .gte("created_at", today.toISOString())
            .limit(100)
            .returns<OrderRow[]>();
        }
        
        const orders = ordersResult.error ? [] : (ordersResult.data || []);
        
        if (ordersResult.error && orders.length === 0) {
          logger.warn("Failed to fetch today's orders", ordersResult.error, 'DashboardPage');
        }

        const sales = (orders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
        const orderCount = orders?.length || 0;

        // Get low stock items with error handling - handle missing tenant_id gracefully
        interface InventoryRow {
          id: string;
          product_name: string | null;
          quantity_lbs: number | null;
          reorder_point: number | null;
        }
        
        // Try with tenant_id filter first
        // @ts-ignore - Supabase complex query types cause TS2589
        let inventoryResult: any = await supabase.from("wholesale_inventory").select("id, product_name, quantity_lbs, reorder_point").eq("tenant_id", tenantId);
        
        // Check if error is 400 (bad request) - likely means tenant_id column doesn't exist
        if (inventoryResult.error && (inventoryResult.error.code === '42703' || inventoryResult.error.message?.includes('column'))) {
          logger.warn("tenant_id column may not exist in wholesale_inventory, querying without filter", inventoryResult.error, 'DashboardPage');
          // Retry without tenant_id filter
          inventoryResult = await supabase
            .from("wholesale_inventory")
            .select("id, product_name, quantity_lbs, reorder_point")
            .limit(100)
            .returns<InventoryRow[]>();
        }
        
        const inventory = inventoryResult.error ? [] : (inventoryResult.data || []);
        
        if (inventoryResult.error && inventory.length === 0) {
          logger.warn("Failed to fetch inventory", inventoryResult.error, 'DashboardPage');
        }

        const lowStock = (inventory as InventoryRow[] || []).map((item) => ({
          id: item.id,
          strain: item.product_name || 'Unknown',
          product_name: item.product_name,
          quantity_lbs: item.quantity_lbs ?? 0,
          reorder_point: item.reorder_point ?? 10,
        })).filter(
          (item: any) => Number(item.quantity_lbs || 0) <= Number(item.reorder_point || 10)
        );

        return {
          sales,
          orderCount,
          lowStock: lowStock.slice(0, 5),
        };
      } catch (error) {
        logger.error("Error fetching dashboard metrics", error as Error, 'DashboardPage');
        // Return safe defaults instead of throwing
        return {
          sales: 0,
          orderCount: 0,
          lowStock: [],
        };
      }
    },
    enabled: !!tenantId,
    retry: 1, // Only retry once
    retryDelay: 1000,
  });

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(`/${tenant?.slug}/admin/login`);
  }, [logout, navigate, tenant?.slug]);

  // Memoize trial calculations
  const trialInfo = useMemo(() => {
    const trialEndsAt = (tenant as any)?.trial_ends_at;
    const trialDaysRemaining = trialEndsAt
      ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    const trialEndingSoon = trialDaysRemaining !== null && trialDaysRemaining <= 10 && trialDaysRemaining > 0;
    
    return { trialDaysRemaining, trialEndingSoon };
  }, [(tenant as any)?.trial_ends_at]);

  // Memoize usage and limits
  const tenantUsage = useMemo(() => (tenant as any)?.usage || {}, [tenant]);
  const tenantLimits = useMemo(() => (tenant as any)?.limits || {}, [tenant]);

  // Memoize onboarding progress
  const onboardingSteps = useMemo(() => [
    { id: "products", completed: (tenantUsage.products || 0) > 0 },
    { id: "customers", completed: (tenantUsage.customers || 0) > 0 },
    { id: "menu", completed: (tenantUsage.menus || 0) > 0 },
  ], [tenantUsage.products, tenantUsage.customers, tenantUsage.menus]);
  // Fetch recent activity (menu views, orders, menu creations)
  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity", tenantId],
    queryFn: async (): Promise<any[]> => {
      if (!tenantId) return [];

      const activities: any[] = [];

      try {
        // Get tenant's menus first to filter activity - handle missing tenant_id gracefully
        // @ts-ignore - Supabase type inference issue
        let menusResult = await supabase
          .from("disposable_menus")
          .select("id, name, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(100);

        // Check if error is 400 (bad request) - likely means tenant_id column doesn't exist
        if (menusResult.error && (menusResult.error.code === '42703' || menusResult.error.message?.includes('column'))) {
          logger.warn("tenant_id column may not exist in disposable_menus, querying without filter", menusResult.error, 'DashboardPage');
          // Retry without tenant_id filter
          menusResult = await supabase
            .from("disposable_menus")
            .select("id, name, created_at")
            .order("created_at", { ascending: false })
            .limit(100);
        }

        if (menusResult.error) {
          logger.warn("Failed to fetch tenant menus", menusResult.error, 'DashboardPage');
          return []; // Return empty array instead of throwing
        }

        const tenantMenus = menusResult.data;

        if (!tenantMenus || tenantMenus.length === 0) return [];

        const menuIds = tenantMenus.map((m) => m.id);

        // Get recent menu views (from menu_access_logs via menus)
        const { data: menuLogs, error: logsError } = await supabase
          .from("menu_access_logs")
          .select("menu_id, accessed_at, actions_taken, disposable_menus(name)")
          .in("menu_id", menuIds)
          .order("accessed_at", { ascending: false })
          .limit(5);

        if (!logsError && menuLogs) {
          menuLogs.forEach((log: any) => {
            activities.push({
              type: "menu_view",
              message: `Customer viewed menu "${log.disposable_menus?.name || "Unknown"}"`,
              timestamp: log.accessed_at,
            });
          });
        }

        // Get recent orders (via menu_id)
        const { data: orders, error: ordersError } = await supabase
          .from("menu_orders")
          .select("id, total_amount, created_at, disposable_menus(name)")
          .in("menu_id", menuIds)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!ordersError && orders) {
          orders.forEach((order: any) => {
            activities.push({
              type: "order_placed",
              message: `Order #${order.id.slice(0, 8)} placed - ${formatCurrency(order.total_amount || 0)}`,
              timestamp: order.created_at,
            });
          });
        }

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
      } catch (error) {
        logger.error("Error fetching recent activity", error as Error, 'DashboardPage');
        return []; // Return empty array on error
      }
    },
    enabled: !!tenantId,
    retry: 1,
    retryDelay: 1000,
  });

  // Calculate revenue and commission from actual transaction data
  const { data: revenueData } = useQuery({
    queryKey: ["revenue-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return { total: 0, commission: 0 };

      try {
        // Get tenant's menus first - handle missing tenant_id column gracefully
        let tenantMenus: { id: string }[] | null = null;
        
        // Try with tenant_id filter first
        let result = await supabase
          .from("disposable_menus")
          .select("id")
          .eq("tenant_id", tenantId);
        
        // Check if error is 400 (bad request) - likely means tenant_id column doesn't exist
        if (result.error && (result.error.code === '42703' || result.error.message?.includes('column'))) {
          logger.warn("tenant_id column may not exist in disposable_menus, querying without filter", result.error, 'DashboardPage');
          // Retry without tenant_id filter
          result = await supabase
            .from("disposable_menus")
            .select("id")
            .limit(100); // Limit to prevent loading too much
        }
        
        // If still has error, return defaults
        if (result.error) {
          logger.warn("Failed to fetch menus for revenue stats", result.error, 'DashboardPage');
          return { total: 0, commission: 0 };
        }
        
        tenantMenus = result.data;

        if (!tenantMenus || tenantMenus.length === 0) return { total: 0, commission: 0 };

        const menuIds = tenantMenus.map((m) => m.id);

        // Get confirmed orders from these menus for total revenue
        const { data: orders, error: ordersError } = await supabase
          .from("menu_orders")
          .select("total_amount")
          .in("menu_id", menuIds)
          .eq("status", "confirmed") as { data: { total_amount: number }[] | null; error: unknown | null };

        if (ordersError) {
          logger.warn("Failed to fetch orders for revenue stats", ordersError, 'DashboardPage');
          return { total: 0, commission: 0 };
        }

        const total = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;

      // Get actual commission transactions (more accurate than calculating)
      // Handle gracefully if table doesn't exist yet
      let commission = 0;
      try {
        const { data: commissions, error: commissionError } = await supabase
          .from("commission_transactions")
          .select("commission_amount, customer_payment_amount")
          .eq("tenant_id", tenantId)
          .in("status", ["pending", "processed", "paid"]);

        // If table doesn't exist (error code 42P01), use fallback calculation
        if (commissionError && commissionError.code === "42P01") {
          // Table doesn't exist - calculate 2% commission manually as fallback
          commission = total * 0.02;
        } else if (commissions) {
          commission = commissions.reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
        }
      } catch (error) {
        // Table doesn't exist - calculate 2% commission manually as fallback
        commission = total * 0.02;
      }

      return { total, commission };
      } catch (error) {
        logger.error("Error fetching revenue stats", error as Error, 'DashboardPage');
        return { total: 0, commission: 0 };
      }
    },
    enabled: !!tenantId,
    retry: 1,
    retryDelay: 1000,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50 shadow-sm safe-area-top">
        <div className="container mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl md:text-2xl font-bold text-foreground truncate">
              🎛️ {tenant?.business_name || "Dashboard"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Admin Panel</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 flex-shrink-0 w-full sm:w-auto justify-end sm:justify-start">
            <TakeTourButton
              tutorialId={dashboardTutorial.id}
              steps={dashboardTutorial.steps}
              variant="outline"
              size="sm"
            />
            {admin && (
              <div className="text-xs sm:text-sm text-muted-foreground hidden md:block truncate max-w-[120px]">
                {admin.email}
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              asChild 
              className="min-h-[44px] px-2 sm:px-3 touch-manipulation"
              data-tutorial="settings-access"
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
              className="min-h-[44px] px-2 sm:px-3 touch-manipulation"
            >
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-2 sm:p-3 md:p-4 lg:p-6 space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-6">
        {/* Trial Countdown Banner */}
        {tenant?.subscription_status === "trial" && trialInfo.trialDaysRemaining !== null && (
          <Card className={`border-2 ${
            trialInfo.trialDaysRemaining <= 3 
              ? "border-red-400 bg-red-50" 
              : trialInfo.trialDaysRemaining <= 10 
              ? "border-yellow-400 bg-yellow-50" 
              : "border-blue-400 bg-blue-50"
          }`}>
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 sm:mt-0 ${
                    trialInfo.trialDaysRemaining <= 3 ? "text-red-600" : trialInfo.trialDaysRemaining <= 10 ? "text-yellow-600" : "text-blue-600"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold text-sm sm:text-base ${
                      trialInfo.trialDaysRemaining <= 3 ? "text-red-900" : trialInfo.trialDaysRemaining <= 10 ? "text-yellow-900" : "text-blue-900"
                    }`}>
                      {trialInfo.trialDaysRemaining <= 0 
                        ? "⚠️ Trial Expired" 
                        : trialInfo.trialDaysRemaining <= 3 
                        ? "⚠️ Trial Ending in " + trialInfo.trialDaysRemaining + " days"
                        : "⏰ Trial Ending in " + trialInfo.trialDaysRemaining + " days"}
                    </p>
                    <p className={`text-xs sm:text-sm ${
                      trialInfo.trialDaysRemaining <= 3 ? "text-red-700" : trialInfo.trialDaysRemaining <= 10 ? "text-yellow-700" : "text-blue-700"
                    }`}>
                      {trialInfo.trialDaysRemaining <= 0 
                        ? "Upgrade to continue using the platform"
                        : "Upgrade now to keep your data and continue using all features"}
                    </p>
                  </div>
                </div>
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap min-h-[44px] px-3 sm:px-4 text-sm sm:text-base touch-manipulation w-full sm:w-auto flex-shrink-0"
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

        {/* Setup Progress Widget - Disabled until database columns are added
            TODO: Add onboarding_completed, usage, limits columns to tenants table
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
        )} */}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">⚡ Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3 sm:p-4 md:p-6 pt-0">
              <Button variant="outline" className="w-full justify-start min-h-[44px] touch-manipulation" asChild>
                <Link to={`/${tenant?.slug}/admin/inventory/products`}>
                  <Package className="h-4 w-4 mr-2" />
                  <span className="text-sm sm:text-base">Add Product</span>
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start min-h-[44px] touch-manipulation" asChild>
                <Link to={`/${tenant?.slug}/admin/disposable-menus`}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  <span className="text-sm sm:text-base">Create Menu</span>
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start min-h-[44px] touch-manipulation" asChild>
                <Link to={`/${tenant?.slug}/admin/big-plug-clients`}>
                  <Users className="h-4 w-4 mr-2" />
                  <span className="text-sm sm:text-base">Add Customer</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Usage Limit Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4" data-tutorial="dashboard-stats">
          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
            onClick={() => navigate(`/${tenant?.slug}/admin/inventory/products`)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 md:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">📦 Products</CardTitle>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-2xl sm:text-3xl font-bold">
                {tenantUsage.products || 0}/{getDisplayLimit('products')}
              </div>
              {!isUnlimited('products') && (
                <>
                  <Progress 
                    value={getUsagePercentage('products')} 
                    className="mt-2 h-1.5 sm:h-2"
                  />
                  {getUsagePercentage('products') >= 80 && (
                    <p className="text-xs sm:text-sm text-yellow-600 mt-2">
                      ⚠️ You're at {Math.round(getUsagePercentage('products'))}% capacity. 
                      Upgrade to {tenant?.subscription_plan === 'starter' ? 'Professional' : 'Enterprise'} for unlimited products.
                    </p>
                  )}
                </>
              )}
              {isUnlimited('products') && (
                <p className="text-xs sm:text-sm text-green-600 mt-2">
                  ✓ Unlimited products on {tenant?.subscription_plan || 'your'} plan
                </p>
              )}
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
            onClick={() => navigate(`/${tenant?.slug}/admin/big-plug-clients`)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 md:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">👥 Customers</CardTitle>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-2xl sm:text-3xl font-bold">
                {tenantUsage.customers || 0}/{getDisplayLimit('customers')}
              </div>
              {!isUnlimited('customers') && (
                <>
                  <Progress 
                    value={getUsagePercentage('customers')} 
                    className="mt-2 h-1.5 sm:h-2"
                  />
                  {getUsagePercentage('customers') >= 80 && (
                    <p className="text-xs sm:text-sm text-yellow-600 mt-2">
                      ⚠️ You're at {Math.round(getUsagePercentage('customers'))}% capacity. 
                      Upgrade to {tenant?.subscription_plan === 'starter' ? 'Professional' : 'Enterprise'} for unlimited customers.
                    </p>
                  )}
                </>
              )}
              {isUnlimited('customers') && (
                <p className="text-xs sm:text-sm text-green-600 mt-2">
                  ✓ Unlimited customers on {tenant?.subscription_plan || 'your'} plan
                </p>
              )}
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
            onClick={() => navigate(`/${tenant?.slug}/admin/disposable-menus`)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 md:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">📱 Menus</CardTitle>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-[hsl(var(--tenant-text))]">
                {tenantUsage.menus || 0}/{getDisplayLimit('menus')}
              </div>
              {!isUnlimited('menus') && (
                <>
                  <Progress 
                    value={getUsagePercentage('menus')} 
                    className="mt-2 h-1.5 sm:h-2"
                  />
                  {getUsagePercentage('menus') >= 80 && (
                    <p className="text-xs sm:text-sm text-yellow-600 mt-2">
                      ⚠️ You're at {Math.round(getUsagePercentage('menus'))}% capacity. 
                      Upgrade to Professional for unlimited menus.
                    </p>
                  )}
                </>
              )}
              {isUnlimited('menus') && (
                <p className="text-xs sm:text-sm text-green-600 mt-2">
                  ✓ Unlimited menus on {tenant?.subscription_plan || 'your'} plan
                </p>
              )}
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-md transition-shadow cursor-pointer hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
            onClick={() => navigate(`/${tenant?.slug}/admin/financial-center`)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 md:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">💰 Revenue</CardTitle>
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-[hsl(var(--tenant-text))]">
                {formatCurrency(revenueData?.total || 0)}
              </div>
              <p className="text-xs sm:text-sm text-[hsl(var(--tenant-text-light))] mt-1">
                Platform fee: {formatCurrency(revenueData?.commission || 0)} (2%)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card data-tutorial="quick-actions">
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="text-sm sm:text-base md:text-lg">🚀 Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
        <Card data-tutorial="activity-feed">
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base md:text-lg">📋 Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {recentActivity.map((activity: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 border border-[hsl(var(--tenant-border))] rounded-lg hover:bg-[hsl(var(--tenant-surface))] transition-colors"
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
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-[hsl(var(--tenant-text))] break-words">
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
              <div className="text-center py-6 sm:py-8">
                <Activity className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Activity will appear here as you use the platform
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        {todayMetrics?.lowStock && todayMetrics.lowStock.length > 0 && (
          <Card className="border-yellow-300 border-2" data-tutorial="low-stock-alerts">
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="space-y-2 sm:space-y-3">
                {todayMetrics.lowStock.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 sm:p-3 md:p-4 border border-yellow-200 rounded-lg bg-yellow-50 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm text-[hsl(var(--tenant-text))] truncate">{item.strain || item.product_name || 'Unknown'}</p>
                      <p className="text-xs text-[hsl(var(--tenant-text-light))]">
                        {Number(item.weight_lbs || 0).toFixed(2)} lbs remaining
                      </p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs flex-shrink-0">Low Stock</Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-3 sm:mt-4 min-h-[44px] touch-manipulation" asChild>
                <Link to={`/${tenant?.slug}/admin/inventory`}>
                  <span className="text-sm sm:text-base">Manage Inventory</span> <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

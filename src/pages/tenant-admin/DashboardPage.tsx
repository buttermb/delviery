// Dashboard Page - TypeScript enabled
import { logger } from '@/lib/logger';
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  Settings,
  Users,
  Activity,
  Zap,
  Smartphone,
  Plus,
  CheckCircle2,
  Circle,
  Coins,
  Sparkles,
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { CreditBalance } from "@/components/credits/CreditBalance";
import { CreditPurchaseCelebration } from "@/components/credits/CreditPurchaseCelebration";
import { FREE_TIER_MONTHLY_CREDITS } from "@/lib/credits";
import { useSearchParams } from "react-router-dom";
import { UnifiedAnalyticsDashboard } from "@/components/analytics/UnifiedAnalyticsDashboard";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Link } from "react-router-dom";
import { LimitGuard } from "@/components/whitelabel/LimitGuard";
import { useTenantLimits } from "@/hooks/useTenantLimits";
import { useFreeTierLimits } from "@/hooks/useFreeTierLimits";
import { FREE_TIER_LIMITS } from "@/lib/credits";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { TakeTourButton } from "@/components/tutorial/TakeTourButton";
import { dashboardTutorial } from "@/lib/tutorials/tutorialConfig";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { DataSetupBanner } from "@/components/admin/DataSetupBanner";
import { QuickStartWizard } from "@/components/onboarding/QuickStartWizard";
import { toast } from "sonner";
import { formatSmartDate } from "@/lib/formatters";
import { handleError } from "@/utils/errorHandling/handlers";
import { queryKeys } from "@/lib/queryKeys";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TrialExpirationBanner } from '@/components/billing/TrialExpirationBanner';
import { DashboardWidgetGrid } from '@/components/tenant-admin/DashboardWidgetGrid';
import { SmartNotificationsCenter } from '@/components/tenant-admin/SmartNotificationsCenter';
import { TrialWelcomeModal } from '@/components/onboarding/TrialWelcomeModal';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { QuickActionsWidget } from '@/components/dashboard/QuickActionsWidget';
import { DashboardQuickActionsPanel } from '@/components/dashboard/DashboardQuickActionsPanel';

interface DashboardInventoryRow {
  id: string;
  name: string | null;
  stock_quantity: number | null;
  available_quantity: number | null;
  low_stock_alert: number | null;
}

interface LowStockItem {
  id: string;
  strain: string;
  product_name: string | null;
  quantity_lbs: number;
  reorder_point: number;
  weight_lbs: number;
}

export default function TenantAdminDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, tenant, logout, loading: authLoading } = useTenantAdminAuth();
  const { getLimit, getCurrent } = useTenantLimits();
  const { usage, hasPurchasedCredits, hasActiveCredits, limitsApply } = useFreeTierLimits();
  const tenantId = tenant?.id;
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [isEmptyAccount, setIsEmptyAccount] = useState(false);

  // Calculate trial expiration info
  const trialEndsAt = tenant?.trial_ends_at;
  const trialDaysRemaining = trialEndsAt
    ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const hasPaymentMethod = tenant?.payment_method_added === true;
  const isTrialActive = tenant?.subscription_status === 'trial';

  // Credit system for free tier users
  const {
    balance: creditBalance,
    isFreeTier,
    isLowCredits,
    isCriticalCredits,
    isOutOfCredits,
    nextFreeGrantAt,
    lifetimeSpent,
  } = useCredits();

  const [generatingDemoData, setGeneratingDemoData] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Credit purchase celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationCredits, setCelebrationCredits] = useState(0);

  // Handle credits_purchased URL parameter
  useEffect(() => {
    if (searchParams.get('credits_purchased') === 'true') {
      // Show celebration modal
      setShowCelebration(true);
      setCelebrationCredits(creditBalance); // Use current balance as approximate

      // Clean up URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('credits_purchased');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, creditBalance, setSearchParams]);

  // Enable real-time sync for dashboard data (MOVED BEFORE EARLY RETURN)
  useRealtimeSync({
    tenantId,
    tables: ['wholesale_orders', 'products', 'disposable_menus', 'customers'],
    enabled: !!tenantId,
  });

  // Memoized helper functions for handling unlimited limits (MOVED BEFORE EARLY RETURN)
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

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(`/${tenant?.slug}/admin/login`);
  }, [logout, navigate, tenant?.slug]);

  // Fetch today's metrics (MOVED BEFORE EARLY RETURN)
  const { data: todayMetrics } = useQuery({
    queryKey: queryKeys.tenantDashboardExt.today(tenantId),
    queryFn: async () => {
      if (!tenantId) return { sales: 0, orderCount: 0, lowStock: [] };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      try {
        // Aggregate orders from all sources with tenant isolation
        const [wholesaleResult, menuResult, ordersResult] = await Promise.allSettled([
          supabase
            .from("wholesale_orders")
            .select("total_amount, status")
            .eq("tenant_id", tenantId)
            .gte("created_at", today.toISOString()),
          // Filter menu_orders by tenant's menus for proper isolation
          (async () => {
            // First get tenant's menu IDs
            const { data: tenantMenus } = await supabase
              .from("disposable_menus")
              .select("id")
              .eq("tenant_id", tenantId);

            if (!tenantMenus?.length) return { data: [], error: null };

            const menuIds = tenantMenus.map(m => m.id);
            return supabase
              .from("menu_orders")
              .select("total_amount, status, menu_id")
              .in("menu_id", menuIds)
              .gte("created_at", today.toISOString());
          })(),
          supabase
            .from("orders")
            .select("total_amount, status")
            .eq("tenant_id", tenantId)
            .gte("created_at", today.toISOString()),
        ]);

        // Safely extract data from settled promises
        const wholesaleOrders = wholesaleResult.status === 'fulfilled' && !wholesaleResult.value.error
          ? wholesaleResult.value.data ?? [] : [];
        const menuOrders = menuResult.status === 'fulfilled' && !menuResult.value.error
          ? menuResult.value.data ?? [] : [];
        const generalOrders = ordersResult.status === 'fulfilled' && !ordersResult.value.error
          ? ordersResult.value.data ?? [] : [];

        // Combine all orders
        const allOrders = [...wholesaleOrders, ...menuOrders, ...generalOrders];

        const sales = allOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const orderCount = allOrders.length;

        // Get low stock items from products table (including low_stock_alert field)
        let inventoryResult: { data: Record<string, unknown>[] | null; error: { code?: string; message?: string } | null } = await (supabase
          .from("products")
          .select("id, name, stock_quantity, available_quantity, low_stock_alert")
          .eq("tenant_id", tenantId) as unknown as Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message?: string } | null }>);

        // Fallback without tenant filter if column doesn't exist
        if (inventoryResult.error && (inventoryResult.error.code === '42703' || inventoryResult.error.message?.includes('column'))) {
          logger.warn("tenant_id filter failed for products, retrying without filter", inventoryResult.error, { component: 'DashboardPage' });
          inventoryResult = await (supabase
            .from("products")
            .select("id, name, stock_quantity, available_quantity, low_stock_alert")
            .limit(100) as unknown as Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message?: string } | null }>);
        }

        const inventory = inventoryResult.error ? [] : (inventoryResult.data ?? []);

        if (inventoryResult.error && inventory.length === 0) {
          logger.warn("Failed to fetch inventory", inventoryResult.error, { component: 'DashboardPage' });
        }

        const DEFAULT_LOW_STOCK_THRESHOLD = 10;
        const lowStock = (inventory as unknown as DashboardInventoryRow[] ?? []).map((item) => {
          // Use product's low_stock_alert if set, otherwise use default threshold
          const threshold = item.low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD;
          const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
          return {
            id: item.id,
            strain: item.name || 'Unknown',
            product_name: item.name,
            quantity_lbs: currentQty,
            reorder_point: threshold,
            weight_lbs: currentQty, // For display consistency
          };
        }).filter(
          (item) => Number(item.quantity_lbs ?? 0) <= item.reorder_point
        );

        return {
          sales,
          orderCount,
          lowStock: lowStock.slice(0, 5),
        };
      } catch (error) {
        logger.error('Error fetching dashboard data', error, { component: 'DashboardPage' });
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

  // Fetch recent activity (MOVED BEFORE EARLY RETURN)
  const { data: recentActivity } = useQuery({
    queryKey: queryKeys.tenantDashboardExt.recentActivity(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      interface ActivityItem {
        type: "menu_view" | "order_placed" | "menu_created";
        message: string;
        timestamp: string;
      }

      const activities: ActivityItem[] = [];

      try {
        // Get tenant's menus first to filter activity - handle missing tenant_id gracefully
        let menusResult = await supabase
          .from("disposable_menus")
          .select("id, name, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(100);

        // Check if error is 400 (bad request) - likely means tenant_id column doesn't exist
        if (menusResult.error && (menusResult.error.code === '42703' || menusResult.error.message?.includes('column'))) {
          logger.warn("tenant_id column may not exist in disposable_menus, querying without filter", menusResult.error, { component: 'DashboardPage' });
          // Retry without tenant_id filter
          menusResult = await supabase
            .from("disposable_menus")
            .select("id, name, created_at")
            .order("created_at", { ascending: false })
            .limit(100);
        }

        if (menusResult.error) {
          logger.warn("Failed to fetch tenant menus", menusResult.error, { component: 'DashboardPage' });
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

        if (logsError) {
          logger.warn('Failed to fetch menu access logs', { component: 'DashboardPage', error: logsError });
        }

        if (!logsError && menuLogs) {
          menuLogs.forEach((log) => {
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

        if (ordersError) {
          logger.warn('Failed to fetch menu orders', { component: 'DashboardPage', error: ordersError });
        }

        if (!ordersError && orders) {
          orders.forEach((order) => {
            activities.push({
              type: "order_placed",
              message: `Order #${order.id.slice(0, 8)} placed - ${formatCurrency(order.total_amount ?? 0)}`,
              timestamp: order.created_at,
            });
          });
        }

        // Get recent menu creations (most recent 5)
        tenantMenus.slice(0, 5).forEach((menu) => {
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
        logger.error('Error fetching recent activity', error, { component: 'DashboardPage' });
        return []; // Return empty array on error
      }
    },
    enabled: !!tenantId,
    retry: 1,
    retryDelay: 1000,
  });

  // Calculate revenue and commission from actual transaction data (MOVED BEFORE EARLY RETURN)
  useQuery({
    queryKey: queryKeys.tenantDashboardExt.revenueStats(tenantId),
    queryFn: async () => {
      if (!tenantId) return { total: 0, commission: 0 };

      try {
        // Get tenant's menus first - handle missing tenant_id column gracefully
        let tenantMenus: { id: string }[] | null = null;

        let menusResult = await supabase
          .from("disposable_menus")
          .select("id")
          .eq("tenant_id", tenantId);

        // Check if error is 400 (bad request) - likely means tenant_id column doesn't exist
        if (menusResult.error && (menusResult.error.code === '42703' || menusResult.error.message?.includes('column'))) {
          logger.warn("tenant_id column may not exist in disposable_menus, querying without filter", menusResult.error, { component: 'DashboardPage' });
          // Retry without tenant_id filter
          menusResult = await supabase
            .from("disposable_menus")
            .select("id")
            .limit(1000);
        }

        if (menusResult.error) {
          logger.warn("Failed to fetch tenant menus for revenue", menusResult.error, { component: 'DashboardPage' });
          return { total: 0, commission: 0 };
        }

        tenantMenus = menusResult.data;

        if (!tenantMenus || tenantMenus.length === 0) {
          return { total: 0, commission: 0 };
        }

        const menuIds = tenantMenus.map((m) => m.id);

        // Get all orders for these menus
        const { data: orders, error: ordersError } = await supabase
          .from("menu_orders")
          .select("total_amount")
          .in("menu_id", menuIds);

        if (ordersError) {
          logger.warn("Failed to fetch orders for revenue calculation", ordersError, { component: 'DashboardPage' });
          return { total: 0, commission: 0 };
        }

        const total = (orders ?? []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        const commission = total * 0.03; // 3% commission

        return { total, commission };
      } catch (error) {
        logger.error('Error calculating revenue', error, { component: 'DashboardPage' });
        return { total: 0, commission: 0 };
      }
    },
    enabled: !!tenantId,
    retry: 1,
    retryDelay: 1000,
  });

  // Check if user came from signup (with safeguard against multiple calls)
  useEffect(() => {
    const state = location.state as { fromSignup?: boolean; showWelcome?: boolean } | null;
    if (state?.fromSignup || state?.showWelcome) {
      // Small delay to ensure dashboard is loaded
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        // Clear state to prevent showing again on refresh (only once)
        try {
          window.history.replaceState({}, document.title);
        } catch (error) {
          logger.error('Failed to clear history state', error, { component: 'DashboardPage' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally using pathname only; location.state change should not re-trigger (we're clearing it)
  }, [location.pathname]);

  // Auto-show Quick Start for completely empty accounts (new users)
  useEffect(() => {
    if (!tenantId || authLoading) return;

    const checkIfEmpty = async () => {
      try {
        // Check if account has ANY data (must filter by tenant_id)
        const { data: clients } = await supabase
          .from("wholesale_clients")
          .select("id")
          .eq("tenant_id", tenantId)
          .limit(1);

        const { data: products } = await supabase
          .from("products")
          .select("id")
          .eq("tenant_id", tenantId)
          .limit(1);

        const { data: menus } = await supabase
          .from("disposable_menus")
          .select("id")
          .eq("tenant_id", tenantId)
          .limit(1);

        const isEmpty = (!clients || clients.length === 0) &&
          (!products || products.length === 0) &&
          (!menus || menus.length === 0);

        setIsEmptyAccount(isEmpty);

        // If completely empty AND onboarding not completed, show quick start
        const onboardingCompleted = localStorage.getItem(`${STORAGE_KEYS.ONBOARDING_COMPLETED_PREFIX}${tenantId}`);
        if (isEmpty && !onboardingCompleted && !showWelcomeModal) {
          // Small delay to avoid conflicting with welcome modal
          quickStartTimer = setTimeout(() => {
            setShowQuickStart(true);
          }, 3000);
        }
      } catch (error) {
        logger.error('Error checking if account is empty', error, { component: 'DashboardPage' });
      }
    };

    let quickStartTimer: ReturnType<typeof setTimeout>;
    checkIfEmpty();
    return () => clearTimeout(quickStartTimer);
  }, [tenantId, authLoading, showWelcomeModal]);

  const handleGenerateDemoData = async () => {
    if (!tenantId) return;

    setGeneratingDemoData(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-data', {
        body: { tenant_id: tenantId }
      });

      if (error) throw error;

      // Check for error in response body (edge functions can return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate demo data');
      }

      toast.success("Demo Data Generated", {
        description: "Your dashboard has been populated with sample data.",
      });

      // Refresh page to show new data
      window.location.reload();
    } catch (error) {
      handleError(error, {
        component: 'DashboardPage',
        context: { action: 'generate_demo_data' },
        toastTitle: 'Error generating demo data'
      });
    } finally {
      setGeneratingDemoData(false);
    }
  };

  // Defensive check: if auth loading takes >15s, redirect to login
  useEffect(() => {
    if (authLoading) {
      const loadingTimeout = setTimeout(() => {
        if (authLoading) {
          logger.warn('Auth loading timeout (>15s) in DashboardPage - redirecting to login', undefined, 'DashboardPage');
          // Navigate to login instead of just logging
          navigate(`/${tenant?.slug || 'app'}/admin/login`, {
            state: { message: 'Session verification timed out. Please log in again.' }
          });
        }
      }, 15000);

      return () => clearTimeout(loadingTimeout);
    }
  }, [authLoading, tenantId, tenant, navigate]);

  // Memoize trial calculations
  const trialInfo = useMemo(() => {
    const trialEndsAt = tenant?.trial_ends_at;
    const trialDaysRemaining = trialEndsAt
      ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    const trialEndingSoon = trialDaysRemaining !== null && trialDaysRemaining <= 10 && trialDaysRemaining > 0;

    return { trialDaysRemaining, trialEndingSoon };
  }, [tenant?.trial_ends_at]);

  // Memoize usage
  const tenantUsage = useMemo(() => tenant?.usage || { customers: 0, menus: 0, products: 0, locations: 0, users: 0 }, [tenant]);

  // Memoize onboarding progress
  const onboardingSteps = useMemo(() => [
    { id: "products", completed: (tenantUsage.products ?? 0) > 0, title: "Add your first product", link: `/${tenant?.slug}/admin/inventory/products` },
    { id: "customers", completed: (tenantUsage.customers ?? 0) > 0, title: "Add a customer", link: `/${tenant?.slug}/admin/customers` },
    { id: "menu", completed: (tenantUsage.menus ?? 0) > 0, title: "Create a disposable menu", link: `/${tenant?.slug}/admin/disposable-menus` },
    { id: "profile", completed: false, title: "Complete your business profile", link: `/${tenant?.slug}/admin/settings` },
  ], [tenantUsage.products, tenantUsage.customers, tenantUsage.menus, tenant?.slug]);

  const completedSteps = onboardingSteps.filter(step => step.completed).length;
  const onboardingProgress = onboardingSteps.length > 0
    ? (completedSteps / onboardingSteps.length) * 100
    : 100;

  // Early return if auth loading takes too long
  if (authLoading) {
    return (
      <div className="min-h-dvh bg-background">
        {/* Skeleton Header */}
        <header className="border-b border-border bg-background sticky top-0 z-50 shadow-sm">
          <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-24 hidden sm:block" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-20 rounded-md" />
              <Skeleton className="h-9 w-20 rounded-md" />
            </div>
          </div>
        </header>
        <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 lg:py-8 space-y-4 sm:space-y-6 md:space-y-8">
          {/* Skeleton KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 sm:p-4 md:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
          {/* Skeleton Quick Actions */}
          <div className="rounded-lg border bg-card p-3 sm:p-4 md:p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          </div>
          {/* Skeleton Activity Feed */}
          <div className="rounded-lg border bg-card p-3 sm:p-4 md:p-6 space-y-4">
            <Skeleton className="h-5 w-36" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-4 w-4 rounded-full mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50 shadow-sm safe-area-top">
        <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
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
            <SmartNotificationsCenter />
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
      {/* Main Content */}
      <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 lg:py-8 space-y-4 sm:space-y-6 md:space-y-8">
        {/* Trial Expiration Banner */}
        {isTrialActive && trialDaysRemaining !== null && tenant?.trial_ends_at && (
          <TrialExpirationBanner
            daysRemaining={trialDaysRemaining}
            hasPaymentMethod={hasPaymentMethod}
            trialEndsAt={tenant.trial_ends_at}
          />
        )}

        {/* Email Verification Banner */}
        <EmailVerificationBanner />

        {/* Free Tier Credit Balance Widget */}
        {isFreeTier && (
          <Card className={`border-2 ${isOutOfCredits
            ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20'
            : isCriticalCredits
              ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20'
              : isLowCredits
                ? 'border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20'
                : 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
            }`}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isOutOfCredits
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : isCriticalCredits
                      ? 'bg-orange-100 dark:bg-orange-900/30'
                      : isLowCredits
                        ? 'bg-yellow-100 dark:bg-yellow-900/30'
                        : 'bg-emerald-100 dark:bg-emerald-900/30'
                    }`}>
                    <Coins className={`h-6 w-6 ${isOutOfCredits
                      ? 'text-red-600'
                      : isCriticalCredits
                        ? 'text-orange-600'
                        : isLowCredits
                          ? 'text-yellow-600'
                          : 'text-emerald-600'
                      }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${isOutOfCredits
                        ? 'text-red-700 dark:text-red-300'
                        : isCriticalCredits
                          ? 'text-orange-700 dark:text-orange-300'
                          : isLowCredits
                            ? 'text-yellow-700 dark:text-yellow-300'
                            : 'text-emerald-700 dark:text-emerald-300'
                        }`}>
                        {creditBalance.toLocaleString()}
                      </span>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Free Tier
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      of {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} credits this month
                      {nextFreeGrantAt && (
                        <> · Refresh on {formatSmartDate(nextFreeGrantAt)}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <CreditBalance variant="badge" className="hidden sm:flex" />
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                    onClick={() => navigate(`/${tenant?.slug}/admin/select-plan`)}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Upgrade for Unlimited
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <Progress
                  value={Math.min(100, (creditBalance / FREE_TIER_MONTHLY_CREDITS) * 100)}
                  className={`h-2 ${isOutOfCredits ? '[&>div]:bg-red-500' :
                    isCriticalCredits ? '[&>div]:bg-orange-500' :
                      isLowCredits ? '[&>div]:bg-yellow-500' :
                        '[&>div]:bg-emerald-500'
                    }`}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{lifetimeSpent.toLocaleString()} credits used</span>
                  <span>{creditBalance.toLocaleString()} remaining</span>
                </div>
              </div>

              {/* Warning message */}
              {(isLowCredits || isCriticalCredits || isOutOfCredits) && (
                <p className={`text-sm mt-3 ${isOutOfCredits
                  ? 'text-red-600 dark:text-red-400'
                  : isCriticalCredits
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                  }`}>
                  {isOutOfCredits
                    ? "⚠️ You're out of credits! Some actions may be unavailable until you upgrade or your credits refresh."
                    : isCriticalCredits
                      ? "⚠️ Credits almost depleted! Consider upgrading for unlimited access."
                      : "💡 Running low on credits. Upgrade to a paid plan for unlimited usage."}
                </p>
              )}

              {/* Daily/Monthly Usage Summary - Context-aware messaging */}
              {hasActiveCredits ? (
                // User has purchased credits AND has balance > 0
                <div className="mt-4 pt-4 border-t border-muted-foreground/20">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <p className="text-sm font-medium">Full Access Unlocked</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    No daily limits — use all features freely while you have credits!
                  </p>
                </div>
              ) : hasPurchasedCredits && !hasActiveCredits ? (
                // User has purchased before BUT credits exhausted
                <div className="mt-4 pt-4 border-t border-muted-foreground/20">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="text-sm font-medium">Credits Exhausted</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your purchased credits have run out. Daily limits are now active.
                    <br />
                    <span className="text-orange-600 font-medium">Buy more credits to restore unlimited access!</span>
                  </p>
                </div>
              ) : usage && limitsApply && (
                // Never purchased - show limits with tip
                <div className="mt-4 pt-4 border-t border-muted-foreground/20">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Today's Usage Limits</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="text-center p-2 rounded bg-muted/50">
                      <span className="text-lg font-semibold">{usage.menusCreatedToday ?? 0}</span>
                      <span className="text-muted-foreground">/{FREE_TIER_LIMITS.max_menus_per_day}</span>
                      <p className="text-[10px] text-muted-foreground">Menus</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/50">
                      <span className="text-lg font-semibold">{usage.ordersCreatedToday ?? 0}</span>
                      <span className="text-muted-foreground">/{FREE_TIER_LIMITS.max_orders_per_day}</span>
                      <p className="text-[10px] text-muted-foreground">Orders</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/50">
                      <span className="text-lg font-semibold">{usage.smsSentToday ?? 0}</span>
                      <span className="text-muted-foreground">/{FREE_TIER_LIMITS.max_sms_per_day}</span>
                      <p className="text-[10px] text-muted-foreground">SMS</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/50">
                      <span className="text-lg font-semibold">{usage.exportsThisMonth ?? 0}</span>
                      <span className="text-muted-foreground">/{FREE_TIER_LIMITS.max_exports_per_month}</span>
                      <p className="text-[10px] text-muted-foreground">Exports/mo</p>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2">
                    💡 Tip: Buy credits to remove all daily limits!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Data Setup Banner - Prominent for empty accounts */}
        <DataSetupBanner />

        {/* Onboarding Checklist - For new users */}
        {tenant?.slug && isTrialActive && (
          <OnboardingChecklist
            tenantSlug={tenant.slug}
            className="mb-4"
          />
        )}

        {/* Permission-gated Quick Actions Panel */}
        <DashboardQuickActionsPanel />

        {/* Demo Data Generation Banner */}
        {isEmptyAccount && (
          <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 glass-card">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-blue-900 dark:text-blue-100">Start with Demo Data?</h3>
                  <p className="text-blue-700 dark:text-blue-300">
                    Populate your dashboard with sample customers, products, and orders to see how it looks.
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={generatingDemoData}
                    className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                  >
                    {generatingDemoData ? (
                      <>
                        <Activity className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Generate Demo Data
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Generate Demo Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will create sample customers, products, and orders in your account.
                      You can delete them later if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleGenerateDemoData}
                      disabled={generatingDemoData}
                    >
                      {generatingDemoData ? "Generating..." : "Generate"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Widget - 1-click access to top features */}
        <QuickActionsWidget
          userTier={tenant?.subscription_plan === 'enterprise' ? 'ENTERPRISE' : tenant?.subscription_plan === 'professional' ? 'PROFESSIONAL' : 'STARTER'}
          badges={{
            orders: todayMetrics?.orderCount ?? 0,
            'stock-alerts': todayMetrics?.lowStock?.length ?? 0,
          }}
          className="mb-4"
        />

        {/* Customizable Widget Grid */}
        <DashboardWidgetGrid />

        {/* Trial Countdown Banner */}
        {tenant?.subscription_status === "trial" && trialInfo.trialDaysRemaining !== null && (
          <Card className={`border-2 ${trialInfo.trialDaysRemaining <= 3
            ? "border-destructive bg-destructive/5"
            : trialInfo.trialDaysRemaining <= 10
              ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20"
              : "border-primary bg-primary/5"
            }`}>
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <AlertTriangle className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 sm:mt-0 ${trialInfo.trialDaysRemaining <= 3 ? "text-destructive" : trialInfo.trialDaysRemaining <= 10 ? "text-orange-600 dark:text-orange-400" : "text-primary"
                    }`} />
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold text-sm sm:text-base ${trialInfo.trialDaysRemaining <= 3 ? "text-destructive" : trialInfo.trialDaysRemaining <= 10 ? "text-orange-700 dark:text-orange-300" : "text-primary"
                      }`}>
                      {trialInfo.trialDaysRemaining <= 0
                        ? "⚠️ Trial Expired"
                        : trialInfo.trialDaysRemaining <= 3
                          ? "⚠️ Trial Ending in " + trialInfo.trialDaysRemaining + " days"
                          : "⏰ Trial Ending in " + trialInfo.trialDaysRemaining + " days"}
                    </p>
                    <p className={`text-xs sm:text-sm ${trialInfo.trialDaysRemaining <= 3 ? "text-destructive/90" : trialInfo.trialDaysRemaining <= 10 ? "text-orange-600 dark:text-orange-400" : "text-primary/90"
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

        {/* Onboarding Progress Widget */}
        {onboardingProgress < 100 && (
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-sm glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-[hsl(var(--tenant-text))] flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Setup Progress: {Math.round(onboardingProgress)}% Complete
                </CardTitle>
                <Badge variant="outline">{completedSteps}/{onboardingSteps.length}</Badge>
              </div>
              <Progress value={onboardingProgress} className="mt-3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {onboardingSteps.map((step) => (
                  <div key={step.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      {step.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                      <span className={`text-sm ${step.completed ? 'text-[hsl(var(--tenant-text))]' : 'text-[hsl(var(--tenant-text-light))]'}`}>
                        {step.title}
                      </span>
                    </div>
                    {!step.completed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(step.link)}
                        className="text-xs"
                      >
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Go
                      </Button>
                    )}
                  </div>
                ))}
                {onboardingProgress < 100 && (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => {
                      const nextStep = onboardingSteps.find(s => !s.completed);
                      if (nextStep) {
                        navigate(nextStep.link);
                      }
                    }}
                  >
                    Continue Setup →
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unified Analytics Dashboard */}
        {tenantId && <UnifiedAnalyticsDashboard tenantId={tenantId} />}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <Card className="glass-card">
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-1"><Zap className="h-4 w-4" /> Quick Actions</CardTitle>
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
          <Link to={`/${tenant?.slug}/admin/inventory/products`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Card className="hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] touch-manipulation">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 md:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1"><Package className="h-3 w-3" /> Products</CardTitle>
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                <div className="text-2xl sm:text-3xl font-bold">
                  {tenantUsage.products ?? 0}/{getDisplayLimit('products')}
                </div>
                {!isUnlimited('products') && (
                  <>
                    <Progress
                      value={getUsagePercentage('products')}
                      className="mt-2 h-1.5 sm:h-2"
                    />
                    {getUsagePercentage('products') >= 80 && (
                      <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mt-2 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" /> You're at {Math.round(getUsagePercentage('products'))}% capacity.
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
          </Link>

          <Link to={`/${tenant?.slug}/admin/big-plug-clients`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Card className="hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] touch-manipulation">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 md:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1"><Users className="h-3 w-3" /> Customers</CardTitle>
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                <div className="text-2xl sm:text-3xl font-bold">
                  {tenantUsage.customers ?? 0}/{getDisplayLimit('customers')}
                </div>
                {!isUnlimited('customers') && (
                  <>
                    <Progress
                      value={getUsagePercentage('customers')}
                      className="mt-2 h-1.5 sm:h-2"
                    />
                    {getUsagePercentage('customers') >= 80 && (
                      <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mt-2 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" /> You're at {Math.round(getUsagePercentage('customers'))}% capacity.
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
          </Link>

          <Link to={`/${tenant?.slug}/admin/disposable-menus`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Card className="hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] touch-manipulation">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4 md:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1"><Smartphone className="h-3 w-3" /> Menus</CardTitle>
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Smartphone className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                <div className="text-2xl sm:text-3xl font-bold text-[hsl(var(--tenant-text))]">
                  {tenantUsage.menus ?? 0}/{getDisplayLimit('menus')}
                </div>
                {!isUnlimited('menus') && (
                  <>
                    <Progress
                      value={getUsagePercentage('menus')}
                      className="mt-2 h-1.5 sm:h-2"
                    />
                    {getUsagePercentage('menus') >= 80 && (
                      <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mt-2">
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
          </Link>
        </div>

        {/* Quick Actions */}
        <Card className="glass-card" data-tutorial="quick-actions">
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
                  onClick={() => navigate(`/${tenant?.slug}/admin/big-plug-clients`)}
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
        <Card className="glass-card" data-tutorial="activity-feed">
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base md:text-lg">📋 Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {recentActivity.map((activity, index) => (
                  <div
                    key={`${index}-${activity.timestamp}-${activity.type}`}
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
                        {formatSmartDate(activity.timestamp, { includeTime: true })}
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
          <Card className="border-orange-300 dark:border-orange-600 border-2" data-tutorial="low-stock-alerts">
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              <div className="space-y-2 sm:space-y-3">
                {todayMetrics.lowStock.map((item: LowStockItem) => (
                  <div key={item.id} className="flex items-center justify-between p-2 sm:p-3 md:p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm text-[hsl(var(--tenant-text))] truncate">{item.strain || item.product_name || 'Unknown'}</p>
                      <p className="text-xs text-[hsl(var(--tenant-text-light))]">
                        {Number(item.weight_lbs ?? 0).toFixed(2)} lbs remaining
                      </p>
                    </div>
                    <Badge className="bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700 text-xs flex-shrink-0">Low Stock</Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-3 sm:mt-4 min-h-[44px] touch-manipulation" asChild>
                <Link to={`/${tenant?.slug}/admin/inventory/products`}>
                  <span className="text-sm sm:text-base">Manage Inventory</span> <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Welcome Modal for new signups */}
      <WelcomeModal
        open={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />

      {/* Trial Welcome Modal - shown when redirected from Stripe checkout */}
      <TrialWelcomeModal
        tenantSlug={tenant?.slug}
        businessName={tenant?.business_name}
      />

      {/* Credit Purchase Celebration */}
      <CreditPurchaseCelebration
        open={showCelebration}
        onOpenChange={setShowCelebration}
        creditsAdded={celebrationCredits}
        newBalance={creditBalance}
      />

      {/* Quick Start Wizard for empty accounts */}
      <QuickStartWizard
        open={showQuickStart}
        onOpenChange={setShowQuickStart}
        onComplete={() => {
          setShowQuickStart(false);
          localStorage.setItem(`${STORAGE_KEYS.ONBOARDING_COMPLETED_PREFIX}${tenantId}`, 'true');
          window.location.reload(); // Refresh to show new data
        }}
      />
    </div >
  );
}

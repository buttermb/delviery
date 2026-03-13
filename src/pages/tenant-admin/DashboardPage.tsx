/**
 * Tenant Admin Dashboard Page
 * Clean, focused command center layout matching Paper 4.0 design:
 * - Personalized greeting with status indicators
 * - Needs Your Attention list
 * - Quick Actions row (6 buttons with keyboard shortcuts)
 * - 4 focused KPI cards
 * - Two-column: Recent Activity | Revenue chart
 * - AI suggestion banner
 *
 * Preserves tenant-specific features:
 * - Trial/credit banners, email verification, onboarding, welcome modals
 */

import { lazy, Suspense, useCallback, useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Rocket from "lucide-react/dist/esm/icons/rocket";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Users from "lucide-react/dist/esm/icons/users";
import Package from "lucide-react/dist/esm/icons/package";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency, formatSmartDate } from '@/lib/formatters';
import { KPICard, KPICardSkeleton } from '@/components/admin/dashboard/KPICard';
import { SetupCompletionWidget } from '@/components/admin/dashboard/SetupCompletionWidget';
import { NeedsAttentionWidget } from '@/components/admin/dashboard/NeedsAttentionWidget';
import { QuickActionsRow } from '@/components/admin/dashboard/QuickActionsRow';
import { AISuggestionBanner } from '@/components/admin/dashboard/AISuggestionBanner';
import { LowStockBanner } from '@/components/admin/LowStockBanner';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCredits } from '@/hooks/useCredits';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { supabase } from '@/integrations/supabase/client';

// Tenant-specific features
import { TrialExpirationBanner } from '@/components/billing/TrialExpirationBanner';
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner';
import { DataSetupBanner } from '@/components/admin/DataSetupBanner';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { TrialWelcomeModal } from '@/components/onboarding/TrialWelcomeModal';
import { CreditPurchaseCelebration } from '@/components/credits/CreditPurchaseCelebration';
import { QuickStartWizard } from '@/components/onboarding/QuickStartWizard';

// Lazy load widgets for better performance
const ActivityWidget = lazy(() => import('@/components/admin/dashboard/ActivityFeedWidget').then(module => ({ default: module.ActivityFeedWidget })));
const RevenueChartWidget = lazy(() => import('@/components/admin/dashboard/RevenueChartWidget').then(module => ({ default: module.RevenueChartWidget })));

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// Loading skeleton for activity widget
function ActivityWidgetFallback() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-2">
            <Skeleton className="h-4 w-4 mt-0.5 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Loading skeleton for revenue chart
function RevenueChartFallback() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-7 w-32" />
      </div>
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-[160px] w-full rounded-lg" />
    </Card>
  );
}

// Full-page loading skeleton
function DashboardPageSkeleton() {
  return (
    <div className="p-4 sm:p-4 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export default function TenantAdminDashboardPage() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { tenant, admin, tenantSlug, loading: authLoading } = useTenantAdminAuth();
  const { data: stats, isLoading, error, dataUpdatedAt, refetch, isFetching } = useDashboardStats('30d');

  // Tenant-specific state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Credit system
  const { balance: creditBalance } = useCredits();

  // Credit purchase celebration
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationCredits, setCelebrationCredits] = useState(0);

  // Trial info
  const trialDaysRemaining = useMemo(() => {
    const trialEndsAt = tenant?.trial_ends_at;
    if (!trialEndsAt) return null;
    return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [tenant?.trial_ends_at]);
  const hasPaymentMethod = tenant?.payment_method_added === true;
  const isTrialActive = tenant?.subscription_status === 'trial';

  // Realtime sync
  useRealtimeSync({
    tenantId: tenant?.id,
    tables: ['orders', 'products', 'disposable_menus', 'customers'],
    enabled: !!tenant?.id,
  });

  // Handle credits_purchased URL parameter
  useEffect(() => {
    if (searchParams.get('credits_purchased') === 'true') {
      setShowCelebration(true);
      setCelebrationCredits(creditBalance);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('credits_purchased');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, creditBalance, setSearchParams]);

  // Check if user came from signup
  useEffect(() => {
    const state = location.state as { fromSignup?: boolean; showWelcome?: boolean } | null;
    if (state?.fromSignup || state?.showWelcome) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        try {
          window.history.replaceState({}, document.title);
        } catch (err) {
          logger.error('Failed to clear history state', err, { component: 'DashboardPage' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Auto-show Quick Start for empty accounts
  useEffect(() => {
    if (!tenant?.id || authLoading) return;

    let quickStartTimer: ReturnType<typeof setTimeout>;
    const checkIfEmpty = async () => {
      try {
        const [productsResult, menusResult] = await Promise.allSettled([
          supabase.from('products').select('id').eq('tenant_id', tenant.id).limit(1),
          supabase.from('disposable_menus').select('id').eq('tenant_id', tenant.id).limit(1),
        ]);

        const products = productsResult.status === 'fulfilled' ? productsResult.value.data : null;
        const menus = menusResult.status === 'fulfilled' ? menusResult.value.data : null;
        const isEmpty = (!products || products.length === 0) && (!menus || menus.length === 0);

        const onboardingCompleted = localStorage.getItem(`${STORAGE_KEYS.ONBOARDING_COMPLETED_PREFIX}${tenant.id}`);
        if (isEmpty && !onboardingCompleted && !showWelcomeModal) {
          quickStartTimer = setTimeout(() => setShowQuickStart(true), 3000);
        }
      } catch (err) {
        logger.error('Error checking if account is empty', err, { component: 'DashboardPage' });
      }
    };

    checkIfEmpty();
    return () => clearTimeout(quickStartTimer);
  }, [tenant?.id, authLoading, showWelcomeModal]);

  // Auth loading timeout — redirect after 15s
  useEffect(() => {
    if (authLoading) {
      const timeout = setTimeout(() => {
        if (authLoading) {
          logger.warn('Auth loading timeout (>15s) - redirecting to login', undefined, 'DashboardPage');
          navigate(`/${tenant?.slug || 'app'}/admin/login`, {
            state: { message: 'Session verification timed out. Please log in again.' }
          });
        }
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [authLoading, tenant?.slug, navigate]);

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  // Auth loading skeleton
  if (authLoading || !tenant || (isLoading && !stats)) {
    return <DashboardPageSkeleton />;
  }

  const userName = admin?.name || admin?.email?.split('@')[0] || 'there';
  const formattedDate = format(new Date(), 'EEEE, MMM d');
  const lastUpdated = dataUpdatedAt
    ? formatSmartDate(new Date(dataUpdatedAt), { includeTime: true })
    : null;

  return (
    <div className="p-4 sm:p-4 space-y-4 overflow-x-hidden">
      {/* Header — Personalized greeting + status indicators */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Good {getTimeOfDay()}, {userName}
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2 flex-wrap">
            <span>{formattedDate}</span>
            {stats && (stats.pendingOrders ?? 0) > 0 && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {stats.pendingOrders} orders need attention
                </span>
              </>
            )}
            {stats && (stats.lowStockItems ?? 0) > 0 && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {stats.lowStockItems} low stock alerts
                </span>
              </>
            )}
            {stats && (stats.revenueGrowthPercent ?? 0) > 0 && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Revenue up {stats.revenueGrowthPercent.toFixed(0)}%
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Updated {lastUpdated}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
            aria-label="Refresh dashboard"
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tenant banners — trial, email verification, data setup */}
      {isTrialActive && trialDaysRemaining !== null && tenant?.trial_ends_at && (
        <TrialExpirationBanner
          daysRemaining={trialDaysRemaining}
          hasPaymentMethod={hasPaymentMethod}
          trialEndsAt={tenant.trial_ends_at}
        />
      )}
      <EmailVerificationBanner />
      <DataSetupBanner />
      <LowStockBanner onViewDetails={() => navigate(`/${tenantSlug}/admin/inventory-hub`)} />

      {/* Onboarding checklist for trial users */}
      {tenant?.slug && isTrialActive && (
        <OnboardingChecklist tenantSlug={tenant.slug} />
      )}

      {/* Error states */}
      {error && !stats && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-4 py-12">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-destructive">Failed to load dashboard data</p>
              <p className="text-sm text-muted-foreground mt-1">
                Something went wrong while fetching your stats. Please try again.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Retrying...' : 'Try Again'}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && stats && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center justify-between gap-4">
            <p className="text-destructive text-sm">
              Failed to refresh dashboard stats. Showing cached data.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Setup Completion Checklist — shown for new tenants */}
      <SetupCompletionWidget />

      {/* Empty state for brand-new tenants */}
      {error && !stats ? null : !isLoading && stats && stats.totalProducts === 0 && stats.totalOrdersMTD === 0 && stats.pendingOrders === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Rocket}
              title="Welcome to FloraIQ!"
              description="Get started by adding your first product. Once you have products, you can create menus, take orders, and track everything from this dashboard."
              actionLabel="Add Product"
              onAction={() => navigate(`/${tenantSlug}/admin/inventory-hub`)}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Needs Your Attention */}
          <NeedsAttentionWidget />

          {/* Quick Actions */}
          <QuickActionsRow />

          {/* 4 Focused KPI Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
            ) : (
              <>
                <KPICard
                  title="Today's Revenue"
                  value={formatCurrency(stats?.revenueToday ?? 0)}
                  icon={<DollarSign className="h-5 w-5" />}
                  description="Completed orders today"
                  variant="success"
                  trend={stats?.revenueYesterday && stats.revenueYesterday > 0 ? {
                    value: ((stats.revenueToday - stats.revenueYesterday) / stats.revenueYesterday) * 100,
                    label: 'vs yesterday',
                  } : undefined}
                  href="/admin/finance-hub"
                />
                <KPICard
                  title="Orders Today"
                  value={stats?.totalOrdersToday ?? 0}
                  icon={<ShoppingCart className="h-5 w-5" />}
                  description={`${stats?.pendingOrders ?? 0} pending`}
                  variant={stats?.pendingOrders && stats.pendingOrders > 0 ? 'warning' : 'default'}
                  trend={stats?.totalOrdersYesterday && stats.totalOrdersYesterday > 0 ? {
                    value: ((stats.totalOrdersToday - stats.totalOrdersYesterday) / stats.totalOrdersYesterday) * 100,
                    label: 'vs yesterday',
                  } : undefined}
                  href="/admin/orders"
                />
                <KPICard
                  title="Active Customers"
                  value={stats?.totalCustomers ?? 0}
                  icon={<Users className="h-5 w-5" />}
                  description={`+${stats?.newCustomers ?? 0} this period`}
                  variant="default"
                  href="/admin/customer-hub"
                />
                <KPICard
                  title="Inventory Health"
                  value={stats?.totalProducts
                    ? `${Math.round(((stats.totalProducts - (stats.outOfStockItems ?? 0)) / stats.totalProducts) * 100)}% in stock`
                    : '—'}
                  icon={<Package className="h-5 w-5" />}
                  description={`${stats?.lowStockItems ?? 0} low of ${stats?.totalProducts ?? 0} SKUs`}
                  variant={stats?.lowStockItems && stats.lowStockItems > 0 ? 'warning' : 'default'}
                  href="/admin/inventory-hub"
                />
              </>
            )}
          </div>

          {/* Two-column: Activity + Revenue chart */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Suspense fallback={<ActivityWidgetFallback />}>
              <ActivityWidget />
            </Suspense>
            <Suspense fallback={<RevenueChartFallback />}>
              <RevenueChartWidget />
            </Suspense>
          </div>

          {/* AI Suggestion Banner */}
          <AISuggestionBanner />
        </>
      )}

      {/* Modals */}
      <WelcomeModal
        open={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />
      <TrialWelcomeModal
        tenantSlug={tenant?.slug}
        businessName={tenant?.business_name}
      />
      <CreditPurchaseCelebration
        open={showCelebration}
        onOpenChange={setShowCelebration}
        creditsAdded={celebrationCredits}
        newBalance={creditBalance}
      />
      <QuickStartWizard
        open={showQuickStart}
        onOpenChange={setShowQuickStart}
        onComplete={() => {
          setShowQuickStart(false);
          localStorage.setItem(`${STORAGE_KEYS.ONBOARDING_COMPLETED_PREFIX}${tenant?.id}`, 'true');
          queryClient.invalidateQueries();
        }}
      />
    </div>
  );
}

/**
 * Admin Dashboard Page
 * Clean, focused command center layout:
 * - Personalized greeting with status indicators
 * - Needs Your Attention list
 * - Quick Actions row (6 buttons with keyboard shortcuts)
 * - 4 focused KPI cards
 * - Two-column: Recent Activity | Revenue chart
 * - AI suggestion banner
 *
 * Uses TanStack Query with 30s auto-refresh for real-time data.
 */

import { lazy, Suspense, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Rocket from "lucide-react/dist/esm/icons/rocket";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Users from "lucide-react/dist/esm/icons/users";
import Package from "lucide-react/dist/esm/icons/package";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency, formatSmartDate } from '@/lib/formatters';
import { KPICard, KPICardSkeleton } from '@/components/admin/dashboard/KPICard';
import { SetupCompletionWidget } from '@/components/admin/dashboard/SetupCompletionWidget';
import { NeedsAttentionWidget } from '@/components/admin/dashboard/NeedsAttentionWidget';
import { QuickActionsRow } from '@/components/admin/dashboard/QuickActionsRow';
import { AISuggestionBanner } from '@/components/admin/dashboard/AISuggestionBanner';
import { LowStockBanner } from '@/components/admin/LowStockBanner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { format } from 'date-fns';

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

export function DashboardPage() {
  usePageTitle('Dashboard');
  const { tenant, admin, tenantSlug } = useTenantAdminAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading, error, dataUpdatedAt, refetch, isFetching } = useDashboardStats('30d');

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!tenant || (isLoading && !stats)) {
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

      {/* Low Stock Alert Banner */}
      <LowStockBanner onViewDetails={() => navigate(`/${tenantSlug}/admin/inventory-hub`)} />

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
    </div>
  );
}

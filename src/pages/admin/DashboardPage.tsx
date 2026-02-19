/**
 * Admin Dashboard Page
 * Displays comprehensive KPI cards for:
 * - Revenue: Today's revenue, MTD, growth percentage, avg order value (lazy loaded)
 * - Orders: Pending, today, completed, MTD totals
 * - Customers: Total, new (last 30 days), active sessions
 * - Inventory: Total products, low stock, out of stock, inventory value
 * - Alerts: Recent inventory alerts and notifications (lazy loaded)
 * - Activity: Recent activity feed (lazy loaded)
 *
 * Uses TanStack Query with 30s auto-refresh for real-time data.
 */

import { lazy, Suspense, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import PackageX from "lucide-react/dist/esm/icons/package-x";
import Package from "lucide-react/dist/esm/icons/package";
import Rocket from "lucide-react/dist/esm/icons/rocket";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import Users from "lucide-react/dist/esm/icons/users";
import Activity from "lucide-react/dist/esm/icons/activity";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Warehouse from "lucide-react/dist/esm/icons/warehouse";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useNavigate } from 'react-router-dom';
import { useDashboardStats, type DashboardPeriod } from '@/hooks/useDashboardStats';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { KPICard, KPICardSkeleton } from '@/components/admin/dashboard/KPICard';
import { SetupCompletionWidget } from '@/components/admin/dashboard/SetupCompletionWidget';
import { usePageTitle } from '@/hooks/usePageTitle';
import { EmptyState } from '@/components/admin/shared/EmptyState';

// Lazy load RevenueWidget for better performance
const RevenueWidget = lazy(() => import('@/components/admin/dashboard/RevenueWidget').then(module => ({ default: module.RevenueWidget })));

// Lazy load ActivityWidget for better performance
const ActivityWidget = lazy(() => import('@/components/admin/dashboard/ActivityFeedWidget').then(module => ({ default: module.ActivityFeedWidget })));

// Lazy load AlertsWidget for better performance
const AlertsWidget = lazy(() => import('@/components/admin/dashboard/AlertsWidget').then(module => ({ default: module.AlertsWidget })));

// Fallback component for RevenueWidget while loading
function RevenueWidgetFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// Fallback component for ActivityWidget while loading
function ActivityWidgetFallback() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-12" />
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

// Fallback component for AlertsWidget while loading
function AlertsWidgetFallback() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-12" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        ))}
      </div>
    </Card>
  );
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  '7d': '7D',
  '30d': '30D',
  '90d': '90D',
  'mtd': 'MTD',
  'ytd': 'YTD',
};

const WHATS_NEW_KEY = 'floraiq_whats_new_r3';

export function DashboardPage() {
  usePageTitle('Dashboard');
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const { data: stats, isLoading, error, dataUpdatedAt, refetch, isFetching } = useDashboardStats(period);
  const [whatsNewDismissed, setWhatsNewDismissed] = useState(() =>
    localStorage.getItem(WHATS_NEW_KEY) === 'dismissed'
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!tenant) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div className="p-6 space-y-6">
      <HubBreadcrumbs
        hubName="dashboard"
        hubHref="dashboard"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Real-time overview of your operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(val) => { if (val) setPeriod(val as DashboardPeriod); }}
            size="sm"
            variant="outline"
          >
            {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((key) => (
              <ToggleGroupItem key={key} value={key} aria-label={`Show ${PERIOD_LABELS[key]} data`}>
                {PERIOD_LABELS[key]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {lastUpdated && (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              Updated {lastUpdated}
            </Badge>
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

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">
              Failed to load dashboard stats. Data will retry automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Setup Completion Checklist */}
      <SetupCompletionWidget />

      {/* What's New Banner — dismissible, for returning users with data */}
      {!whatsNewDismissed && !isLoading && stats && (stats.totalProducts > 0 || stats.totalCustomers > 0) && (
        <div className="relative flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">What&apos;s New</p>
            <p className="text-blue-700 dark:text-blue-300">
              Edit orders, record partial payments, process refunds, and more.{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100"
                onClick={() => navigate(`/${tenantSlug}/admin/settings-hub?tab=features`)}
              >
                Enable more features in Settings
              </button>.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-blue-600 hover:bg-blue-100 hover:text-blue-800 dark:text-blue-400 dark:hover:bg-blue-900"
            onClick={() => {
              localStorage.setItem(WHATS_NEW_KEY, 'dismissed');
              setWhatsNewDismissed(true);
            }}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Empty state for brand-new tenants with zero orders AND zero products */}
      {!isLoading && stats && stats.totalProducts === 0 && stats.totalOrdersMTD === 0 && stats.pendingOrders === 0 ? (
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
          {/* Revenue Section - Lazy Loaded */}
          <Suspense fallback={<RevenueWidgetFallback />}>
            <RevenueWidget period={period} />
          </Suspense>

          {/* Orders Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Orders
            </h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
              ) : (
                <>
                  <KPICard
                    title="Pending Orders"
                    value={stats?.pendingOrders ?? 0}
                    icon={<AlertTriangle className="h-5 w-5" />}
                    description="Awaiting processing"
                    variant={stats?.pendingOrders && stats.pendingOrders > 0 ? 'warning' : 'default'}
                    href="/admin/orders?status=pending"
                  />
                  <KPICard
                    title="Today's Orders"
                    value={stats?.totalOrdersToday ?? 0}
                    icon={<ShoppingCart className="h-5 w-5" />}
                    description="Orders placed today"
                    variant="default"
                    href="/admin/orders"
                  />
                  <KPICard
                    title="Completed Today"
                    value={stats?.completedOrdersToday ?? 0}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    description="Successfully delivered"
                    variant="success"
                    href="/admin/orders?status=completed"
                  />
                  <KPICard
                    title={`Orders (${PERIOD_LABELS[period]})`}
                    value={stats?.totalOrdersMTD ?? 0}
                    icon={<ShoppingCart className="h-5 w-5" />}
                    description={`Total in selected period`}
                    variant="default"
                    href="/admin/orders"
                  />
                </>
              )}
            </div>
          </div>

          {/* Customers Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Customers
            </h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
              ) : (
                <>
                  <KPICard
                    title="Total Customers"
                    value={stats?.totalCustomers ?? 0}
                    icon={<Users className="h-5 w-5" />}
                    description="All registered customers"
                    variant="default"
                    href="/admin/customer-hub"
                  />
                  <KPICard
                    title="New Customers"
                    value={stats?.newCustomers ?? 0}
                    icon={<UserPlus className="h-5 w-5" />}
                    description={`Joined in the last ${PERIOD_LABELS[period]}`}
                    variant="success"
                    href="/admin/customer-hub"
                  />
                  <KPICard
                    title="Active Sessions"
                    value={stats?.activeSessions ?? 0}
                    icon={<Activity className="h-5 w-5" />}
                    description="Online in last 15 minutes"
                    variant="default"
                    href="/admin/analytics-hub"
                  />
                </>
              )}
            </div>
          </div>

          {/* Inventory Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              Inventory
            </h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
              ) : (
                <>
                  <KPICard
                    title="Total Products"
                    value={stats?.totalProducts ?? 0}
                    icon={<Package className="h-5 w-5" />}
                    description="In catalog"
                    variant="default"
                    href="/admin/inventory-hub"
                  />
                  <KPICard
                    title="Low Stock"
                    value={stats?.lowStockItems ?? 0}
                    icon={<PackageX className="h-5 w-5" />}
                    description="Below reorder threshold"
                    variant={stats?.lowStockItems && stats.lowStockItems > 0 ? 'warning' : 'default'}
                    href="/admin/inventory-hub?tab=alerts"
                  />
                  <KPICard
                    title="Out of Stock"
                    value={stats?.outOfStockItems ?? 0}
                    icon={<AlertTriangle className="h-5 w-5" />}
                    description="Needs restocking"
                    variant={stats?.outOfStockItems && stats.outOfStockItems > 0 ? 'destructive' : 'default'}
                    href="/admin/inventory-hub?tab=alerts"
                  />
                  <KPICard
                    title="Inventory Value"
                    value={formatCurrency(stats?.totalInventoryValue ?? 0)}
                    icon={<Warehouse className="h-5 w-5" />}
                    description="Total stock value"
                    variant="default"
                    href="/admin/finance-hub"
                  />
                </>
              )}
            </div>
          </div>

          {/* Alerts Section - Lazy Loaded */}
          <Suspense fallback={<AlertsWidgetFallback />}>
            <AlertsWidget />
          </Suspense>

          {/* Activity Feed Section - Lazy Loaded */}
          <Suspense fallback={<ActivityWidgetFallback />}>
            <ActivityWidget />
          </Suspense>
        </>
      )}
    </div>
  );
}

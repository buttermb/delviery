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
 * Widget visibility and order are customizable per admin via useDashboardWidgets.
 */

import { lazy, Suspense, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import PackageX from "lucide-react/dist/esm/icons/package-x";
import Package from "lucide-react/dist/esm/icons/package";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import Users from "lucide-react/dist/esm/icons/users";
import Activity from "lucide-react/dist/esm/icons/activity";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Warehouse from "lucide-react/dist/esm/icons/warehouse";
import type { DashboardWidgetId } from '@/hooks/useDashboardWidgets';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { WidgetCustomizePanel } from '@/components/admin/dashboard/WidgetCustomizePanel';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { KPICard, KPICardSkeleton } from '@/components/admin/dashboard/KPICard';
import { SetupCompletionWidget } from '@/components/admin/dashboard/SetupCompletionWidget';

// Lazy load heavy widgets for better performance
const RevenueWidget = lazy(() => import('@/components/admin/dashboard/RevenueWidget').then(module => ({ default: module.RevenueWidget })));
const ActivityWidget = lazy(() => import('@/components/admin/dashboard/ActivityFeedWidget').then(module => ({ default: module.ActivityFeedWidget })));
const AlertsWidget = lazy(() => import('@/components/admin/dashboard/AlertsWidget').then(module => ({ default: module.AlertsWidget })));

function RevenueWidgetFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-32" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

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

interface WidgetSectionProps {
  stats: ReturnType<typeof useDashboardStats>['data'];
  isLoading: boolean;
}

function OrdersSection({ stats, isLoading }: WidgetSectionProps) {
  return (
    <div className="space-y-3">
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
            />
            <KPICard
              title="Today's Orders"
              value={stats?.totalOrdersToday ?? 0}
              icon={<ShoppingCart className="h-5 w-5" />}
              description="Orders placed today"
              variant="default"
            />
            <KPICard
              title="Completed Today"
              value={stats?.completedOrdersToday ?? 0}
              icon={<CheckCircle2 className="h-5 w-5" />}
              description="Successfully delivered"
              variant="success"
            />
            <KPICard
              title="Orders (MTD)"
              value={stats?.totalOrdersMTD ?? 0}
              icon={<ShoppingCart className="h-5 w-5" />}
              description="Total this month"
              variant="default"
            />
          </>
        )}
      </div>
    </div>
  );
}

function CustomersSection({ stats, isLoading }: WidgetSectionProps) {
  return (
    <div className="space-y-3">
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
            />
            <KPICard
              title="New Customers"
              value={stats?.newCustomers ?? 0}
              icon={<UserPlus className="h-5 w-5" />}
              description="Joined in the last 30 days"
              variant="success"
            />
            <KPICard
              title="Active Sessions"
              value={stats?.activeSessions ?? 0}
              icon={<Activity className="h-5 w-5" />}
              description="Online in last 15 minutes"
              variant="default"
            />
          </>
        )}
      </div>
    </div>
  );
}

function InventorySection({ stats, isLoading }: WidgetSectionProps) {
  return (
    <div className="space-y-3">
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
            />
            <KPICard
              title="Low Stock"
              value={stats?.lowStockItems ?? 0}
              icon={<PackageX className="h-5 w-5" />}
              description="Below reorder threshold"
              variant={stats?.lowStockItems && stats.lowStockItems > 0 ? 'warning' : 'default'}
            />
            <KPICard
              title="Out of Stock"
              value={stats?.outOfStockItems ?? 0}
              icon={<AlertTriangle className="h-5 w-5" />}
              description="Needs restocking"
              variant={stats?.outOfStockItems && stats.outOfStockItems > 0 ? 'destructive' : 'default'}
            />
            <KPICard
              title="Inventory Value"
              value={formatCurrency(stats?.totalInventoryValue ?? 0)}
              icon={<Warehouse className="h-5 w-5" />}
              description="Total stock value"
              variant="default"
            />
          </>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { tenant } = useTenantAdminAuth();
  const { data: stats, isLoading, error, dataUpdatedAt } = useDashboardStats();
  const {
    visibleWidgets,
    widgetStates,
    permittedWidgets,
    toggleWidget,
    moveWidget,
    resetToDefaults,
    isLoaded,
  } = useDashboardWidgets();

  // Map widget IDs to their rendered JSX
  const widgetRenderers = useMemo(() => {
    const renderers: Record<DashboardWidgetId, React.ReactNode> = {
      setup: <SetupCompletionWidget key="setup" />,
      revenue: (
        <Suspense key="revenue" fallback={<RevenueWidgetFallback />}>
          <RevenueWidget />
        </Suspense>
      ),
      orders: <OrdersSection key="orders" stats={stats} isLoading={isLoading} />,
      customers: <CustomersSection key="customers" stats={stats} isLoading={isLoading} />,
      inventory: <InventorySection key="inventory" stats={stats} isLoading={isLoading} />,
      alerts: (
        <Suspense key="alerts" fallback={<AlertsWidgetFallback />}>
          <AlertsWidget />
        </Suspense>
      ),
      activity: (
        <Suspense key="activity" fallback={<ActivityWidgetFallback />}>
          <ActivityWidget />
        </Suspense>
      ),
    };
    return renderers;
  }, [stats, isLoading]);

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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Real-time overview of your operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <Badge variant="secondary" className="text-xs">
              Updated {lastUpdated}
            </Badge>
          )}
          {isLoaded && (
            <WidgetCustomizePanel
              widgetStates={widgetStates}
              permittedWidgets={permittedWidgets}
              toggleWidget={toggleWidget}
              moveWidget={moveWidget}
              resetToDefaults={resetToDefaults}
            />
          )}
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

      {/* Render visible widgets in user-preferred order */}
      {visibleWidgets.map((widget) => widgetRenderers[widget.id])}
    </div>
  );
}

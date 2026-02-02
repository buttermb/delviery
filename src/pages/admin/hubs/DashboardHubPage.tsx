/**
 * Admin Dashboard Hub
 * Unified dashboard displaying comprehensive KPIs from:
 * - Orders (pending, today, MTD, completed, avg order value)
 * - Inventory (total products, low stock, out of stock, inventory value)
 * - Revenue (today, MTD, growth percentage)
 * - Customers (new, total, active sessions)
 *
 * Uses TanStack Query with 30s refetch interval for live data.
 * Supports date range filtering via DashboardDatePicker.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import PackageX from "lucide-react/dist/esm/icons/package-x";
import Package from "lucide-react/dist/esm/icons/package";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import Users from "lucide-react/dist/esm/icons/users";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Activity from "lucide-react/dist/esm/icons/activity";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Warehouse from "lucide-react/dist/esm/icons/warehouse";
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { DashboardDateRangeProvider } from '@/contexts/DashboardDateRangeContext';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { DashboardDatePicker } from '@/components/admin/dashboard/DashboardDatePicker';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { DashboardTour, TakeDashboardTourButton } from '@/components/admin/DashboardTour';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  variant?: 'default' | 'warning' | 'success' | 'destructive';
  trend?: { value: number; label: string };
}

function StatCard({ title, value, icon, description, variant = 'default', trend }: StatCardProps) {
  const variantClasses = {
    default: 'text-primary',
    warning: 'text-orange-500',
    success: 'text-green-600',
    destructive: 'text-red-600',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={variantClasses[variant]}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            {trend.value >= 0 ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <span className={trend.value >= 0 ? 'text-green-600 text-xs font-medium' : 'text-red-600 text-xs font-medium'}>
              {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
        {!trend && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function DashboardHubContent() {
  const { tenant } = useTenantAdminAuth();
  const { data: stats, isLoading, error, dataUpdatedAt } = useDashboardStats();

  if (!tenant) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <StatCardSkeleton key={i} />
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

      <div className="flex items-center justify-between" data-tour="dashboard-header">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of your operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TakeDashboardTourButton />
          {lastUpdated && (
            <Badge variant="secondary" className="text-xs">
              Updated {lastUpdated}
            </Badge>
          )}
        </div>
      </div>

      {/* Dashboard Tour for new users */}
      <DashboardTour />

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">
              Failed to load dashboard stats. Data will retry automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Revenue Section */}
      <div className="space-y-3" data-tour="revenue-section">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Revenue
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                title="Period Revenue"
                value={formatCurrency(stats?.revenueToday ?? 0)}
                icon={<DollarSign className="h-5 w-5" />}
                description="From all orders in period"
                variant="success"
              />
              <StatCard
                title="Total Revenue"
                value={formatCurrency(stats?.revenueMTD ?? 0)}
                icon={<TrendingUp className="h-5 w-5" />}
                description="Completed orders in period"
                variant="success"
                trend={stats?.revenueGrowthPercent !== undefined ? {
                  value: stats.revenueGrowthPercent,
                  label: 'vs previous period'
                } : undefined}
              />
              <StatCard
                title="Avg Order Value"
                value={formatCurrency(stats?.avgOrderValue ?? 0)}
                icon={<ShoppingCart className="h-5 w-5" />}
                description="Per order in period"
                variant="default"
              />
            </>
          )}
        </div>
      </div>

      {/* Orders Section */}
      <div className="space-y-3" data-tour="orders-section">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-blue-600" />
          Orders
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                title="Pending Orders"
                value={stats?.pendingOrders ?? 0}
                icon={<AlertTriangle className="h-5 w-5" />}
                description="Awaiting processing"
                variant={stats?.pendingOrders && stats.pendingOrders > 0 ? 'warning' : 'default'}
              />
              <StatCard
                title="Orders"
                value={stats?.totalOrdersToday ?? 0}
                icon={<ShoppingCart className="h-5 w-5" />}
                description="Orders in selected period"
                variant="default"
              />
              <StatCard
                title="Completed"
                value={stats?.completedOrdersToday ?? 0}
                icon={<CheckCircle2 className="h-5 w-5" />}
                description="Delivered in period"
                variant="success"
              />
              <StatCard
                title="Total Orders"
                value={stats?.totalOrdersMTD ?? 0}
                icon={<ShoppingCart className="h-5 w-5" />}
                description="All orders in period"
                variant="default"
              />
            </>
          )}
        </div>
      </div>

      {/* Inventory Section */}
      <div className="space-y-3" data-tour="inventory-section">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-600" />
          Inventory
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                title="Total Products"
                value={stats?.totalProducts ?? 0}
                icon={<Package className="h-5 w-5" />}
                description="In catalog"
                variant="default"
              />
              <StatCard
                title="Low Stock"
                value={stats?.lowStockItems ?? 0}
                icon={<PackageX className="h-5 w-5" />}
                description="Below reorder threshold"
                variant={stats?.lowStockItems && stats.lowStockItems > 0 ? 'warning' : 'default'}
              />
              <StatCard
                title="Out of Stock"
                value={stats?.outOfStockItems ?? 0}
                icon={<AlertTriangle className="h-5 w-5" />}
                description="Needs restocking"
                variant={stats?.outOfStockItems && stats.outOfStockItems > 0 ? 'destructive' : 'default'}
              />
              <StatCard
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

      {/* Customers Section */}
      <div className="space-y-3" data-tour="customers-section">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600" />
          Customers
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                title="Total Customers"
                value={stats?.totalCustomers ?? 0}
                icon={<Users className="h-5 w-5" />}
                description="All registered customers"
                variant="default"
              />
              <StatCard
                title="New Customers"
                value={stats?.newCustomers ?? 0}
                icon={<UserPlus className="h-5 w-5" />}
                description="Joined in selected period"
                variant="success"
              />
              <StatCard
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
    </div>
  );
}

export function DashboardHubPage() {
  return (
    <DashboardDateRangeProvider>
      <DashboardHubContent />
    </DashboardDateRangeProvider>
  );
}

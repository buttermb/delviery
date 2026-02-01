/**
 * Admin Dashboard Page
 * Displays comprehensive KPI cards for:
 * - Revenue: Today's revenue, MTD, growth percentage, avg order value
 * - Orders: Pending, today, completed, MTD totals
 * - Customers: Total, new (last 30 days), active sessions
 * - Inventory: Total products, low stock, out of stock, inventory value
 *
 * Uses TanStack Query with 30s auto-refresh for real-time data.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  PackageX,
  Package,
  UserPlus,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Warehouse,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  variant?: 'default' | 'warning' | 'success' | 'destructive';
  trend?: { value: number; label: string };
}

function KPICard({ title, value, icon, description, variant = 'default', trend }: KPICardProps) {
  const variantClasses = {
    default: 'text-primary',
    warning: 'text-orange-500',
    success: 'text-green-600',
    destructive: 'text-red-600',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
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

function KPICardSkeleton() {
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

export function DashboardPage() {
  const { tenant } = useTenantAdminAuth();
  const { data: stats, isLoading, error, dataUpdatedAt } = useDashboardStats();

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
        {lastUpdated && (
          <Badge variant="secondary" className="text-xs">
            Updated {lastUpdated}
          </Badge>
        )}
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

      {/* Revenue Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Revenue
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
          ) : (
            <>
              <KPICard
                title="Today's Revenue"
                value={formatCurrency(stats?.revenueToday ?? 0)}
                icon={<DollarSign className="h-5 w-5" />}
                description="Completed orders today"
                variant="success"
              />
              <KPICard
                title="Month to Date"
                value={formatCurrency(stats?.revenueMTD ?? 0)}
                icon={<TrendingUp className="h-5 w-5" />}
                description="Revenue this month"
                variant="success"
                trend={stats?.revenueGrowthPercent !== undefined ? {
                  value: stats.revenueGrowthPercent,
                  label: 'vs last month'
                } : undefined}
              />
              <KPICard
                title="Avg Order Value"
                value={formatCurrency(stats?.avgOrderValue ?? 0)}
                icon={<ShoppingCart className="h-5 w-5" />}
                description="Per order this month"
                variant="default"
              />
            </>
          )}
        </div>
      </div>

      {/* Orders Section */}
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

      {/* Customers Section */}
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

      {/* Inventory Section */}
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
    </div>
  );
}

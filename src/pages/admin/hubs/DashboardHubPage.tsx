/**
 * Admin Command Center Dashboard
 * Unified dashboard with live KPI cards, activity feed, quick actions,
 * and charts -- pulling REAL data from every panel via Supabase.
 *
 * Auto-refreshes via:
 *  - TanStack Query staleTime / refetchInterval (30s)
 *  - Realtime invalidation (useRealtimeSync in AdminLayout)
 *  - Manual "Refresh" button
 */

import { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  PackageX,
  Package,
  UserPlus,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Menu,
  Store,
  Truck,
  BookOpen,
  RefreshCw,
  Clock,
  CircleDollarSign,
  Receipt,
  User,
  Flame,
  MapPin,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useRevenueChart, useOrdersByStatus, useTopProducts } from '@/hooks/useDashboardCharts';
import { useDashboardActivity, getRelativeTime, type ActivityType } from '@/hooks/useDashboardActivity';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { usePageTitle } from '@/hooks/usePageTitle';

// ============================================================================
// KPI Card Components
// ============================================================================

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  variant?: 'default' | 'warning' | 'success' | 'destructive';
  trend?: { value: number; label: string };
  href: string;
}

function KpiCard({ title, value, icon, description, variant = 'default', trend, href }: KpiCardProps) {
  const variantClasses = {
    default: 'text-primary',
    warning: 'text-orange-500',
    success: 'text-green-600',
    destructive: 'text-red-600',
  };

  return (
    <Link to={href} className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 group-hover:scale-[1.01] active:scale-[0.99]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className={variantClasses[variant]}>
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {trend && trend.value !== 0 ? (
            <div className="flex items-center gap-1 mt-1">
              {trend.value > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={trend.value > 0 ? 'text-green-600 text-xs font-medium' : 'text-red-600 text-xs font-medium'}>
                {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function KpiCardSkeleton() {
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

// ============================================================================
// Quick Actions
// ============================================================================

interface QuickActionItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

function QuickActionsGrid({ tenantSlug }: { tenantSlug: string }) {
  const buildUrl = (path: string) => `/${tenantSlug}/admin/${path}`;

  const actions: QuickActionItem[] = [
    { label: 'New Order', href: buildUrl('orders'), icon: <ShoppingCart className="h-5 w-5" />, description: 'Create an order' },
    { label: 'Ring Up Sale', href: buildUrl('pos-system'), icon: <CreditCard className="h-5 w-5" />, description: 'Point of sale' },
    { label: 'Add Product', href: buildUrl('inventory-hub'), icon: <Package className="h-5 w-5" />, description: 'Add to catalog' },
    { label: 'Create Menu', href: buildUrl('disposable-menus'), icon: <Menu className="h-5 w-5" />, description: 'Disposable menu' },
    { label: 'View Storefront', href: buildUrl('storefront'), icon: <Store className="h-5 w-5" />, description: 'Online store' },
    { label: 'Add Customer', href: buildUrl('customer-hub'), icon: <UserPlus className="h-5 w-5" />, description: 'New customer' },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {actions.map((action) => (
        <Link
          key={action.label}
          to={action.href}
          className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          tabIndex={0}
          role="button"
          aria-label={action.description}
        >
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 group-hover:scale-[1.02] active:scale-[0.98]">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                {action.icon}
              </div>
              <span className="text-sm font-medium">{action.label}</span>
              <span className="text-xs text-muted-foreground hidden sm:block">{action.description}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ============================================================================
// Activity Feed
// ============================================================================

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  order: <ShoppingCart className="h-4 w-4" />,
  product: <Package className="h-4 w-4" />,
  customer: <User className="h-4 w-4" />,
  payment: <CircleDollarSign className="h-4 w-4" />,
  menu: <BookOpen className="h-4 w-4" />,
  delivery: <MapPin className="h-4 w-4" />,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  order: 'bg-blue-100 text-blue-600',
  product: 'bg-purple-100 text-purple-600',
  customer: 'bg-green-100 text-green-600',
  payment: 'bg-emerald-100 text-emerald-600',
  menu: 'bg-amber-100 text-amber-600',
  delivery: 'bg-cyan-100 text-cyan-600',
};

function ActivityFeed({ tenantSlug }: { tenantSlug: string }) {
  const { data: activities, isLoading } = useDashboardActivity();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-3 w-12 flex-shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!activities || activities.length === 0) ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {activities.map((item) => (
              <Link
                key={item.id}
                to={`/${tenantSlug}/admin/${item.linkPath}`}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[item.type]}`}>
                  {ACTIVITY_ICONS[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                  {getRelativeTime(item.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Charts
// ============================================================================

function RevenueLineChart() {
  const { data, isLoading } = useRevenueChart();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-green-600" />
          Revenue (Last 7 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!data || data.length === 0) ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No revenue data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 12 }} />
              <YAxis className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function OrdersDonutChart() {
  const { data, isLoading } = useOrdersByStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orders by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalOrders = (data ?? []).reduce((sum, s) => sum + s.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-blue-600" />
          Orders by Status
          {totalOrders > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">{totalOrders} total</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!data || data.length === 0) ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No order data available</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="count"
                  nameKey="status"
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [value, name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center sm:flex-col sm:gap-1">
              {data.slice(0, 6).map((entry) => (
                <div key={entry.status} className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{entry.status}</span>
                  <span className="font-medium">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopProductsBarChart() {
  const { data, isLoading } = useTopProducts();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Products (This Week)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-purple-600" />
          Top 5 Products (This Week)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!data || data.length === 0) ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No sales data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="productName"
                width={120}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: string) => value.length > 18 ? value.slice(0, 18) + '...' : value}
              />
              <Tooltip
                formatter={(value: number) => [value, 'Qty Sold']}
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
              />
              <Legend />
              <Bar
                dataKey="quantity"
                name="Qty Sold"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** Compute percentage change. Returns 0 when yesterday is 0. */
function pctChange(today: number, yesterday: number): number {
  if (yesterday === 0) return 0;
  return ((today - yesterday) / yesterday) * 100;
}

// ============================================================================
// Main Page
// ============================================================================

export function DashboardHubPage() {
  usePageTitle('Dashboard');
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: stats, isLoading, error } = useDashboardStats();
  const queryClient = useQueryClient();

  const buildUrl = (path: string) => `/${tenantSlug}/admin/${path}`;

  // Task 5: Manual refresh -- invalidate all dashboard-related queries
  const handleRefresh = useCallback(() => {
    logger.debug('Manual dashboard refresh triggered', { component: 'DashboardHubPage' });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });
  }, [queryClient]);

  if (!tenant || !tenantSlug) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const lastUpdated = new Date().toLocaleTimeString();

  return (
    <div className="p-6 space-y-6">
      <HubBreadcrumbs hubName="dashboard-hub" hubHref="dashboard-hub" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Command Center</h1>
          <p className="text-muted-foreground text-sm">
            Real-time overview across all panels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <Badge variant="secondary" className="text-xs">
              Updated {lastUpdated}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions (Task 3) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <QuickActionsGrid tenantSlug={tenantSlug} />
      </div>

      {/* Error state - show retry card instead of broken KPI cards */}
      {error && !isLoading && (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-1">Failed to load dashboard stats</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-md">
              Something went wrong while fetching your metrics. This may be a temporary issue.
            </p>
            <Button variant="outline" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards (Task 1) - only show when not in error state */}
      {!error && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Key Metrics</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)
            ) : (
              <>
                <KpiCard
                  title="Today's Revenue"
                  value={formatCurrency(stats?.revenueToday ?? 0)}
                  icon={<DollarSign className="h-5 w-5" />}
                  description="Orders + POS sales today"
                  variant="success"
                  href={buildUrl('finance-hub')}
                  trend={stats && stats.revenueYesterday > 0 ? {
                    value: pctChange(stats.revenueToday, stats.revenueYesterday),
                    label: 'vs yesterday',
                  } : undefined}
                />
                <KpiCard
                  title="Pending Orders"
                  value={stats?.pendingOrders ?? 0}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  description="Awaiting processing"
                  variant={stats?.pendingOrders && stats.pendingOrders > 0 ? 'warning' : 'default'}
                  href={buildUrl('orders')}
                />
                <KpiCard
                  title="Low Stock Alerts"
                  value={stats?.lowStockItems ?? 0}
                  icon={<PackageX className="h-5 w-5" />}
                  description="Below reorder threshold"
                  variant={stats?.lowStockItems && stats.lowStockItems > 0 ? 'warning' : 'default'}
                  href={buildUrl('inventory-hub')}
                />
                <KpiCard
                  title="New Customers Today"
                  value={stats?.newCustomersToday ?? 0}
                  icon={<UserPlus className="h-5 w-5" />}
                  description="Joined today"
                  variant="success"
                  href={buildUrl('customer-hub')}
                  trend={stats && stats.newCustomersYesterday > 0 ? {
                    value: pctChange(stats.newCustomersToday, stats.newCustomersYesterday),
                    label: 'vs yesterday',
                  } : undefined}
                />
                <KpiCard
                  title="Active Deliveries"
                  value={stats?.activeDeliveries ?? 0}
                  icon={<Truck className="h-5 w-5" />}
                  description="In transit right now"
                  variant={stats?.activeDeliveries && stats.activeDeliveries > 0 ? 'success' : 'default'}
                  href={buildUrl('fulfillment-hub')}
                />
                <KpiCard
                  title="Active Menus"
                  value={stats?.activeMenus ?? 0}
                  icon={<Flame className="h-5 w-5" />}
                  description="Live disposable menus"
                  variant="default"
                  href={buildUrl('disposable-menus')}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Secondary KPI Row - only show when not in error state */}
      {!error && (
        <div className="space-y-4">
          <Link to={buildUrl('finance-hub')} className="group flex items-center gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2 group-hover:text-primary transition-colors">
              <DollarSign className="h-5 w-5 text-green-600" />
              Revenue & Orders
            </h2>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
            ) : (
              <>
                <KpiCard
                  title="Revenue MTD"
                  value={formatCurrency(stats?.revenueMTD ?? 0)}
                  icon={<TrendingUp className="h-5 w-5" />}
                  description="Month to date"
                  variant="success"
                  href={buildUrl('finance-hub')}
                  trend={stats?.revenueGrowthPercent !== undefined && stats.revenueGrowthPercent !== 0 ? {
                    value: stats.revenueGrowthPercent,
                    label: 'vs last month',
                  } : undefined}
                />
                <KpiCard
                  title="Today's Orders"
                  value={stats?.totalOrdersToday ?? 0}
                  icon={<ShoppingCart className="h-5 w-5" />}
                  description="Placed today"
                  variant="default"
                  href={buildUrl('orders')}
                  trend={stats && stats.totalOrdersYesterday > 0 ? {
                    value: pctChange(stats.totalOrdersToday, stats.totalOrdersYesterday),
                    label: 'vs yesterday',
                  } : undefined}
                />
                <KpiCard
                  title="Avg Order Value"
                  value={formatCurrency(stats?.avgOrderValue ?? 0)}
                  icon={<CircleDollarSign className="h-5 w-5" />}
                  description="Per order this month"
                  variant="default"
                  href={buildUrl('analytics-hub')}
                />
                <KpiCard
                  title="Total Customers"
                  value={stats?.totalCustomers ?? 0}
                  icon={<Users className="h-5 w-5" />}
                  description="All registered"
                  variant="default"
                  href={buildUrl('customer-hub')}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Charts + Activity Feed (Tasks 2 & 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts -- 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <RevenueLineChart />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OrdersDonutChart />
            <TopProductsBarChart />
          </div>
        </div>

        {/* Activity Feed -- 1 column */}
        <div>
          <ActivityFeed tenantSlug={tenantSlug} />
        </div>
      </div>
    </div>
  );
}

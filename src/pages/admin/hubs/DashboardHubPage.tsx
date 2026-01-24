/**
 * Admin Dashboard Hub
 * Unified dashboard with 5 real-time stat cards:
 * - Pending Orders
 * - Low Stock Items
 * - New Customers (30 days)
 * - Revenue (today)
 * - Active Sessions
 *
 * Uses TanStack Query with 30s refetch interval for live data.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  PackageX,
  UserPlus,
  DollarSign,
  Activity,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  variant?: 'default' | 'warning' | 'success';
}

function StatCard({ title, value, icon, description, variant = 'default' }: StatCardProps) {
  const variantClasses = {
    default: 'text-primary',
    warning: 'text-orange-500',
    success: 'text-green-600',
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
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
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

export function DashboardHubPage() {
  const { tenant } = useTenantAdminAuth();
  const { data: stats, isLoading, error, dataUpdatedAt } = useDashboardStats();

  if (!tenant) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))
        ) : (
          <>
            <StatCard
              title="Pending Orders"
              value={stats?.pendingOrders ?? 0}
              icon={<ShoppingCart className="h-5 w-5" />}
              description="Orders awaiting processing"
              variant={stats?.pendingOrders && stats.pendingOrders > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Low Stock"
              value={stats?.lowStockItems ?? 0}
              icon={<PackageX className="h-5 w-5" />}
              description="Items below reorder threshold"
              variant={stats?.lowStockItems && stats.lowStockItems > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="New Customers"
              value={stats?.newCustomers ?? 0}
              icon={<UserPlus className="h-5 w-5" />}
              description="Joined in the last 30 days"
              variant="success"
            />
            <StatCard
              title="Revenue"
              value={formatCurrency(stats?.revenue ?? 0)}
              icon={<DollarSign className="h-5 w-5" />}
              description="Today's completed orders"
              variant="success"
            />
            <StatCard
              title="Active Sessions"
              value={stats?.activeSessions ?? 0}
              icon={<Activity className="h-5 w-5" />}
              description="Customers online now"
            />
          </>
        )}
      </div>
    </div>
  );
}

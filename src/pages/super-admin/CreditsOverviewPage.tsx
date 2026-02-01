/**
 * Credits Overview Page - Super Admin
 * 
 * Platform-wide credit system dashboard showing metrics,
 * tenant health, and quick actions.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Coins,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Crown,
  ArrowRight,
  DollarSign,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  getPlatformCreditStats,
  getTenantsWithCredits,
  type PlatformCreditStats,
  type TenantCreditInfo,
  FREE_TIER_MONTHLY_CREDITS,
} from '@/lib/credits';

export default function CreditsOverviewPage() {
  // Fetch platform stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['platform-credit-stats'],
    queryFn: getPlatformCreditStats,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch tenants needing attention (critical + depleted)
  const { data: criticalTenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['critical-tenants'],
    queryFn: async () => {
      const critical = await getTenantsWithCredits({ status: 'critical', limit: 5 });
      const depleted = await getTenantsWithCredits({ status: 'depleted', limit: 5 });
      return {
        critical: critical.tenants,
        depleted: depleted.tenants,
      };
    },
  });

  // Format currency
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credit System Overview</h1>
          <p className="text-muted-foreground">
            Platform-wide credit metrics and tenant health
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchStats()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Free Tier Tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Free Tier Tenants</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalFreeTierTenants || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Using credit system
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Paid Tier Tenants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid Subscribers</CardTitle>
            <Crown className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalPaidTierTenants || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Unlimited access
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Credits Consumed Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits Used Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(stats?.totalCreditsConsumedToday || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  This week: {formatNumber(stats?.totalCreditsConsumedWeek || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Purchase Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credit Revenue (MTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.totalCreditPurchasesRevenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  From credit pack purchases
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenant Health Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Credit Health</CardTitle>
            <CardDescription>Distribution of free-tier tenants by credit status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                {/* Healthy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Healthy (&gt;200 credits)</span>
                    </div>
                    <span className="font-medium">{stats?.tenantsHealthy || 0}</span>
                  </div>
                  <Progress 
                    value={stats?.totalFreeTierTenants ? ((stats?.tenantsHealthy || 0) / stats.totalFreeTierTenants) * 100 : 0} 
                    className="h-2 bg-green-100 [&>div]:bg-green-500" 
                  />
                </div>

                {/* Warning */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span>Warning (50-200 credits)</span>
                    </div>
                    <span className="font-medium">{stats?.tenantsWarning || 0}</span>
                  </div>
                  <Progress 
                    value={stats?.totalFreeTierTenants ? ((stats?.tenantsWarning || 0) / stats.totalFreeTierTenants) * 100 : 0} 
                    className="h-2 bg-yellow-100 [&>div]:bg-yellow-500" 
                  />
                </div>

                {/* Critical */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span>Critical (1-50 credits)</span>
                    </div>
                    <span className="font-medium">{stats?.tenantsCritical || 0}</span>
                  </div>
                  <Progress 
                    value={stats?.totalFreeTierTenants ? ((stats?.tenantsCritical || 0) / stats.totalFreeTierTenants) * 100 : 0} 
                    className="h-2 bg-orange-100 [&>div]:bg-orange-500" 
                  />
                </div>

                {/* Depleted */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>Depleted (0 credits)</span>
                    </div>
                    <span className="font-medium">{stats?.tenantsAtZero || 0}</span>
                  </div>
                  <Progress 
                    value={stats?.totalFreeTierTenants ? ((stats?.tenantsAtZero || 0) / stats.totalFreeTierTenants) * 100 : 0} 
                    className="h-2 bg-red-100 [&>div]:bg-red-500" 
                  />
                </div>

                {/* Average Balance */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg. Free Tier Balance</span>
                    <span className="font-medium">
                      {Math.round(stats?.avgBalanceFreeTier || 0).toLocaleString()} credits
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round(((stats?.avgBalanceFreeTier || 0) / FREE_TIER_MONTHLY_CREDITS) * 100)}% of monthly allocation
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tenants Needing Attention */}
        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
            <CardDescription>Tenants with low or depleted credits</CardDescription>
          </CardHeader>
          <CardContent>
            {tenantsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Depleted tenants first */}
                {criticalTenants?.depleted.map((tenant) => (
                  <TenantRow key={tenant.tenantId} tenant={tenant} />
                ))}
                
                {/* Then critical */}
                {criticalTenants?.critical.map((tenant) => (
                  <TenantRow key={tenant.tenantId} tenant={tenant} />
                ))}

                {(!criticalTenants?.depleted.length && !criticalTenants?.critical.length) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>All tenants have healthy credit balances</p>
                  </div>
                )}

                {(criticalTenants?.depleted.length || criticalTenants?.critical.length) ? (
                  <Link to="/super-admin/credits/tenants?status=critical">
                    <Button variant="outline" className="w-full mt-2">
                      View All
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common credit management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/super-admin/credits/tenants">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Users className="h-5 w-5" />
                <span>Manage Tenants</span>
              </Button>
            </Link>
            <Link to="/super-admin/credits/transactions">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Activity className="h-5 w-5" />
                <span>Audit Log</span>
              </Button>
            </Link>
            <Link to="/super-admin/credits/promo-codes">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Coins className="h-5 w-5" />
                <span>Promo Codes</span>
              </Button>
            </Link>
            <Link to="/super-admin/credits/analytics">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <TrendingUp className="h-5 w-5" />
                <span>Analytics</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Credits This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats?.totalCreditsConsumedMonth || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total consumed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Per Tenant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalFreeTierTenants 
                ? Math.round((stats?.totalCreditsConsumedMonth || 0) / stats.totalFreeTierTenants).toLocaleString()
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Credits used this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Opportunity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.tenantsCritical || 0) + (stats?.tenantsAtZero || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Tenants likely to upgrade</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper component for tenant rows
function TenantRow({ tenant }: { tenant: TenantCreditInfo }) {
  return (
    <Link
      to={`/super-admin/credits/tenants?tenant=${tenant.tenantId}`}
      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${
          tenant.creditStatus === 'depleted' ? 'bg-red-500' :
          tenant.creditStatus === 'critical' ? 'bg-orange-500' :
          tenant.creditStatus === 'warning' ? 'bg-yellow-500' :
          'bg-green-500'
        }`} />
        <div>
          <p className="font-medium text-sm">{tenant.tenantName}</p>
          <p className="text-xs text-muted-foreground">@{tenant.tenantSlug}</p>
        </div>
      </div>
      <div className="text-right">
        <Badge variant={tenant.creditStatus === 'depleted' ? 'destructive' : 'secondary'}>
          {tenant.balance.toLocaleString()} credits
        </Badge>
      </div>
    </Link>
  );
}








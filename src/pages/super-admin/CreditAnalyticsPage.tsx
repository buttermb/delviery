/**
 * Credit Analytics Page - Super Admin
 * 
 * Charts and metrics for credit system performance and conversion analysis.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  DollarSign,
  Activity,
  BarChart3,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
import { queryKeys } from '@/lib/queryKeys';
  getCreditAnalytics,
  getPlatformCreditStats,
  FREE_TIER_MONTHLY_CREDITS,
} from '@/lib/credits';

type DateRange = '7d' | '30d' | '90d';

export default function CreditAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [dateRange]);

  // Fetch analytics
  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: queryKeys.superAdminTools.creditAnalytics(startDate, endDate),
    queryFn: () => getCreditAnalytics({ startDate, endDate }),
  });

  // Fetch platform stats
  const { data: stats } = useQuery({
    queryKey: queryKeys.superAdminTools.creditPlatformStats(),
    queryFn: getPlatformCreditStats,
  });

  // Format currency
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Calculate totals from analytics
  const totals = useMemo(() => {
    if (!analytics) return { credits: 0, revenue: 0 };
    return {
      credits: analytics.consumptionTrend.reduce((sum, d) => sum + d.credits, 0),
      revenue: analytics.purchaseRevenue.reduce((sum, d) => sum + d.revenue, 0),
    };
  }, [analytics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credit Analytics</h1>
          <p className="text-muted-foreground">
            Monitor credit consumption and conversion metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits Consumed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totals.credits.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  In selected period
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credit Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>
                <p className="text-xs text-muted-foreground">
                  From pack purchases
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats && stats.totalFreeTierTenants > 0
                    ? Math.round((stats.totalPaidTierTenants / (stats.totalFreeTierTenants + stats.totalPaidTierTenants)) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Free to paid conversion
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Daily Consumption</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {analytics?.consumptionTrend.length
                    ? Math.round(totals.credits / analytics.consumptionTrend.length).toLocaleString()
                    : 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Credits per day
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumption Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Credit Consumption Trend</CardTitle>
            <CardDescription>Daily credits consumed</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : analytics?.consumptionTrend.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="space-y-2">
                {/* Simple bar chart representation */}
                <div className="flex items-end h-40 gap-1">
                  {analytics?.consumptionTrend.slice(-14).map((day, _i) => {
                    const max = Math.max(...(analytics?.consumptionTrend.slice(-14).map(d => d.credits) || [1]));
                    const height = (day.credits / max) * 100;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 bg-primary/80 rounded-t transition-all hover:bg-primary"
                        style={{ height: `${height}%`, minHeight: day.credits > 0 ? '4px' : '0' }}
                        title={`${day.date}: ${day.credits.toLocaleString()} credits`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{analytics?.consumptionTrend.slice(-14)[0]?.date}</span>
                  <span>{analytics?.consumptionTrend.slice(-1)[0]?.date}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Usage by Category</CardTitle>
            <CardDescription>Where credits are being spent</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : analytics?.categoryBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="space-y-3">
                {analytics?.categoryBreakdown.slice(0, 6).map((cat) => {
                  const total = analytics.categoryBreakdown.reduce((sum, c) => sum + c.credits, 0);
                  const percent = total > 0 ? (cat.credits / total) * 100 : 0;
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{cat.category}</span>
                        <span className="text-muted-foreground">
                          {cat.credits.toLocaleString()} ({Math.round(percent)}%)
                        </span>
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Actions and Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Top Credit-Consuming Actions</CardTitle>
            <CardDescription>Most expensive actions by total credits</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : analytics?.topActions.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            ) : (
              <div className="space-y-2">
                {analytics?.topActions.map((action, i) => (
                  <div
                    key={action.action}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{action.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {action.count.toLocaleString()} times
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {action.credits.toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>Free tier to paid conversion path</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="space-y-4">
                {/* Total Free Tier */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Free Tier Users</span>
                    <span className="font-medium">{stats.totalFreeTierTenants}</span>
                  </div>
                  <Progress value={100} className="h-3 bg-blue-100 [&>div]:bg-blue-500" />
                </div>

                {/* At Risk (Low Credits) */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ArrowDownRight className="h-4 w-4 text-yellow-500" />
                      Low Credits (Warning/Critical)
                    </span>
                    <span className="font-medium">
                      {stats.tenantsWarning + stats.tenantsCritical}
                    </span>
                  </div>
                  <Progress 
                    value={stats.totalFreeTierTenants > 0 
                      ? ((stats.tenantsWarning + stats.tenantsCritical) / stats.totalFreeTierTenants) * 100 
                      : 0} 
                    className="h-3 bg-yellow-100 [&>div]:bg-yellow-500" 
                  />
                </div>

                {/* Depleted */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ArrowDownRight className="h-4 w-4 text-red-500" />
                      Depleted (0 Credits)
                    </span>
                    <span className="font-medium">{stats.tenantsAtZero}</span>
                  </div>
                  <Progress 
                    value={stats.totalFreeTierTenants > 0 
                      ? (stats.tenantsAtZero / stats.totalFreeTierTenants) * 100 
                      : 0} 
                    className="h-3 bg-red-100 [&>div]:bg-red-500" 
                  />
                </div>

                {/* Converted to Paid */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                      Converted to Paid
                    </span>
                    <span className="font-medium">{stats.totalPaidTierTenants}</span>
                  </div>
                  <Progress 
                    value={stats.totalFreeTierTenants > 0 
                      ? (stats.totalPaidTierTenants / (stats.totalFreeTierTenants + stats.totalPaidTierTenants)) * 100 
                      : 0} 
                    className="h-3 bg-green-100 [&>div]:bg-green-500" 
                  />
                </div>

                {/* Summary */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Conversion Rate</span>
                    <Badge className="bg-green-100 text-green-800 text-lg">
                      {stats.totalFreeTierTenants + stats.totalPaidTierTenants > 0
                        ? Math.round((stats.totalPaidTierTenants / (stats.totalFreeTierTenants + stats.totalPaidTierTenants)) * 100)
                        : 0}%
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
          <CardDescription>Actionable insights from credit data</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats || !analytics ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  At-Risk Tenants
                </h4>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.tenantsWarning + stats.tenantsCritical + stats.tenantsAtZero}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  tenants have less than 200 credits
                </p>
              </div>

              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">
                  Avg. Balance
                </h4>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round(stats.avgBalanceFreeTier).toLocaleString()}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  credits per free tier tenant ({Math.round((stats.avgBalanceFreeTier / FREE_TIER_MONTHLY_CREDITS) * 100)}% of monthly)
                </p>
              </div>

              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
                  Top Usage
                </h4>
                <p className="text-2xl font-bold text-purple-600">
                  {analytics.topActions[0]?.action || 'N/A'}
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                  {analytics.topActions[0]?.credits.toLocaleString() || 0} credits total
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








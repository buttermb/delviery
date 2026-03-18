/**
 * Credit Analytics Page - Tenant Admin
 *
 * Comprehensive credit analytics dashboard for free tier users.
 * Displays stats, charts, purchase history, and auto top-up settings.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Coins,
  TrendingUp,
  Calendar,
  Activity,
  BarChart3,
  Clock,
  ArrowLeft,
  RefreshCw,
  ShoppingCart,
  Settings,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { formatCurrency, formatSmartDate } from '@/lib/formatters';
import {
  FREE_TIER_MONTHLY_CREDITS,
  getCreditCostInfo,
  getCategoryDisplayName,
  type CreditCategory,
} from '@/lib/credits';
import { AutoTopUpSettings } from '@/components/credits/AutoTopUpSettings';
import { CreditPurchaseModal } from '@/components/credits/CreditPurchaseModal';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS, CATEGORY_CHART_COLORS } from '@/lib/chartColors';

interface UsageByCategory {
  category: string;
  displayName: string;
  credits: number;
  count: number;
  color: string;
}

interface UsageByAction {
  actionType: string;
  actionName: string;
  credits: number;
  count: number;
}

interface DailyUsage {
  date: string;
  credits: number;
}

interface PurchaseRecord {
  id: string;
  amount: number;
  created_at: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
}

export function CreditAnalyticsPage() {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const navigate = useNavigate();
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  const {
    balance,
    isFreeTier,
    isLoading: creditsLoading,
    lifetimeSpent: _lifetimeSpent,
    lifetimeEarned: _lifetimeEarned,
    nextFreeGrantAt,
    refetch: refetchCredits,
  } = useCredits();

  const tenantId = tenant?.id;

  // Fetch usage data for the last 30 days
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = useQuery({
    queryKey: queryKeys.creditWidgets.analytics(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      try {
        // Get all usage transactions for the last 30 days
        const { data: transactions, error } = await supabase
          .from('credit_transactions')
          .select('id, amount, action_type, created_at')
          .eq('tenant_id', tenantId)
          .eq('transaction_type', 'usage')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate 30-day usage
        const monthUsage = (transactions ?? []).reduce(
          (sum, t) => sum + Math.abs(t.amount),
          0
        );

        // Calculate daily average
        const avgDailyUsage = monthUsage / 30;

        // Calculate days remaining at current usage rate
        const daysRemaining = avgDailyUsage > 0 ? Math.floor(balance / avgDailyUsage) : null;

        // Group by category
        const byCategory: Record<string, { total: number; count: number }> = {};
        (transactions ?? []).forEach((t) => {
          const info = getCreditCostInfo(t.action_type);
          const category = info?.category || 'other';
          if (!byCategory[category]) {
            byCategory[category] = { total: 0, count: 0 };
          }
          byCategory[category].total += Math.abs(t.amount);
          byCategory[category].count += 1;
        });

        const categoryUsage: UsageByCategory[] = Object.entries(byCategory)
          .map(([category, data]) => ({
            category,
            displayName: getCategoryDisplayName(category as CreditCategory) || category,
            credits: data.total,
            count: data.count,
            color: CATEGORY_CHART_COLORS[category] || CATEGORY_CHART_COLORS.other,
          }))
          .sort((a, b) => b.credits - a.credits);

        // Group by action type (top consumers)
        const byAction: Record<string, { total: number; count: number }> = {};
        (transactions ?? []).forEach((t) => {
          const action = t.action_type || 'unknown';
          if (!byAction[action]) {
            byAction[action] = { total: 0, count: 0 };
          }
          byAction[action].total += Math.abs(t.amount);
          byAction[action].count += 1;
        });

        const topActions: UsageByAction[] = Object.entries(byAction)
          .map(([actionType, data]) => {
            const info = getCreditCostInfo(actionType);
            return {
              actionType,
              actionName: info?.actionName || actionType.replace(/_/g, ' '),
              credits: data.total,
              count: data.count,
            };
          })
          .sort((a, b) => b.credits - a.credits)
          .slice(0, 10);

        // Calculate daily usage over time
        const dailyUsage: DailyUsage[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const dayTransactions = (transactions ?? []).filter(
            (t) =>
              new Date(t.created_at) >= date && new Date(t.created_at) < nextDate
          );
          const dayTotal = dayTransactions.reduce(
            (sum, t) => sum + Math.abs(t.amount),
            0
          );

          dailyUsage.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            credits: dayTotal,
          });
        }

        return {
          monthUsage,
          avgDailyUsage: Math.round(avgDailyUsage),
          daysRemaining,
          categoryUsage,
          topActions,
          dailyUsage,
          transactionCount: transactions?.length ?? 0,
        };
      } catch (error) {
        logger.error('Failed to fetch credit analytics', { error });
        return null;
      }
    },
    enabled: !!tenantId && isFreeTier,
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch purchase history
  const { data: purchaseHistory, isLoading: purchasesLoading, refetch: refetchPurchases } = useQuery({
    queryKey: queryKeys.creditWidgets.purchases(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('id, amount, created_at, description, metadata')
          .eq('tenant_id', tenantId)
          .eq('transaction_type', 'purchase')
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        return (data ?? []) as PurchaseRecord[];
      } catch (error) {
        logger.error('Failed to fetch purchase history', { error });
        return [];
      }
    },
    enabled: !!tenantId && isFreeTier,
    staleTime: 60 * 1000,
  });

  const handleRefresh = () => {
    refetchCredits();
    refetchUsage();
    refetchPurchases();
  };

  const isLoading = creditsLoading || usageLoading;
  const percentRemaining = Math.round((balance / FREE_TIER_MONTHLY_CREDITS) * 100);

  // Prepare pie chart data
  const pieData = useMemo(() => {
    if (!usageData?.categoryUsage) return [];
    return usageData.categoryUsage.slice(0, 6).map((cat) => ({
      name: cat.displayName,
      value: cat.credits,
      color: cat.color,
    }));
  }, [usageData?.categoryUsage]);

  // If not on free tier, redirect to billing
  if (!isFreeTier && !creditsLoading) {
    navigate(`/${tenantSlug}/admin/settings?tab=payments`);
    return null;
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/${tenantSlug}/admin`)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Credit Analytics</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Monitor your credit usage and optimize spending
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setPurchaseModalOpen(true)}>
              <Coins className="h-4 w-4 mr-2" />
              Buy Credits
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Balance Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{balance.toLocaleString()}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={percentRemaining} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">{percentRemaining}%</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 30-Day Usage Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">30-Day Usage</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {usageData?.monthUsage?.toLocaleString() ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {usageData?.transactionCount ?? 0} actions performed
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Daily Average Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {usageData?.avgDailyUsage?.toLocaleString() ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">credits per day</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Days Remaining Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className={cn(
                    'text-2xl font-bold',
                    usageData?.daysRemaining !== null && usageData.daysRemaining < 7 && 'text-red-500',
                    usageData?.daysRemaining !== null && usageData.daysRemaining >= 7 && usageData.daysRemaining < 14 && 'text-yellow-500'
                  )}>
                    {usageData?.daysRemaining !== null ? usageData.daysRemaining : '∞'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    at current usage rate
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Purchases
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Auto Top-Up
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Usage Over Time Line Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Usage Over Time
                  </CardTitle>
                  <CardDescription>Daily credit consumption (last 30 days)</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : usageData?.dailyUsage.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No usage data available
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={usageData?.dailyUsage} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            axisLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            axisLine={false}
                            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                          />
                          <Tooltip
                            formatter={(value: number) => [value.toLocaleString(), 'Credits']}
                          />
                          <Line
                            type="monotone"
                            dataKey="credits"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Usage Breakdown Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Usage Breakdown
                  </CardTitle>
                  <CardDescription>Credits by category</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : pieData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No usage data available
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [value.toLocaleString(), 'Credits']}
                          />
                          <Legend
                            layout="vertical"
                            align="right"
                            verticalAlign="middle"
                            formatter={(value: string) => (
                              <span className="text-xs">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Credit Consumers Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Top Credit Consumers
                </CardTitle>
                <CardDescription>Actions consuming the most credits</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : usageData?.topActions.length === 0 ? (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    No usage data available
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={usageData?.topActions}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                        />
                        <YAxis
                          dataKey="actionName"
                          type="category"
                          tick={{ fontSize: 11 }}
                          width={95}
                        />
                        <Tooltip
                          formatter={(value: number, name: string, props: { payload: UsageByAction }) => [
                            `${value.toLocaleString()} credits (${props.payload.count} times)`,
                            'Usage',
                          ]}
                        />
                        <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Breakdown List */}
            <Card>
              <CardHeader>
                <CardTitle>Usage by Category</CardTitle>
                <CardDescription>Detailed breakdown of credit consumption</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : usageData?.categoryUsage.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No usage data available
                  </div>
                ) : (
                  <div className="space-y-3">
                    {usageData?.categoryUsage.map((cat) => {
                      const totalUsage = usageData.monthUsage || 1;
                      const percent = Math.round((cat.credits / totalUsage) * 100);
                      return (
                        <div key={cat.category} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="font-medium">{cat.displayName}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {cat.credits.toLocaleString()} credits ({percent}%)
                            </span>
                          </div>
                          <Progress value={percent} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Purchase History
                </CardTitle>
                <CardDescription>Your credit purchase transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {purchasesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : purchaseHistory?.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">No purchase history yet</p>
                    <Button onClick={() => setPurchaseModalOpen(true)}>
                      <Coins className="h-4 w-4 mr-2" />
                      Buy Credits
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead className="text-right">Amount Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseHistory?.map((purchase) => {
                          const metadata = purchase.metadata as Record<string, unknown> | null;
                          const pricePaid = metadata?.price_cents as number | undefined;
                          return (
                            <TableRow key={purchase.id}>
                              <TableCell className="whitespace-nowrap">
                                {formatSmartDate(purchase.created_at)}
                              </TableCell>
                              <TableCell>
                                {purchase.description || 'Credit purchase'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                <Badge variant="secondary">
                                  +{purchase.amount.toLocaleString()}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {pricePaid != null ? formatCurrency(pricePaid / 100) : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next Free Grant Info */}
            {nextFreeGrantAt && (
              <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-emerald-800 dark:text-emerald-200">
                        Next Free Credit Grant
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        You'll receive {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} free credits on{' '}
                        <strong>
                          {formatSmartDate(nextFreeGrantAt)}
                        </strong>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Auto Top-Up Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <AutoTopUpSettings
              onPaymentMethodSetup={() => navigate(`/${tenantSlug}/admin/settings?tab=payments`)}
            />

            {/* Upgrade Suggestion */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Zap className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold">Want unlimited usage?</p>
                      <p className="text-sm text-muted-foreground">
                        Upgrade to any paid plan and never worry about credits again.
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => navigate(`/${tenantSlug}/admin/select-plan`)}>
                    View Plans
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Credit Purchase Modal */}
      <CreditPurchaseModal
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
      />
    </div>
  );
}

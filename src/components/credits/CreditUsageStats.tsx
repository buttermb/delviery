/**
 * CreditUsageStats Component
 * 
 * Displays credit usage analytics for free tier users.
 * Shows current balance, usage breakdown, and top actions.
 */

import { useQuery } from '@tanstack/react-query';
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Calendar,
  Activity,
  BarChart3,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  FREE_TIER_MONTHLY_CREDITS,
  getCreditCostInfo,
  getCategoryDisplayName,
  type CreditCategory,
} from '@/lib/credits';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface CreditTransactionRecord {
  amount: number;
  action_type?: string;
  created_at: string;
  transaction_type: string;
}

export interface CreditUsageStatsProps {
  className?: string;
  showUpgradeButton?: boolean;
  onUpgradeClick?: () => void;
  compact?: boolean;
}

interface UsageByCategory {
  category: CreditCategory;
  total: number;
  count: number;
}

interface UsageByAction {
  actionType: string;
  actionName: string;
  total: number;
  count: number;
}

interface DailyUsage {
  date: string;
  total: number;
}

export function CreditUsageStats({
  className,
  showUpgradeButton = true,
  onUpgradeClick,
  compact = false,
}: CreditUsageStatsProps) {
  const { tenant } = useTenantAdminAuth();
  const {
    balance,
    isFreeTier,
    isLoading: _creditsLoading,
    lifetimeSpent: _lifetimeSpent,
    lifetimeEarned: _lifetimeEarned,
    nextFreeGrantAt,
  } = useCredits();

  const tenantId = tenant?.id;

  // Fetch usage data from credit_transactions
  const { data: usageData, isLoading: _usageLoading } = useQuery({
    queryKey: queryKeys.creditWidgets.usageStats(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      try {
        // Get all transactions for the last 30 days
        const { data: transactions, error } = await supabase
          .from('credit_transactions')
          .select('amount, action_type, created_at, transaction_type')
          .eq('tenant_id', tenantId)
          .eq('transaction_type', 'usage')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate today's usage
        const todayTransactions = (transactions ?? []).filter(
          (t: CreditTransactionRecord) => new Date(t.created_at) >= todayStart
        );
        const todayUsage = todayTransactions.reduce(
          (sum: number, t: CreditTransactionRecord) => sum + Math.abs(t.amount),
          0
        );

        // Calculate this week's usage
        const weekTransactions = (transactions ?? []).filter(
          (t: CreditTransactionRecord) => new Date(t.created_at) >= weekStart
        );
        const weekUsage = weekTransactions.reduce(
          (sum: number, t: CreditTransactionRecord) => sum + Math.abs(t.amount),
          0
        );

        // Calculate previous week's usage (for trend comparison)
        const prevWeekStart = new Date();
        prevWeekStart.setDate(prevWeekStart.getDate() - 14);
        const prevWeekEnd = new Date();
        prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

        const prevWeekTransactions = (transactions ?? []).filter(
          (t: CreditTransactionRecord) => {
            const date = new Date(t.created_at);
            return date >= prevWeekStart && date < prevWeekEnd;
          }
        );
        const prevWeekUsage = prevWeekTransactions.reduce(
          (sum: number, t: CreditTransactionRecord) => sum + Math.abs(t.amount),
          0
        );

        // Calculate week-over-week change
        const weekTrend = prevWeekUsage > 0
          ? Math.round(((weekUsage - prevWeekUsage) / prevWeekUsage) * 100)
          : weekUsage > 0 ? 100 : 0;

        // Calculate monthly usage
        const monthUsage = (transactions ?? []).reduce(
          (sum: number, t: CreditTransactionRecord) => sum + Math.abs(t.amount),
          0
        );

        // Group by action type
        const byAction: Record<string, { total: number; count: number }> = {};
        (transactions ?? []).forEach((t: CreditTransactionRecord) => {
          const action = t.action_type || 'unknown';
          if (!byAction[action]) {
            byAction[action] = { total: 0, count: 0 };
          }
          byAction[action].total += Math.abs(t.amount);
          byAction[action].count += 1;
        });

        // Get top actions
        const topActions: UsageByAction[] = Object.entries(byAction)
          .map(([actionType, data]) => {
            const info = getCreditCostInfo(actionType);
            return {
              actionType,
              actionName: info?.actionName || actionType.replace(/_/g, ' '),
              total: data.total,
              count: data.count,
            };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        // Group by category
        const byCategory: Record<string, { total: number; count: number }> = {};
        (transactions ?? []).forEach((t: CreditTransactionRecord) => {
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
            category: category as CreditCategory,
            total: data.total,
            count: data.count,
          }))
          .sort((a, b) => b.total - a.total);

        // Calculate daily usage for the past 7 days
        const dailyUsage: DailyUsage[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const dayTransactions = (transactions ?? []).filter(
            (t: CreditTransactionRecord) =>
              new Date(t.created_at) >= date && new Date(t.created_at) < nextDate
          );
          const dayTotal = dayTransactions.reduce(
            (sum: number, t: CreditTransactionRecord) => sum + Math.abs(t.amount),
            0
          );

          dailyUsage.push({
            date: date.toLocaleDateString('en-US', { weekday: 'short' }),
            total: dayTotal,
          });
        }

        // Estimate depletion date
        const avgDailyUsage = monthUsage / 30;
        const daysUntilDepletion =
          avgDailyUsage > 0 ? Math.floor(balance / avgDailyUsage) : null;

        return {
          todayUsage,
          weekUsage,
          prevWeekUsage,
          weekTrend,
          monthUsage,
          topActions,
          categoryUsage,
          dailyUsage,
          avgDailyUsage: Math.round(avgDailyUsage),
          daysUntilDepletion,
          transactionCount: transactions?.length ?? 0,
        };
      } catch (error) {
        logger.error('Failed to fetch credit usage stats', { error });
        return null;
      }
    },
    enabled: !!tenantId && isFreeTier,
    staleTime: 60 * 1000, // 1 minute
  });

  // Don't render if not on free tier
  if (!isFreeTier) {
    return null;
  }

  const percentRemaining = Math.round((balance / FREE_TIER_MONTHLY_CREDITS) * 100);

  // Compact version for sidebar/small spaces
  if (compact) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Credits</span>
          <Badge variant="outline" className="text-xs">
            {balance.toLocaleString()} / {FREE_TIER_MONTHLY_CREDITS.toLocaleString()}
          </Badge>
        </div>
        <Progress value={percentRemaining} className="h-1.5" />
        {usageData?.todayUsage !== undefined && (
          <div className="text-xs text-muted-foreground">
            Used today: {usageData.todayUsage.toLocaleString()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Balance Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5 text-primary" />
            Credit Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{balance.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                of {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} monthly credits
              </p>
            </div>
            <div className="text-right">
              <Badge
                variant="outline"
                className={cn(
                  balance > 5000
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : balance > 1000
                      ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                      : 'bg-red-500/10 text-red-600 border-red-500/20'
                )}
              >
                {percentRemaining}% remaining
              </Badge>
            </div>
          </div>

          <Progress
            value={percentRemaining}
            className={cn(
              'h-2',
              balance > 5000
                ? '[&>div]:bg-emerald-500'
                : balance > 1000
                  ? '[&>div]:bg-yellow-500'
                  : '[&>div]:bg-red-500'
            )}
          />

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <p className="text-xl font-semibold">
                {usageData?.todayUsage?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">
                {usageData?.weekUsage?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">This Week</p>
              {usageData?.weekTrend !== undefined && usageData.weekTrend !== 0 && (
                <div className={cn(
                  "flex items-center justify-center gap-1 text-xs mt-1",
                  usageData.weekTrend > 0 ? "text-red-500" : "text-emerald-500"
                )}>
                  {usageData.weekTrend > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>{Math.abs(usageData.weekTrend)}% vs last</span>
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">
                {usageData?.avgDailyUsage?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Daily Avg</p>
            </div>
          </div>

          {/* Depletion Estimate */}
          {usageData?.daysUntilDepletion !== null && usageData?.daysUntilDepletion !== undefined && (
            <div
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg text-sm',
                usageData.daysUntilDepletion > 14
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : usageData.daysUntilDepletion > 7
                    ? 'bg-yellow-500/10 text-yellow-700'
                    : 'bg-red-500/10 text-red-700'
              )}
            >
              <Calendar className="h-4 w-4" />
              <span>
                {usageData.daysUntilDepletion > 0 ? (
                  <>
                    At current pace, credits will last{' '}
                    <strong>~{usageData.daysUntilDepletion} days</strong>
                  </>
                ) : (
                  <>Credits depleted</>
                )}
              </span>
            </div>
          )}

          {/* Next Refresh */}
          {nextFreeGrantAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>
                Credits refresh on{' '}
                {formatSmartDate(nextFreeGrantAt)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Actions */}
      {usageData?.topActions && usageData.topActions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Top Credit-Consuming Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usageData.topActions.map((action, index) => (
                <div
                  key={action.actionType}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-4">
                      {index + 1}.
                    </span>
                    <div>
                      <p className="text-sm font-medium">{action.actionName}</p>
                      <p className="text-xs text-muted-foreground">
                        {action.count} times
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {action.total.toLocaleString()} credits
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage by Category */}
      {usageData?.categoryUsage && usageData.categoryUsage.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              Usage by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usageData.categoryUsage.map((cat) => {
                const totalUsage = usageData.monthUsage || 1;
                const percent = Math.round((cat.total / totalUsage) * 100);
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{getCategoryDisplayName(cat.category)}</span>
                      <span className="text-muted-foreground">
                        {cat.total.toLocaleString()} ({percent}%)
                      </span>
                    </div>
                    <Progress value={percent} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade CTA */}
      {showUpgradeButton && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Tired of counting credits?</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade to any paid plan for unlimited usage
                </p>
              </div>
              <Button onClick={onUpgradeClick} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Upgrade
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








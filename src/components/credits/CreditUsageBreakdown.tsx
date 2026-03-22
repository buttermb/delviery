/**
 * CreditUsageBreakdown Component
 *
 * Displays a breakdown of credit usage by category and top actions
 * for the last 30 days. Available to all users (free and paid tiers).
 */

import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { getCreditCostInfo, getCategoryDisplayName, type CreditCategory } from '@/lib/credits';
import { queryKeys } from '@/lib/queryKeys';

// ============================================================================
// Types
// ============================================================================

interface UsageByCategory {
  category: CreditCategory;
  displayName: string;
  total: number;
  count: number;
  percent: number;
}

interface UsageByAction {
  actionType: string;
  actionName: string;
  total: number;
  count: number;
}

interface UsagePeriodSummary {
  todayUsage: number;
  weekUsage: number;
  monthUsage: number;
  weekTrend: number;
  avgDailyUsage: number;
}

interface UsageBreakdownData {
  summary: UsagePeriodSummary;
  topActions: UsageByAction[];
  categoryBreakdown: UsageByCategory[];
}

export interface CreditUsageBreakdownProps {
  className?: string;
}

// ============================================================================
// Data Fetching
// ============================================================================

interface TransactionRecord {
  amount: number;
  action_type: string | null;
  created_at: string;
}

function computeBreakdown(transactions: TransactionRecord[]): UsageBreakdownData {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const prevWeekStart = new Date(now);
  prevWeekStart.setDate(prevWeekStart.getDate() - 14);

  let todayUsage = 0;
  let weekUsage = 0;
  let prevWeekUsage = 0;
  let monthUsage = 0;

  const byAction: Record<string, { total: number; count: number }> = {};
  const byCategory: Record<string, { total: number; count: number }> = {};

  for (const t of transactions) {
    const amount = Math.abs(t.amount);
    const createdAt = new Date(t.created_at);
    const actionKey = t.action_type || 'unknown';

    monthUsage += amount;

    if (createdAt >= todayStart) {
      todayUsage += amount;
    }
    if (createdAt >= weekStart) {
      weekUsage += amount;
    }
    if (createdAt >= prevWeekStart && createdAt < weekStart) {
      prevWeekUsage += amount;
    }

    // Group by action
    if (!byAction[actionKey]) {
      byAction[actionKey] = { total: 0, count: 0 };
    }
    byAction[actionKey].total += amount;
    byAction[actionKey].count += 1;

    // Group by category
    const info = getCreditCostInfo(actionKey);
    const category = info?.category || 'other';
    if (!byCategory[category]) {
      byCategory[category] = { total: 0, count: 0 };
    }
    byCategory[category].total += amount;
    byCategory[category].count += 1;
  }

  // Week-over-week trend
  const weekTrend =
    prevWeekUsage > 0
      ? Math.round(((weekUsage - prevWeekUsage) / prevWeekUsage) * 100)
      : weekUsage > 0
        ? 100
        : 0;

  // Top actions (limit 5)
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

  // Category breakdown with percentages
  const totalUsage = monthUsage || 1;
  const categoryBreakdown: UsageByCategory[] = Object.entries(byCategory)
    .map(([cat, data]) => ({
      category: cat as CreditCategory,
      displayName: getCategoryDisplayName(cat as CreditCategory),
      total: data.total,
      count: data.count,
      percent: Math.round((data.total / totalUsage) * 100),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    summary: {
      todayUsage,
      weekUsage,
      monthUsage,
      weekTrend,
      avgDailyUsage: Math.round(monthUsage / 30),
    },
    topActions,
    categoryBreakdown,
  };
}

function useUsageBreakdown(tenantId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.creditWidgets.usageBreakdown(tenantId, 30),
    queryFn: async (): Promise<UsageBreakdownData | null> => {
      if (!tenantId) return null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      try {
        const { data: transactions, error } = await supabase
          .from('credit_transactions')
          .select('amount, action_type, created_at')
          .eq('tenant_id', tenantId)
          .eq('transaction_type', 'usage')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!transactions || transactions.length === 0) return null;

        return computeBreakdown(transactions);
      } catch (error) {
        logger.error('Failed to fetch credit usage breakdown', { error });
        return null;
      }
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

function UsageSummaryRow({ summary }: { summary: UsagePeriodSummary }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center">
        <p className="text-2xl font-bold">{summary.todayUsage.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">Today</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold">{summary.weekUsage.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">This Week</p>
        {summary.weekTrend !== 0 && (
          <div
            className={cn(
              'flex items-center justify-center gap-1 text-xs mt-1',
              summary.weekTrend > 0 ? 'text-red-500' : 'text-emerald-500'
            )}
          >
            {summary.weekTrend > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{Math.abs(summary.weekTrend)}% vs last</span>
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold">{summary.monthUsage.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">Last 30 Days</p>
        <p className="text-xs text-muted-foreground mt-1">
          ~{summary.avgDailyUsage}/day avg
        </p>
      </div>
    </div>
  );
}

function TopActionsList({ actions }: { actions: UsageByAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      {actions.map((action, index) => (
        <div key={action.actionType} className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-muted-foreground text-sm w-4 flex-shrink-0">
              {index + 1}.
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{action.actionName}</p>
              <p className="text-xs text-muted-foreground">{action.count} times</p>
            </div>
          </div>
          <Badge variant="secondary" className="flex-shrink-0">
            {action.total.toLocaleString()} credits
          </Badge>
        </div>
      ))}
    </div>
  );
}

function CategoryBreakdownList({ categories }: { categories: UsageByCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.category} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{cat.displayName}</span>
            <span className="text-muted-foreground">
              {cat.total.toLocaleString()} ({cat.percent}%)
            </span>
          </div>
          <Progress value={cat.percent} className="h-1.5" />
        </div>
      ))}
    </div>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="col-span-full space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-16 mx-auto" />
                <Skeleton className="h-3 w-12 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CreditUsageBreakdown({ className }: CreditUsageBreakdownProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { data, isLoading } = useUsageBreakdown(tenantId);

  if (isLoading) {
    return <BreakdownSkeleton />;
  }

  // No usage data — show empty state
  if (!data) {
    return (
      <Card className={cn('col-span-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Usage Breakdown
          </CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No usage data yet</p>
            <p className="text-sm">
              Credit usage will be tracked here as you use the platform.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('col-span-full grid gap-4 grid-cols-1 md:grid-cols-2', className)}>
      {/* Usage Summary */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Usage Breakdown
          </CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <UsageSummaryRow summary={data.summary} />
        </CardContent>
      </Card>

      {/* Top Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Top Actions
          </CardTitle>
          <CardDescription>Most credit-consuming actions</CardDescription>
        </CardHeader>
        <CardContent>
          <TopActionsList actions={data.topActions} />
        </CardContent>
      </Card>

      {/* By Category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            By Category
          </CardTitle>
          <CardDescription>Credit distribution by area</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryBreakdownList categories={data.categoryBreakdown} />
        </CardContent>
      </Card>
    </div>
  );
}

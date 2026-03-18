/**
 * CreditUsageChart Component
 *
 * Displays credit usage analytics with a chart and breakdown by category.
 */

import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getCategoryDisplayName, type CreditCategory } from '@/lib/credits';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { CATEGORY_CHART_COLORS } from '@/lib/chartColors';

export interface CreditUsageChartProps {
  className?: string;
  days?: number;
}

export function CreditUsageChart({ className, days = 30 }: CreditUsageChartProps) {
  const { tenant } = useTenantAdminAuth();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.creditUsage.byTenant(tenant?.id, days),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get transactions for the period
      const { data: transactions, error } = await supabase
        .from('credit_transactions')
        .select('id, amount, metadata, created_at')
        .eq('tenant_id', tenant.id)
        .eq('transaction_type', 'usage')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Aggregate by category
      const byCategory: Record<string, number> = {};
      const byDay: Record<string, number> = {};

      for (const tx of transactions ?? []) {
        // Get category from credit_costs or default
        const metadata = tx.metadata as Record<string, unknown> | null;
        const category = (typeof metadata?.category === 'string' ? metadata.category : 'other');
        byCategory[category] = (byCategory[category] ?? 0) + Math.abs(tx.amount);

        // Aggregate by day
        const day = new Date(tx.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        byDay[day] = (byDay[day] ?? 0) + Math.abs(tx.amount);
      }

      // Convert to chart data
      const categoryData = Object.entries(byCategory)
        .map(([category, credits]) => ({
          category: getCategoryDisplayName(category as CreditCategory) || category,
          credits,
          color: CATEGORY_CHART_COLORS[category as CreditCategory] || CATEGORY_CHART_COLORS['other'] || 'hsl(var(--muted-foreground))',
        }))
        .sort((a, b) => b.credits - a.credits);

      const dailyData = Object.entries(byDay).map(([day, credits]) => ({
        day,
        credits,
      }));

      // Calculate totals
      const totalUsed = (transactions ?? []).reduce(
        (sum, tx) => sum + Math.abs(tx.amount),
        0
      );

      // Get previous period for comparison
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);

      const { data: prevTransactions } = await supabase
        .from('credit_transactions')
        .select('amount')
        .eq('tenant_id', tenant.id)
        .eq('transaction_type', 'usage')
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      const prevTotal = (prevTransactions ?? []).reduce(
        (sum, tx) => sum + Math.abs(tx.amount),
        0
      );

      const changePercent = prevTotal > 0
        ? Math.round(((totalUsed - prevTotal) / prevTotal) * 100)
        : 0;

      return {
        categoryData,
        dailyData,
        totalUsed,
        prevTotal,
        changePercent,
        transactionCount: transactions?.length ?? 0,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const TrendIcon = data.changePercent > 0
    ? TrendingUp
    : data.changePercent < 0
      ? TrendingDown
      : Minus;

  const trendColor = data.changePercent > 0
    ? 'text-red-500'
    : data.changePercent < 0
      ? 'text-green-500'
      : 'text-muted-foreground';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Credit Usage</CardTitle>
            <CardDescription>
              Last {days} days • {data.transactionCount} actions
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {data.totalUsed.toLocaleString()}
            </div>
            <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              <span>
                {Math.abs(data.changePercent)}% vs prev period
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Daily Usage Chart */}
        {data.dailyData.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), 'Credits']}
                />
                <Bar dataKey="credits" radius={[4, 4, 0, 0]}>
                  {data.dailyData.map((_, index) => (
                    <Cell key={index} fill="hsl(var(--primary))" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category Breakdown */}
        <div>
          <h4 className="text-sm font-medium mb-3">By Category</h4>
          <div className="space-y-2">
            {data.categoryData.slice(0, 5).map((item) => (
              <div key={item.category} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{item.category}</span>
                    <span className="text-sm font-medium">
                      {item.credits.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(item.credits / data.totalUsed) * 100}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Actions */}
        {data.categoryData.length > 5 && (
          <div className="flex flex-wrap gap-2">
            {data.categoryData.slice(5).map((item) => (
              <Badge
                key={item.category}
                variant="secondary"
                className="text-xs"
              >
                {item.category}: {item.credits.toLocaleString()}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

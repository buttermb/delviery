/**
 * CreditBalanceCard Component
 *
 * Displays the current credit balance as a prominent card with:
 * - Large balance number with "credits" label
 * - Optional mini sparkline chart of balance over time
 * - Low balance warning when below threshold
 * - Buy more button
 *
 * Used on the dashboard and credits page.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCredits } from '@/contexts/CreditContext';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LOW_CREDIT_WARNING_THRESHOLD, CRITICAL_CREDIT_THRESHOLD } from '@/lib/credits';
import Coins from "lucide-react/dist/esm/icons/coins";
import Plus from "lucide-react/dist/esm/icons/plus";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";

export interface CreditBalanceCardProps {
  className?: string;
  showChart?: boolean;
  chartDays?: number;
}

interface BalanceDataPoint {
  date: string;
  balance: number;
}

export function CreditBalanceCard({
  className,
  showChart = true,
  chartDays = 14,
}: CreditBalanceCardProps) {
  const { credits, isFreeTier, setIsPurchaseModalOpen } = useCredits();
  const { tenant } = useTenantAdminAuth();

  // Fetch balance history for sparkline
  const { data: balanceHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['credit-balance-history', tenant?.id, chartDays],
    queryFn: async (): Promise<BalanceDataPoint[]> => {
      if (!tenant?.id) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - chartDays);

      const { data: transactions } = await supabase
        .from('credit_transactions')
        .select('amount, created_at, transaction_type')
        .eq('tenant_id', tenant.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!transactions || transactions.length === 0) return [];

      // Build daily balance snapshots by working backwards from current balance
      const dailyChanges = new Map<string, number>();
      for (const tx of transactions) {
        const day = new Date(tx.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        dailyChanges.set(day, (dailyChanges.get(day) || 0) + tx.amount);
      }

      // Generate date labels for the period
      const dates: string[] = [];
      for (let i = chartDays; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(
          d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        );
      }

      // Calculate running balance (work backwards from current balance)
      const totalChangeAfter = new Map<string, number>();
      let runningSum = 0;
      for (let i = dates.length - 1; i >= 0; i--) {
        totalChangeAfter.set(dates[i], runningSum);
        runningSum += dailyChanges.get(dates[i]) || 0;
      }

      return dates.map((date) => ({
        date,
        balance: credits - (totalChangeAfter.get(date) || 0),
      }));
    },
    enabled: showChart && !!tenant?.id && isFreeTier,
    staleTime: 5 * 60 * 1000,
  });

  // Determine warning level
  const warningLevel = useMemo(() => {
    if (!isFreeTier) return 'none';
    if (credits <= CRITICAL_CREDIT_THRESHOLD) return 'critical';
    if (credits <= LOW_CREDIT_WARNING_THRESHOLD) return 'low';
    return 'none';
  }, [credits, isFreeTier]);

  // Color styling based on balance level
  const getBalanceColor = () => {
    switch (warningLevel) {
      case 'critical':
        return 'text-red-600';
      case 'low':
        return 'text-amber-600';
      default:
        return 'text-foreground';
    }
  };

  const getChartColor = () => {
    switch (warningLevel) {
      case 'critical':
        return 'hsl(0, 72%, 51%)'; // red-600
      case 'low':
        return 'hsl(45, 93%, 47%)'; // amber-600
      default:
        return 'hsl(var(--primary))';
    }
  };

  // Don't render for paid tier
  if (!isFreeTier) {
    return null;
  }

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Credit Balance
        </CardTitle>
        <Coins className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Large balance display */}
        <div>
          <div className={cn('text-3xl font-bold tabular-nums', getBalanceColor())}>
            {credits.toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground">credits remaining</p>
        </div>

        {/* Low balance warning */}
        {warningLevel !== 'none' && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              warningLevel === 'critical'
                ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
            )}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              {warningLevel === 'critical'
                ? 'Credits critically low. Actions will be blocked soon.'
                : 'Credits running low. Consider topping up.'}
            </span>
          </div>
        )}

        {/* Mini sparkline chart */}
        {showChart && (
          <div className="h-[48px]">
            {historyLoading ? (
              <Skeleton className="h-full w-full" />
            ) : balanceHistory && balanceHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceHistory}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={getChartColor()}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={getChartColor()}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={getChartColor()}
                    fill="url(#balanceGradient)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        )}

        {/* Buy more button */}
        <Button
          onClick={() => setIsPurchaseModalOpen(true)}
          variant={warningLevel === 'critical' ? 'destructive' : 'outline'}
          size="sm"
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Buy More Credits
        </Button>
      </CardContent>
    </Card>
  );
}

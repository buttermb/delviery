/**
 * Revenue Chart Widget
 * Displays revenue trends and analytics
 */

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatPercentage } from '@/lib/utils/formatPercentage';
import { format, subDays, startOfDay } from 'date-fns';

export function RevenueChartWidget() {
  const { account } = useAccount();

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['revenue-chart', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      const today = new Date();
      const last30Days = subDays(today, 30);

      interface OrderRow {
        total_amount: number;
        created_at: string;
        status: string;
      }

      // Get orders from last 30 days
      // @ts-expect-error - Complex Supabase query exceeds TypeScript recursion depth limit
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('total_amount, created_at, status')
        .eq('account_id', account.id)
        .gte('created_at', last30Days.toISOString())
        .order('created_at', { ascending: true});

      if (!orders) return null;

      // Calculate daily revenue
      const dailyRevenue = new Map<string, number>();
      (orders as OrderRow[]).forEach((order) => {
        if (order.status === 'completed' || order.status === 'delivered') {
          const date = format(startOfDay(new Date(order.created_at)), 'yyyy-MM-dd');
          const amount = Number(order.total_amount || 0);
          dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + amount);
        }
      });

      // Calculate totals
      const totalRevenue = (orders as OrderRow[]).reduce((sum, order) => {
        if (order.status === 'completed' || order.status === 'delivered') {
          return sum + Number(order.total_amount || 0);
        }
        return sum;
      }, 0);

      const yesterday = subDays(today, 1);
      const yesterdayRevenue = (orders as OrderRow[])
        .filter((order) => {
          const orderDate = new Date(order.created_at);
          return (
            format(orderDate, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd') &&
            (order.status === 'completed' || order.status === 'delivered')
          );
        })
        .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

      const dayBeforeYesterday = subDays(today, 2);
      const dayBeforeRevenue = (orders as OrderRow[])
        .filter((order) => {
          const orderDate = new Date(order.created_at);
          return (
            format(orderDate, 'yyyy-MM-dd') === format(dayBeforeYesterday, 'yyyy-MM-dd') &&
            (order.status === 'completed' || order.status === 'delivered')
          );
        })
        .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

      const changePercent =
        dayBeforeRevenue > 0
          ? ((yesterdayRevenue - dayBeforeRevenue) / dayBeforeRevenue) * 100
          : 0;

      return {
        totalRevenue,
        yesterdayRevenue,
        changePercent,
        dailyRevenue: Array.from(dailyRevenue.entries())
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
    enabled: !!account?.id,
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue (Last 30 Days)
        </h3>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        </div>
      ) : revenueData ? (
        <>
          <div className="mb-4">
            <div className="text-3xl font-bold mb-1">
              {formatCurrency(revenueData.totalRevenue)}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {revenueData.changePercent > 0 ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {formatPercentage(revenueData.changePercent)} vs previous day
                </span>
              ) : revenueData.changePercent < 0 ? (
                <span className="text-red-600">
                  {formatPercentage(revenueData.changePercent)} vs previous day
                </span>
              ) : (
                <span className="text-muted-foreground">No change</span>
              )}
            </div>
          </div>

          {/* Chart placeholder */}
          <div className="h-[200px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Revenue chart visualization</p>
              <p className="text-xs mt-1">
                {revenueData.dailyRevenue.length} data points
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Yesterday</div>
              <div className="text-lg font-semibold">
                {formatCurrency(revenueData.yesterdayRevenue)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">30-Day Avg</div>
              <div className="text-lg font-semibold">
                {formatCurrency(
                  revenueData.totalRevenue / 30
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No revenue data</p>
          </div>
        </div>
      )}
    </Card>
  );
}


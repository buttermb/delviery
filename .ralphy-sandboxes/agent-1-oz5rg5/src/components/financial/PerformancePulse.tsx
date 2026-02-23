/**
 * Performance Pulse (Zone D)
 * 
 * Business health and trends:
 * - Period Comparison (This month vs Last month)
 * - Top Clients
 * - Margin Trend Sparkline
 */

import { TrendingUp, TrendingDown, Minus, BarChart3, Users, LineChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePerformancePulse } from '@/hooks/useFinancialCommandCenter';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Button } from '@/components/ui/button';
import { formatCompactCurrency } from '@/lib/formatters';

interface TrendIndicatorProps {
  value: number;
  suffix?: string;
}

function TrendIndicator({ value, suffix = '%' }: TrendIndicatorProps) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-0.5 text-zinc-500 text-xs">
        <Minus className="h-3 w-3" />
        0{suffix}
      </span>
    );
  }

  const isPositive = value > 0;
  
  return (
    <span className={cn(
      "flex items-center gap-0.5 text-xs",
      isPositive ? "text-emerald-400" : "text-red-400"
    )}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

export function PerformancePulse() {
  const { data, isLoading } = usePerformancePulse();
  const { navigateToAdmin } = useTenantNavigation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl bg-zinc-800/50" />
        <Skeleton className="h-32 w-full rounded-xl bg-zinc-800/50" />
        <Skeleton className="h-24 w-full rounded-xl bg-zinc-800/50" />
      </div>
    );
  }

  // Find max revenue for top clients bar chart
  const maxClientRevenue = Math.max(...(data?.topClients.map(c => c.revenue) || [1]));

  return (
    <div className="space-y-4">
      {/* Period Comparison */}
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-zinc-300">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            THIS MONTH vs LAST
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {/* Header Row */}
            <div className="grid grid-cols-3 sm:grid-cols-4 text-[9px] sm:text-[10px] uppercase text-zinc-500 pb-2 border-b border-zinc-800 min-w-[200px]">
              <div />
              <div className="text-center">This Month</div>
              <div className="text-center hidden sm:block">Last Month</div>
              <div className="text-right">Change</div>
            </div>

            {/* Revenue */}
            <div className="grid grid-cols-3 sm:grid-cols-4 items-center min-w-[200px]">
              <div className="text-[10px] sm:text-xs text-zinc-400">Revenue</div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-100">
                {formatCompactCurrency(data?.thisMonth.revenue || 0)}
              </div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-500 hidden sm:block">
                {formatCompactCurrency(data?.lastMonth.revenue || 0)}
              </div>
              <div className="text-right">
                <TrendIndicator value={data?.changes.revenue || 0} />
              </div>
            </div>

            {/* COGS */}
            <div className="grid grid-cols-3 sm:grid-cols-4 items-center min-w-[200px]">
              <div className="text-[10px] sm:text-xs text-zinc-400">COGS</div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-100">
                {formatCompactCurrency(data?.thisMonth.cost || 0)}
              </div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-500 hidden sm:block">
                {formatCompactCurrency(data?.lastMonth.cost || 0)}
              </div>
              <div className="text-right">
                <TrendIndicator value={-(data?.changes.cost || 0)} />
              </div>
            </div>

            {/* Profit */}
            <div className="grid grid-cols-3 sm:grid-cols-4 items-center min-w-[200px]">
              <div className="text-[10px] sm:text-xs text-zinc-400">Profit</div>
              <div className="text-center font-mono text-xs sm:text-sm text-emerald-400 font-bold">
                {formatCompactCurrency(data?.thisMonth.profit || 0)}
              </div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-500 hidden sm:block">
                {formatCompactCurrency(data?.lastMonth.profit || 0)}
              </div>
              <div className="text-right">
                <TrendIndicator value={data?.changes.profit || 0} />
              </div>
            </div>

            {/* Margin */}
            <div className="grid grid-cols-3 sm:grid-cols-4 items-center min-w-[200px]">
              <div className="text-[10px] sm:text-xs text-zinc-400">Margin</div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-100">
                {data?.thisMonth.margin || 0}%
              </div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-500 hidden sm:block">
                {data?.lastMonth.margin || 0}%
              </div>
              <div className="text-right">
                <TrendIndicator value={data?.changes.margin || 0} suffix="pp" />
              </div>
            </div>

            {/* Deals */}
            <div className="grid grid-cols-3 sm:grid-cols-4 items-center min-w-[200px]">
              <div className="text-[10px] sm:text-xs text-zinc-400">Deals</div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-100">
                {data?.thisMonth.deals || 0}
              </div>
              <div className="text-center font-mono text-xs sm:text-sm text-zinc-500 hidden sm:block">
                {data?.lastMonth.deals || 0}
              </div>
              <div className="text-right">
                <TrendIndicator value={data?.changes.deals || 0} />
              </div>
            </div>
          </div>

          {/* Insight */}
          {data?.changes.margin && data.changes.margin > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                Margin improving 
                {data.changes.deals < 0 ? ' despite lower volume' : ' with higher volume'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Clients */}
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between text-zinc-300">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-400" />
              TOP PERFORMERS
            </span>
            <span className="text-xs text-zinc-500">This Month</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.topClients.length === 0 ? (
            <div className="text-center py-4 text-zinc-500 text-sm">
              No sales data yet this month
            </div>
          ) : (
            data?.topClients.map((client, index) => (
              <div key={client.name} className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs font-bold text-zinc-500 w-4 flex-shrink-0">
                  {index + 1}.
                </span>
                <span className="text-xs sm:text-sm text-zinc-300 flex-1 truncate min-w-0">
                  {client.name}
                </span>
                <span className="text-xs sm:text-sm font-mono text-zinc-100 w-14 sm:w-20 text-right flex-shrink-0">
                  {formatCompactCurrency(client.revenue)}
                </span>
                <div className="w-16 sm:w-24 flex-shrink-0">
                  <Progress 
                    value={(client.revenue / maxClientRevenue) * 100}
                    className="h-2 bg-zinc-800 [&>div]:bg-emerald-500"
                  />
                </div>
              </div>
            ))
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-zinc-400 hover:text-zinc-200"
            onClick={() => navigateToAdmin('wholesale-clients')}
          >
            Full Rankings
          </Button>
        </CardContent>
      </Card>

      {/* Margin Trend */}
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between text-zinc-300">
            <span className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-purple-400" />
              MARGIN TREND (90 days)
            </span>
            <span className="text-lg font-bold font-mono text-zinc-100">
              {data?.thisMonth.margin || 0}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Simplified Sparkline */}
          <div className="h-16 flex items-end gap-1">
            {data?.marginTrend.map((point, i) => {
              const minMargin = Math.min(...(data?.marginTrend.map(p => p.margin) || [0]));
              const maxMargin = Math.max(...(data?.marginTrend.map(p => p.margin) || [100]));
              const range = maxMargin - minMargin || 1;
              const height = ((point.margin - minMargin) / range) * 100;
              
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                  title={`${point.date}: ${point.margin}%`}
                >
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      i === (data?.marginTrend.length || 0) - 1
                        ? "bg-emerald-500"
                        : "bg-zinc-700"
                    )}
                    style={{ height: `${Math.max(height, 10)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 text-[9px] text-zinc-600">
            {data?.marginTrend.filter((_, i) => i % 4 === 0).map((point, i) => (
              <span key={i}>{point.date}</span>
            ))}
          </div>

          {/* Trend summary */}
          {data?.marginTrend && data.marginTrend.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
              {data.marginTrend[data.marginTrend.length - 1].margin > data.marginTrend[0].margin ? (
                <>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Trending Up
                  </Badge>
                  <span className="text-zinc-500">
                    +{(data.marginTrend[data.marginTrend.length - 1].margin - data.marginTrend[0].margin).toFixed(1)}% over 90 days
                  </span>
                </>
              ) : (
                <>
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Trending Down
                  </Badge>
                  <span className="text-zinc-500">
                    {(data.marginTrend[data.marginTrend.length - 1].margin - data.marginTrend[0].margin).toFixed(1)}% over 90 days
                  </span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


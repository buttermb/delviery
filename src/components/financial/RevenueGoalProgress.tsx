/**
 * Revenue Goal Progress
 *
 * Displays monthly revenue target vs actual with visual progress indicator.
 * Shows trend data and on-track status to help users understand their progress.
 */

import { Target, TrendingUp, TrendingDown, Zap, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRevenueGoalProgress } from '@/hooks/useRevenueGoalProgress';

interface RevenueGoalProgressProps {
  /** Custom monthly revenue target. If not provided, uses last month's revenue */
  targetRevenue?: number;
  /** Optional className for the container */
  className?: string;
}

export function RevenueGoalProgress({ targetRevenue, className }: RevenueGoalProgressProps) {
  const { data, isLoading } = useRevenueGoalProgress({ targetRevenue });

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-48 w-full rounded-xl bg-zinc-800/50" />
        <Skeleton className="h-24 w-full rounded-xl bg-zinc-800/50" />
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  };

  // Clamp progress for the visual bar (max 100%), but show real percentage in text
  const progressBarValue = Math.min(data?.progressPercent || 0, 100);
  const isExceeded = data?.isExceeded || false;
  const isOnTrack = data?.isOnTrack || false;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Progress Card */}
      <Card className="bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 border-zinc-700/50 backdrop-blur-xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <span className="flex items-center gap-2 text-zinc-300">
              <Target className="h-4 w-4 text-primary" />
              MONTHLY REVENUE GOAL
            </span>
            <span className="text-xs text-zinc-500">{data?.currentMonthLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {/* Progress Display */}
          <div className="mb-4">
            {/* Actual vs Target */}
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  'text-3xl font-bold font-mono',
                  isExceeded ? 'text-emerald-400' : 'text-zinc-100'
                )}>
                  {formatCurrency(data?.actualRevenue || 0)}
                </span>
                <span className="text-zinc-500 text-sm">
                  / {formatCurrency(data?.targetRevenue || 0)}
                </span>
              </div>
              <span className={cn(
                'text-xl font-bold font-mono',
                isExceeded ? 'text-emerald-400' : isOnTrack ? 'text-blue-400' : 'text-amber-400'
              )}>
                {data?.progressPercent || 0}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <Progress
                value={progressBarValue}
                className={cn(
                  'h-4 bg-zinc-800',
                  isExceeded
                    ? '[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-emerald-400'
                    : isOnTrack
                      ? '[&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-blue-400'
                      : '[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-amber-400'
                )}
              />
              {isExceeded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white/90">GOAL EXCEEDED!</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Remaining */}
            <div className="text-center p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <div className="text-lg font-bold font-mono text-zinc-100">
                {formatCurrency(data?.remainingAmount || 0)}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">Remaining</div>
            </div>

            {/* Days Left */}
            <div className="text-center p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <div className="flex items-center justify-center gap-1">
                <Calendar className="h-4 w-4 text-zinc-400" />
                <span className="text-lg font-bold font-mono text-zinc-100">
                  {data?.daysRemaining || 0}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">Days Left</div>
            </div>

            {/* Daily Target */}
            <div className="text-center p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <div className="flex items-center justify-center gap-1">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-lg font-bold font-mono text-zinc-100">
                  {formatCurrency(data?.dailyTargetNeeded || 0)}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">Needed/Day</div>
            </div>

            {/* Orders */}
            <div className="text-center p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <div className="text-lg font-bold font-mono text-zinc-100">
                {data?.orderCount || 0}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">Orders</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status & Trends Card */}
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardContent className="py-4">
          {/* On Track Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isExceeded ? (
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              ) : isOnTrack ? (
                <CheckCircle className="h-5 w-5 text-blue-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              <span className="text-sm font-medium text-zinc-300">
                {isExceeded
                  ? 'Goal Exceeded'
                  : isOnTrack
                    ? 'On Track'
                    : 'Behind Pace'}
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                isExceeded
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : isOnTrack
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              )}
            >
              {formatCurrency(data?.currentDailyAverage || 0)}/day avg
            </Badge>
          </div>

          {/* Month over Month Comparison */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
            <span className="text-sm text-zinc-400">vs Last Month</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-zinc-500">
                {formatCurrency(data?.lastMonthRevenue || 0)}
              </span>
              {(data?.monthOverMonthChange ?? 0) !== 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    (data?.monthOverMonthChange ?? 0) >= 0
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/30 bg-red-500/10 text-red-400'
                  )}
                >
                  {(data?.monthOverMonthChange ?? 0) >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {(data?.monthOverMonthChange ?? 0) >= 0 ? '+' : ''}
                  {data?.monthOverMonthChange}%
                </Badge>
              )}
            </div>
          </div>

          {/* Insight */}
          {!isExceeded && data?.daysRemaining && data.daysRemaining > 0 && (
            <div className={cn(
              'mt-3 p-3 rounded-lg border text-xs',
              isOnTrack
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            )}>
              {isOnTrack ? (
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  At current pace, you&apos;ll exceed your goal by{' '}
                  {formatCurrency(
                    (data.currentDailyAverage * (data.daysRemaining +
                      Math.ceil(data.actualRevenue / data.currentDailyAverage))) -
                      data.targetRevenue
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Need {formatCurrency(data.dailyTargetNeeded)}/day to hit goal
                  ({Math.round(((data.dailyTargetNeeded / data.currentDailyAverage) - 1) * 100)}% increase needed)
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

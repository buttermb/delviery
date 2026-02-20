/**
 * Cash Flow Pulse (Zone A)
 * 
 * The heartbeat of the business - shows cash health RIGHT NOW:
 * - Today's Cash Movement (Hero Card)
 * - Weekly Cash Forecast
 * - Cash Runway Indicator
 */

import { ArrowDownRight, ArrowUpRight, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCashFlowPulse } from '@/hooks/useFinancialCommandCenter';
import { format } from 'date-fns';
import { formatCompactCurrency } from '@/lib/formatters';

export function CashFlowPulse() {
  const { data, isLoading } = useCashFlowPulse();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl bg-zinc-800/50" />
        <Skeleton className="h-32 w-full rounded-xl bg-zinc-800/50" />
        <Skeleton className="h-24 w-full rounded-xl bg-zinc-800/50" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Today's Cash Movement - Hero Card */}
      <Card className="bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 border-zinc-700/50 backdrop-blur-xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <span className="flex items-center gap-2 text-zinc-300">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              TODAY&apos;S CASH FLOW
            </span>
            <span className="text-xs text-zinc-500">{format(new Date(), 'MMM d, yyyy')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Money In */}
            <div className="text-center p-3 sm:p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 mx-auto mb-1.5 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                {formatCompactCurrency(data?.todayIn || 0)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">IN</div>
              <div className="text-[10px] text-emerald-400/70 mt-1">
                {data?.paymentsReceived || 0} payments
              </div>
            </div>

            {/* Money Out */}
            <div className="text-center p-3 sm:p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-red-400 mx-auto mb-1.5 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-red-400 font-mono">
                {formatCompactCurrency(data?.todayOut || 0)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">OUT</div>
              <div className="text-[10px] text-red-400/70 mt-1">
                {data?.payoutsProcessed || 0} payouts
              </div>
            </div>

            {/* Net */}
            <div className={cn(
              "text-center p-3 sm:p-4 rounded-lg border",
              (data?.todayNet || 0) >= 0 
                ? "bg-emerald-500/10 border-emerald-500/20" 
                : "bg-red-500/10 border-red-500/20"
            )}>
              <div className="text-xl sm:text-2xl font-bold font-mono" style={{
                color: (data?.todayNet || 0) >= 0 ? '#34d399' : '#f87171'
              }}>
                {(data?.todayNet || 0) >= 0 ? '+' : ''}{formatCompactCurrency(data?.todayNet || 0)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">NET</div>
              <Progress 
                value={Math.min(100, Math.abs((data?.todayNet || 0) / 1000) * 10)} 
                className="h-1.5 mt-2 bg-zinc-800"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Forecast */}
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">
            THIS WEEK&apos;S OUTLOOK
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-20 mb-4">
            {data?.weeklyForecast.map((day, i) => {
              const maxAmount = Math.max(...(data?.weeklyForecast.map(d => d.amount) || [1]));
              const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className={cn(
                      "w-full rounded-t transition-all",
                      day.isToday && "ring-2 ring-emerald-400/50",
                      day.isPast ? "bg-emerald-500/80" : "bg-zinc-700/50"
                    )}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  <div className={cn(
                    "text-[10px] font-medium",
                    day.isToday ? "text-emerald-400" : "text-zinc-500"
                  )}>
                    {day.day}
                  </div>
                  <div className={cn(
                    "text-[9px] font-mono",
                    day.isPast ? "text-emerald-400/70" : "text-zinc-600"
                  )}>
                    {day.amount > 0 ? `+${(day.amount / 1000).toFixed(1)}k` : '?'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-zinc-800">
            <div className="text-center">
              <div className="text-[10px] sm:text-xs text-zinc-500">Expected In</div>
              <div className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                {formatCompactCurrency(data?.expectedCollections || 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] sm:text-xs text-zinc-500">Scheduled Out</div>
              <div className="text-xs sm:text-sm font-bold text-red-400 font-mono">
                {formatCompactCurrency(data?.scheduledPayouts || 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] sm:text-xs text-zinc-500">Projected Net</div>
              <div className={cn(
                "text-xs sm:text-sm font-bold font-mono",
                (data?.projectedNet || 0) >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {(data?.projectedNet || 0) >= 0 ? '+' : ''}{formatCompactCurrency(data?.projectedNet || 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Runway */}
      <Card className={cn(
        "border backdrop-blur-xl",
        data?.cashRunway.isHealthy 
          ? "bg-zinc-900/80 border-zinc-800/50" 
          : "bg-red-950/30 border-red-800/50"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400 flex items-center gap-2">
              {data?.cashRunway.isHealthy 
                ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                : <AlertTriangle className="h-4 w-4 text-amber-400" />
              }
              RUNWAY
            </span>
            <span className="text-xs text-zinc-500">
              Avg burn: {formatCompactCurrency(data?.cashRunway.avgDailyBurn || 0)}/day
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress 
                value={Math.min(100, ((data?.cashRunway.daysRemaining || 0) / 90) * 100)}
                className={cn(
                  "h-3 bg-zinc-800",
                  data?.cashRunway.isHealthy ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"
                )}
              />
            </div>
            <div className="text-right">
              <div className={cn(
                "text-2xl font-bold font-mono",
                data?.cashRunway.isHealthy ? "text-emerald-400" : "text-amber-400"
              )}>
                {data?.cashRunway.daysRemaining || 0}
              </div>
              <div className="text-[10px] text-zinc-500">days</div>
            </div>
          </div>

          {!data?.cashRunway.isHealthy && (
            <div className="mt-3 text-xs text-amber-400/80 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Below 30-day threshold - consider collections push
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


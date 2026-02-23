/**
 * WeeklyPerformanceReport Component
 *
 * Displays weekly performance metrics for all runners.
 * Includes summary stats, runner breakdown, and top performer highlight.
 */

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  Package,
} from 'lucide-react';

import { useWeeklyPerformanceReport } from '@/hooks/useRunnerMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface WeeklyPerformanceReportProps {
  className?: string;
}

// =============================================================================
// Helper Components
// =============================================================================

function StatCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'info';
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div>
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
    );
  }

  const iconBgColors = {
    default: 'bg-muted',
    success: 'bg-emerald-500/10',
    warning: 'bg-yellow-500/10',
    info: 'bg-blue-500/10',
  };

  const iconColors = {
    default: 'text-muted-foreground',
    success: 'text-emerald-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', iconBgColors[variant])}>
        <Icon className={cn('h-5 w-5', iconColors[variant])} />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function WeeklyPerformanceReport({ className }: WeeklyPerformanceReportProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: report, isLoading, error } = useWeeklyPerformanceReport(weekOffset);

  const weekLabel =
    weekOffset === 0
      ? 'This Week'
      : weekOffset === 1
        ? 'Last Week'
        : `${weekOffset} Weeks Ago`;

  const dateRangeLabel = report
    ? `${format(parseISO(report.weekStart), 'MMM d')} - ${format(parseISO(report.weekEnd), 'MMM d, yyyy')}`
    : '';

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load weekly report</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Weekly Performance Report</CardTitle>
            <CardDescription>
              {isLoading ? <Skeleton className="h-4 w-32" /> : dateRangeLabel}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              disabled={weekOffset >= 12}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-center">{weekLabel}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Deliveries"
            value={report?.totalDeliveries ?? '-'}
            icon={Package}
            variant="info"
            loading={isLoading}
          />
          <StatCard
            title="Avg Delivery Time"
            value={report ? `${report.avgDeliveryTime} min` : '-'}
            icon={Clock}
            variant="default"
            loading={isLoading}
          />
          <StatCard
            title="On-Time Rate"
            value={report ? `${report.onTimeRate}%` : '-'}
            icon={CheckCircle}
            variant="success"
            loading={isLoading}
          />
          <StatCard
            title="Exceptions"
            value={report?.exceptionsCount ?? '-'}
            icon={AlertTriangle}
            variant="warning"
            loading={isLoading}
          />
        </div>

        {/* Top Performer */}
        {report?.topPerformer && (
          <div className="p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Top Performer</div>
                <div className="text-lg font-bold">{report.topPerformer.runnerName}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-yellow-500">{report.topPerformer.deliveries}</div>
                <div className="text-xs text-muted-foreground">deliveries</div>
              </div>
            </div>
          </div>
        )}

        {/* Runner Breakdown Table */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Runner Breakdown</h3>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : report?.runnerBreakdown && report.runnerBreakdown.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Runner</TableHead>
                    <TableHead className="text-right">Deliveries</TableHead>
                    <TableHead className="text-right">Avg Time</TableHead>
                    <TableHead className="text-right">On-Time</TableHead>
                    <TableHead className="text-right">Exceptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.runnerBreakdown.map((runner, index) => (
                    <TableRow key={runner.runnerId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                          <span className="font-medium">{runner.runnerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{runner.deliveries}</TableCell>
                      <TableCell className="text-right font-mono">{runner.avgTime} min</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={runner.onTimeRate} className="w-16 h-2" />
                          <span className="font-mono text-sm">{runner.onTimeRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {runner.exceptions > 0 ? (
                          <Badge variant="destructive" className="font-mono">
                            {runner.exceptions}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono">
                            0
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No delivery data for this week</p>
            </div>
          )}
        </div>

        {/* Performance Insights */}
        {report && report.totalDeliveries > 0 && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Performance Insights</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {report.onTimeRate >= 90 && (
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  Excellent on-time performance this week
                </li>
              )}
              {report.onTimeRate < 80 && (
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  On-time rate below target. Consider optimizing routes.
                </li>
              )}
              {report.exceptionsCount > 5 && (
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  High exception count. Review failed delivery reasons.
                </li>
              )}
              {report.avgDeliveryTime < 45 && (
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  Fast average delivery time this week
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WeeklyPerformanceReport;

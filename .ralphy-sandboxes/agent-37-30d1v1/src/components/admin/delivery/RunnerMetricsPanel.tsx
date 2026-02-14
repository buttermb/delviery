/**
 * RunnerMetricsPanel Component
 *
 * Displays detailed performance metrics for a specific runner.
 * Used in the runner detail view and fleet management.
 */

import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  Star,
  AlertTriangle,
  MapPin,
  Package,
  Minus,
} from 'lucide-react';

import { useRunnerMetrics, type RunnerMetrics } from '@/hooks/useRunnerMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface RunnerMetricsPanelProps {
  runnerId: string;
  className?: string;
  compact?: boolean;
}

// =============================================================================
// Helper Components
// =============================================================================

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24 mt-2" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {(subtitle || trendValue) && (
          <div className="flex items-center gap-2 mt-1">
            {trendValue && (
              <div className={cn('flex items-center gap-0.5 text-xs', trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>{trendValue}</span>
              </div>
            )}
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function RunnerMetricsPanel({ runnerId, className, compact = false }: RunnerMetricsPanelProps) {
  const { data: metrics, isLoading, error } = useRunnerMetrics({ runnerId });

  const formattedMetrics = useMemo(() => {
    if (!metrics) return null;

    return {
      deliveries: metrics.deliveriesCompleted.toLocaleString(),
      avgTime: metrics.avgDeliveryTimeMinutes > 0 ? `${metrics.avgDeliveryTimeMinutes} min` : 'N/A',
      onTimeRate: `${metrics.onTimeRate}%`,
      rating: metrics.customerRating !== null ? metrics.customerRating.toFixed(1) : 'N/A',
      exceptions: metrics.exceptionsCount.toLocaleString(),
      distance: `${metrics.distanceCoveredKm.toFixed(1)} km`,
      weeklyDeliveries: metrics.deliveriesThisWeek.toLocaleString(),
      weekChange:
        metrics.weekOverWeekChange > 0
          ? `+${metrics.weekOverWeekChange}%`
          : `${metrics.weekOverWeekChange}%`,
      weekTrend:
        metrics.weekOverWeekChange > 0 ? 'up' : metrics.weekOverWeekChange < 0 ? 'down' : 'neutral',
    };
  }, [metrics]);

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load runner metrics</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={cn('grid grid-cols-2 gap-3', className)}>
        <MetricCard
          title="Deliveries"
          value={formattedMetrics?.deliveries ?? '-'}
          icon={Package}
          loading={isLoading}
        />
        <MetricCard
          title="On-Time"
          value={formattedMetrics?.onTimeRate ?? '-'}
          icon={CheckCircle}
          loading={isLoading}
        />
        <MetricCard
          title="Avg Time"
          value={formattedMetrics?.avgTime ?? '-'}
          icon={Clock}
          loading={isLoading}
        />
        <MetricCard
          title="Rating"
          value={formattedMetrics?.rating ?? '-'}
          icon={Star}
          loading={isLoading}
        />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {metrics?.runnerName ?? 'Runner'}
              {metrics && (
                <Badge
                  variant={metrics.status === 'active' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {metrics.status}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Performance metrics and statistics</CardDescription>
          </div>
          {formattedMetrics && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">This Week</div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">{formattedMetrics.weeklyDeliveries}</span>
                <span
                  className={cn(
                    'text-xs',
                    formattedMetrics.weekTrend === 'up'
                      ? 'text-emerald-500'
                      : formattedMetrics.weekTrend === 'down'
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                  )}
                >
                  {formattedMetrics.weekChange}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Deliveries"
            value={formattedMetrics?.deliveries ?? '-'}
            subtitle="All time"
            icon={Package}
            loading={isLoading}
          />
          <MetricCard
            title="Avg Delivery Time"
            value={formattedMetrics?.avgTime ?? '-'}
            subtitle="Pickup to delivery"
            icon={Clock}
            loading={isLoading}
          />
          <MetricCard
            title="On-Time Rate"
            value={formattedMetrics?.onTimeRate ?? '-'}
            subtitle="Within 60 min"
            icon={CheckCircle}
            loading={isLoading}
          />
          <MetricCard
            title="Customer Rating"
            value={formattedMetrics?.rating ?? '-'}
            subtitle="Out of 5.0"
            icon={Star}
            loading={isLoading}
          />
          <MetricCard
            title="Exceptions"
            value={formattedMetrics?.exceptions ?? '-'}
            subtitle="Failed deliveries"
            icon={AlertTriangle}
            loading={isLoading}
          />
          <MetricCard
            title="Distance Covered"
            value={formattedMetrics?.distance ?? '-'}
            subtitle="This week"
            icon={MapPin}
            loading={isLoading}
          />
        </div>

        {/* Performance Progress Bars */}
        {metrics && (
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">On-Time Performance</span>
                <span className="font-medium">{metrics.onTimeRate}%</span>
              </div>
              <Progress value={metrics.onTimeRate} className="h-2" />
            </div>

            {metrics.customerRating !== null && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Customer Satisfaction</span>
                  <span className="font-medium">{((metrics.customerRating / 5) * 100).toFixed(0)}%</span>
                </div>
                <Progress value={(metrics.customerRating / 5) * 100} className="h-2" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RunnerMetricsPanel;

/**
 * AnalyticsSkeleton - Loading states for analytics pages
 *
 * Provides skeleton placeholders for:
 * - KPI cards (Revenue, Orders, Avg Order Value)
 * - Chart areas (line, area, bar charts)
 * - Period selector
 * - Full analytics page layout
 *
 * Uses consistent styling with the FloraIQ design system.
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AnalyticsSkeletonProps {
  /** Number of KPI cards to display */
  kpiCount?: number;
  /** Number of chart sections to display */
  chartCount?: number;
  /** Optional class name for the container */
  className?: string;
}

/**
 * Full analytics page skeleton with KPI cards and chart areas
 */
export function AnalyticsSkeleton({
  kpiCount = 3,
  chartCount = 2,
  className,
}: AnalyticsSkeletonProps) {
  return (
    <div
      className={cn('space-y-6', className)}
      role="status"
      aria-label="Loading analytics..."
    >
      {/* Period selector header */}
      <AnalyticsPeriodSelectorSkeleton />

      {/* KPI cards grid */}
      <AnalyticsKPIGridSkeleton count={kpiCount} />

      {/* Chart sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: chartCount }).map((_, i) => (
          <AnalyticsChartSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Period selector skeleton (title + dropdown)
 */
export function AnalyticsPeriodSelectorSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-10 w-[160px] rounded-md" />
    </div>
  );
}

/**
 * KPI card skeleton matching the KPICard component layout
 */
export function AnalyticsKPICardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

interface AnalyticsKPIGridSkeletonProps {
  /** Number of KPI cards */
  count?: number;
}

/**
 * Responsive grid of KPI card skeletons
 */
export function AnalyticsKPIGridSkeleton({ count = 3 }: AnalyticsKPIGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <AnalyticsKPICardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Chart area skeleton with header and chart placeholder
 */
export function AnalyticsChartSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

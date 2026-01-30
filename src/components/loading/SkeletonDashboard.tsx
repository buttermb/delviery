/**
 * SkeletonDashboard - Loading skeleton for dashboard pages
 *
 * This file provides the default SkeletonDashboard component for backward compatibility,
 * and re-exports all widget-specific skeleton components from DashboardSkeleton.tsx
 *
 * Usage:
 * - For general dashboard loading: import { SkeletonDashboard } from '@/components/loading/SkeletonDashboard'
 * - For specific widgets: import { QuickActionsSkeleton, RecentOrdersSkeleton } from '@/components/loading/SkeletonDashboard'
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// Re-export all widget-specific skeletons for convenience
export {
  DashboardSkeleton,
  DashboardHeaderSkeleton,
  StatCardSkeleton,
  StatCardWithTrendSkeleton,
  SectionHeaderSkeleton,
  StatsSectionSkeleton,
  ChartSkeleton,
  PieChartSkeleton,
  QuickActionsSkeleton,
  RealtimeSalesSkeleton,
  StorefrontSummarySkeleton,
  InventoryForecastSkeleton,
  RevenueForecastSkeleton,
  RecentOrdersSkeleton,
  MobileStatsCarouselSkeleton,
  DashboardHubSkeleton,
  WidgetSkeleton,
  WidgetListSkeleton,
} from './DashboardSkeleton';

/**
 * Default dashboard skeleton - preserved for backward compatibility
 * Used as Suspense fallback in App.tsx
 */
export const SkeletonDashboard = () => {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading dashboard...">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


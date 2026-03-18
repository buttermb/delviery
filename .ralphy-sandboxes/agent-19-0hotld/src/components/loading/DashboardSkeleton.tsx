/**
 * DashboardSkeleton - Comprehensive loading states for all dashboard widgets
 *
 * Provides skeleton placeholders for:
 * - Quick Actions widget
 * - Realtime Sales widget
 * - Storefront Summary widget
 * - Inventory Forecast widget
 * - Revenue Forecast widget
 * - Recent Orders widget
 * - Stat cards (Revenue, Orders, Inventory, Customers sections)
 * - Chart placeholders
 *
 * Uses consistent styling with the FloraIQ design system.
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DashboardSkeletonProps {
  /** Optional class name for the container */
  className?: string;
}

/**
 * Full dashboard skeleton with all sections
 */
export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div className={cn('p-6 space-y-6', className)} role="status" aria-label="Loading dashboard...">
      {/* Page header skeleton */}
      <DashboardHeaderSkeleton />

      {/* Stats grid skeleton */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Charts section skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div className="space-y-6">
          <PieChartSkeleton />
          <RecentOrdersSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard header with breadcrumbs, title, and action button
 */
export function DashboardHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" /> {/* Breadcrumb */}
        <Skeleton className="h-8 w-48" /> {/* Title */}
        <Skeleton className="h-4 w-64" /> {/* Description */}
      </div>
      <Skeleton className="h-10 w-28" /> {/* Action button */}
    </div>
  );
}

/**
 * Individual stat card skeleton matching the StatCard component
 */
export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

/**
 * Stat card skeleton with trend indicator
 */
export function StatCardWithTrendSkeleton() {
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

/**
 * Section header skeleton (used for "Revenue", "Orders", etc. sections)
 */
export function SectionHeaderSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

/**
 * Stats section skeleton (header + cards)
 */
interface StatsSectionSkeletonProps {
  cardCount?: number;
  columns?: 2 | 3 | 4;
}

export function StatsSectionSkeleton({ cardCount = 3, columns = 3 }: StatsSectionSkeletonProps) {
  const gridCols = {
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
  };

  return (
    <div className="space-y-3">
      <SectionHeaderSkeleton />
      <div className={cn('grid gap-4 grid-cols-1 sm:grid-cols-2', gridCols[columns])}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Chart skeleton with header
 */
export function ChartSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <Skeleton className="h-6 w-32 mb-1" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

/**
 * Pie/donut chart skeleton
 */
export function PieChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-28 mb-1" />
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <div className="h-[220px] flex items-center justify-center">
          <Skeleton className="h-36 w-36 rounded-full" />
        </div>
        <div className="flex justify-center gap-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Quick actions widget skeleton
 */
export function QuickActionsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Realtime sales widget skeleton (with live badge)
 */
export function RealtimeSalesSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-14 rounded-full" /> {/* Live badge */}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Storefront summary widget skeleton
 */
export function StorefrontSummarySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Inventory forecast widget skeleton
 */
export function InventoryForecastSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center p-3 bg-muted/30 rounded-lg space-y-1">
              <Skeleton className="h-3 w-16 mx-auto" />
              <Skeleton className="h-6 w-12 mx-auto" />
            </div>
          ))}
        </div>
        {/* Chart placeholder */}
        <Skeleton className="h-32 w-full rounded-lg" />
        {/* Legend */}
        <div className="flex justify-center gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Revenue forecast widget skeleton
 */
export function RevenueForecastSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-24 rounded" /> {/* Time range selector */}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-4 bg-muted/30 rounded-lg space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-28" />
              <div className="flex items-center gap-1">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
        {/* Chart */}
        <Skeleton className="h-48 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/**
 * Recent orders widget skeleton
 */
interface RecentOrdersSkeletonProps {
  count?: number;
}

export function RecentOrdersSkeleton({ count = 5 }: RecentOrdersSkeletonProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" /> {/* Badge */}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mobile-optimized stat cards carousel skeleton
 */
interface MobileStatsCarouselSkeletonProps {
  count?: number;
}

export function MobileStatsCarouselSkeleton({ count = 4 }: MobileStatsCarouselSkeletonProps) {
  return (
    <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 snap-x snap-mandatory hide-scrollbar">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="min-w-[240px] sm:min-w-0 snap-center">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard hub page skeleton (matching DashboardHubPage layout)
 */
export function DashboardHubSkeleton() {
  return (
    <div className="p-6 space-y-6" role="status" aria-label="Loading dashboard...">
      {/* Breadcrumbs */}
      <Skeleton className="h-4 w-32" />

      {/* Header with title and badge */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>

      {/* Revenue Section */}
      <StatsSectionSkeleton cardCount={3} columns={3} />

      {/* Orders Section */}
      <StatsSectionSkeleton cardCount={4} columns={4} />

      {/* Inventory Section */}
      <StatsSectionSkeleton cardCount={4} columns={4} />

      {/* Customers Section */}
      <StatsSectionSkeleton cardCount={3} columns={3} />
    </div>
  );
}

/**
 * Widget renderer skeleton - renders the appropriate skeleton for a widget ID
 */
type DashboardWidgetId =
  | 'quick_actions'
  | 'realtime_sales'
  | 'storefront_summary'
  | 'inventory_forecast'
  | 'revenue_forecast'
  | 'recent_orders';

interface WidgetSkeletonProps {
  widgetId: DashboardWidgetId;
}

export function WidgetSkeleton({ widgetId }: WidgetSkeletonProps) {
  switch (widgetId) {
    case 'quick_actions':
      return <QuickActionsSkeleton />;
    case 'realtime_sales':
      return <RealtimeSalesSkeleton />;
    case 'storefront_summary':
      return <StorefrontSummarySkeleton />;
    case 'inventory_forecast':
      return <InventoryForecastSkeleton />;
    case 'revenue_forecast':
      return <RevenueForecastSkeleton />;
    case 'recent_orders':
      return <RecentOrdersSkeleton />;
    default:
      return <StatCardSkeleton />;
  }
}

/**
 * Renders skeleton loading states for multiple widgets
 */
interface WidgetListSkeletonProps {
  widgetIds: DashboardWidgetId[];
  className?: string;
}

export function WidgetListSkeleton({ widgetIds, className }: WidgetListSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {widgetIds.map((widgetId) => (
        <WidgetSkeleton key={widgetId} widgetId={widgetId} />
      ))}
    </div>
  );
}

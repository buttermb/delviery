/**
 * WidgetSkeleton Component
 *
 * A versatile fallback component for lazy-loaded widgets.
 * Provides loading states for various widget types with responsive design.
 *
 * Features:
 * - Multiple variants for different widget types (card, chart, list, table, map)
 * - Customizable height and layout
 * - Accessible with ARIA labels
 * - Matches FloraIQ design system
 *
 * Usage:
 * ```tsx
 * // With React.lazy and Suspense
 * const LazyWidget = lazy(() => import('./MyWidget'));
 *
 * <Suspense fallback={<WidgetSkeleton variant="chart" />}>
 *   <LazyWidget />
 * </Suspense>
 *
 * // With custom height
 * <WidgetSkeleton variant="card" height="lg" />
 * ```
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton as BaseSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Wrapper for Skeleton without role attribute to avoid duplicate status roles
const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <BaseSkeleton className={className} role="presentation" aria-label={undefined} {...props} />
);

export type WidgetSkeletonVariant =
  | 'card'      // Standard card widget with header and content
  | 'chart'     // Chart widget with title and placeholder
  | 'list'      // List widget with multiple items
  | 'table'     // Table widget with rows
  | 'stats'     // Stats/KPI cards
  | 'map'       // Map widget
  | 'minimal';  // Minimal loading state

export type WidgetSkeletonHeight = 'sm' | 'md' | 'lg' | 'xl' | 'auto';

export interface WidgetSkeletonProps {
  /**
   * Visual style variant for different widget types
   * @default 'card'
   */
  variant?: WidgetSkeletonVariant;

  /**
   * Height preset for the widget
   * @default 'auto'
   */
  height?: WidgetSkeletonHeight;

  /**
   * Number of items/rows to show (for list/table variants)
   * @default 3
   */
  itemCount?: number;

  /**
   * Whether to show header section
   * @default true
   */
  showHeader?: boolean;

  /**
   * Custom CSS class for the container
   */
  className?: string;

  /**
   * Custom aria-label for accessibility
   */
  ariaLabel?: string;
}

const heightMap: Record<WidgetSkeletonHeight, string> = {
  sm: 'h-32',
  md: 'h-48',
  lg: 'h-64',
  xl: 'h-96',
  auto: 'h-auto',
};

/**
 * Renders a header skeleton with title and optional subtitle
 */
function WidgetHeaderSkeleton() {
  return (
    <CardHeader className="space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </CardHeader>
  );
}

/**
 * Renders a chart skeleton with header and placeholder area
 */
function ChartSkeletonContent({ height }: { height: WidgetSkeletonHeight }) {
  const chartHeight = height === 'auto' ? 'h-[300px]' : heightMap[height];

  return (
    <Card>
      <WidgetHeaderSkeleton />
      <CardContent>
        <Skeleton className={cn('w-full rounded', chartHeight)} />
      </CardContent>
    </Card>
  );
}

/**
 * Renders a list skeleton with multiple items
 */
function ListSkeletonContent({ itemCount }: { itemCount: number }) {
  return (
    <Card>
      <WidgetHeaderSkeleton />
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: itemCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Renders a table skeleton with header and rows
 */
function TableSkeletonContent({ itemCount }: { itemCount: number }) {
  return (
    <Card>
      <WidgetHeaderSkeleton />
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          {/* Table header */}
          <div className="bg-muted/50 border-b p-3">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          {/* Table rows */}
          <div className="divide-y">
            {Array.from({ length: itemCount }).map((_, i) => (
              <div key={i} className="p-3">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Renders stats/KPI cards skeleton
 */
function StatsSkeletonContent({ itemCount }: { itemCount: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: itemCount }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Renders a map widget skeleton
 */
function MapSkeletonContent({ height }: { height: WidgetSkeletonHeight }) {
  const mapHeight = height === 'auto' ? 'h-[400px]' : heightMap[height];

  return (
    <Card>
      <WidgetHeaderSkeleton />
      <CardContent className="p-0">
        <div className={cn('w-full bg-muted/20 relative overflow-hidden', mapHeight)}>
          {/* Map marker placeholders */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="space-y-4">
              <Skeleton className="h-8 w-8 rounded-full mx-auto" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Renders a standard card skeleton
 */
function CardSkeletonContent({ height }: { height: WidgetSkeletonHeight }) {
  const contentHeight = height === 'auto' ? 'min-h-[200px]' : heightMap[height];

  return (
    <Card>
      <WidgetHeaderSkeleton />
      <CardContent className={cn('space-y-3', contentHeight)}>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="pt-4">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Renders a minimal loading skeleton
 */
function MinimalSkeletonContent({ height }: { height: WidgetSkeletonHeight }) {
  const skeletonHeight = height === 'auto' ? 'h-32' : heightMap[height];

  return (
    <div className="w-full rounded-lg border bg-card p-6">
      <Skeleton className={cn('w-full rounded', skeletonHeight)} />
    </div>
  );
}

/**
 * Main WidgetSkeleton component
 * Provides a versatile loading state for lazy-loaded widgets
 */
export function WidgetSkeleton({
  variant = 'card',
  height = 'auto',
  itemCount = 3,
  showHeader = true,
  className,
  ariaLabel = 'Loading widget...',
}: WidgetSkeletonProps) {
  const content = (() => {
    switch (variant) {
      case 'chart':
        return <ChartSkeletonContent height={height} />;

      case 'list':
        return <ListSkeletonContent itemCount={itemCount} />;

      case 'table':
        return <TableSkeletonContent itemCount={itemCount} />;

      case 'stats':
        return <StatsSkeletonContent itemCount={itemCount} />;

      case 'map':
        return <MapSkeletonContent height={height} />;

      case 'minimal':
        return <MinimalSkeletonContent height={height} />;

      case 'card':
      default:
        return <CardSkeletonContent height={height} />;
    }
  })();

  return (
    <div
      className={cn('animate-pulse', className)}
      role="status"
      aria-label={ariaLabel}
    >
      {content}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}

/**
 * Utility function to create a WidgetSkeleton with specific props
 * Useful for consistent fallback across the app
 */
export function createWidgetSkeleton(props: Partial<WidgetSkeletonProps> = {}) {
  return function WidgetSkeletonFallback() {
    return <WidgetSkeleton {...props} />;
  };
}

// Export default for convenience
export default WidgetSkeleton;

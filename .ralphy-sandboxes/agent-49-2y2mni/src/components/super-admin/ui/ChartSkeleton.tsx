/**
 * Chart Skeleton
 * Loading skeleton for charts
 */

export function ChartSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-muted rounded w-48" />
      <div className="h-64 bg-muted rounded" />
      <div className="flex gap-4">
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-4 bg-muted rounded w-24" />
      </div>
    </div>
  );
}


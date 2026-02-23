/**
 * Table Skeleton
 * Loading skeleton for data tables
 */

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-2 animate-pulse dark:bg-gray-800 dark:text-gray-100">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b dark:border-gray-700">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-muted rounded flex-1 dark:bg-gray-700" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="h-4 bg-muted rounded flex-1 dark:bg-gray-700" />
          ))}
        </div>
      ))}
    </div>
  );
}


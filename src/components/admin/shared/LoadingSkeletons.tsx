import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * TableSkeleton - Displays a loading table with configurable rows and columns
 */
interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn("rounded-md border", className)} role="status" aria-label="Loading table...">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} scope="col" className="h-12 px-4 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b">
              {Array.from({ length: cols }).map((_, colIndex) => (
                <td key={colIndex} className="h-14 px-4">
                  <Skeleton
                    className={cn(
                      "h-4",
                      colIndex === 0 ? "w-3/4" : "w-full max-w-[120px]"
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CardSkeleton - Displays a loading card placeholder
 */
interface CardSkeletonProps {
  hasImage?: boolean;
  hasFooter?: boolean;
  className?: string;
}

export function CardSkeleton({ hasImage = false, hasFooter = false, className }: CardSkeletonProps) {
  return (
    <Card className={className} role="status" aria-label="Loading card...">
      {hasImage && (
        <Skeleton className="h-40 w-full rounded-t-lg rounded-b-none" />
      )}
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
      {hasFooter && (
        <div className="flex justify-between p-6 pt-0">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </Card>
  );
}

/**
 * StatCardSkeleton - Displays a loading stat card (used in dashboards)
 */
interface StatCardSkeletonProps {
  className?: string;
}

export function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <Card className={className} role="status" aria-label="Loading stat...">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

/**
 * ListItemSkeleton - Displays a loading list item
 */
interface ListItemSkeletonProps {
  hasAvatar?: boolean;
  hasAction?: boolean;
  className?: string;
}

export function ListItemSkeleton({
  hasAvatar = true,
  hasAction = false,
  className
}: ListItemSkeletonProps) {
  return (
    <div
      className={cn("flex items-center gap-4 p-4 border-b", className)}
      role="status"
      aria-label="Loading list item..."
    >
      {hasAvatar && (
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      )}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {hasAction && (
        <Skeleton className="h-8 w-20 rounded shrink-0" />
      )}
    </div>
  );
}

/**
 * DetailPageSkeleton - Displays a loading detail page layout
 */
interface DetailPageSkeletonProps {
  className?: string;
}

export function DetailPageSkeleton({ className }: DetailPageSkeletonProps) {
  return (
    <div className={cn("p-6 space-y-6", className)} role="status" aria-label="Loading page...">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Main content area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-36" />
            </CardHeader>
            <CardContent>
              <TableSkeleton rows={3} cols={4} />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <ListItemSkeleton key={i} hasAvatar={false} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * FormSkeleton - Displays a loading form layout
 */
interface FormSkeletonProps {
  fields?: number;
  hasButtons?: boolean;
  className?: string;
}

export function FormSkeleton({
  fields = 6,
  hasButtons = true,
  className
}: FormSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)} role="status" aria-label="Loading form...">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: fields }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>

          {hasButtons && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * GridSkeleton - Displays a loading grid of cards
 */
interface GridSkeletonProps {
  items?: number;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function GridSkeleton({ items = 6, cols = 3, className }: GridSkeletonProps) {
  const colsClass = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div
      className={cn("grid gap-4", colsClass[cols], className)}
      role="status"
      aria-label="Loading grid..."
    >
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * ProductGridSkeleton - Displays a loading grid of product card skeletons
 * Mimics the StorefrontProductCard layout (image, badges, name, price, button)
 */
interface ProductGridSkeletonProps {
  items?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}

function ProductCardPlaceholder() {
  return (
    <div
      className="rounded-3xl border overflow-hidden bg-card h-full flex flex-col"
      role="status"
      aria-label="Loading product..."
    >
      {/* Image area - aspect-square */}
      <Skeleton className="aspect-square w-full rounded-none" />

      {/* Content area */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {/* Category label */}
        <Skeleton className="h-3 w-16" />
        {/* Product name */}
        <Skeleton className="h-5 w-3/4" />
        {/* Strain badge */}
        <Skeleton className="h-5 w-20 rounded-full" />
        {/* Price + button row */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ items = 8, columns = 4, className }: ProductGridSkeletonProps) {
  const colsClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <div
      className={cn("grid gap-3 md:gap-6", colsClass[columns], className)}
      role="status"
      aria-label="Loading products..."
    >
      {Array.from({ length: items }).map((_, i) => (
        <ProductCardPlaceholder key={i} />
      ))}
    </div>
  );
}

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type PageSkeletonVariant = 'default' | 'table' | 'cards' | 'form' | 'detail';

interface PageSkeletonProps {
  /** Layout variant to match the page being loaded */
  variant?: PageSkeletonVariant;
  /** Whether to show stat cards above the main content */
  showStats?: boolean;
  /** Number of stat cards to display (default: 4) */
  statCount?: number;
}

/** Header section: title + description + action button */
function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-10 w-28 rounded-md" />
    </div>
  );
}

/** Row of stat/metric cards */
function StatCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Table content skeleton: toolbar + header + rows */
function TableContent() {
  return (
    <div className="space-y-4">
      {/* Toolbar: search + filters */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="border-b bg-muted/50 p-4 flex gap-8">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-8 p-4 border-b last:border-b-0">
            {Array.from({ length: 5 }, (_, j) => (
              <Skeleton key={j} className={j === 0 ? 'h-4 w-32' : 'h-4 w-20'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grid of cards content skeleton */
function CardsContent() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex justify-between pt-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Form content skeleton: labeled fields + submit */
function FormContent() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
        <div className="flex justify-end gap-3 pt-4">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Detail page skeleton: info panel + sidebar */
function DetailContent() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const variantContent: Record<PageSkeletonVariant, () => React.JSX.Element> = {
  default: TableContent,
  table: TableContent,
  cards: CardsContent,
  form: FormContent,
  detail: DetailContent,
};

/**
 * PageSkeleton — route-level Suspense fallback for content pages.
 *
 * Renders inside an already-loaded layout shell (sidebar + header).
 * Use as the fallback for <Suspense> around lazy-loaded route components.
 *
 * @example
 * <Suspense fallback={<PageSkeleton />}>
 *   <LazyOrdersPage />
 * </Suspense>
 *
 * @example
 * <Suspense fallback={<PageSkeleton variant="form" showStats={false} />}>
 *   <LazySettingsPage />
 * </Suspense>
 */
export function PageSkeleton({
  variant = 'default',
  showStats = true,
  statCount = 4,
}: PageSkeletonProps) {
  const Content = variantContent[variant];

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-200" role="status" aria-label="Loading page content">
      <PageHeader />
      {showStats && <StatCards count={statCount} />}
      <Content />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

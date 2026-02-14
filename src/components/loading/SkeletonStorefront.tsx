import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export const SkeletonStorefront = () => {
  return (
    <div className="min-h-dvh bg-background">
      {/* Header skeleton */}
      <div className="h-16 border-b flex items-center justify-between px-4 md:px-6">
        <Skeleton className="h-8 w-28" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Hero / banner */}
        <Skeleton className="h-40 w-full rounded-lg" />

        {/* Product grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-40 w-full rounded-t-lg" />
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

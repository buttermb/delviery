import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const SkeletonCourier = () => {
  return (
    <div className="min-h-dvh bg-background">
      {/* Mobile header skeleton */}
      <div className="h-14 border-b flex items-center justify-between px-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Content skeleton */}
      <div className="p-4 space-y-4">
        {/* Status card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>

        {/* Active delivery card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded" />
              <Skeleton className="h-10 flex-1 rounded" />
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 text-center space-y-1">
                <Skeleton className="h-6 w-12 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

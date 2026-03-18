/**
 * Post Skeleton Component
 * Loading skeleton for posts
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function PostSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex">
          {/* Vote skeleton */}
          <div className="w-12 bg-muted/30 flex flex-col items-center py-4 gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>

          {/* Content skeleton */}
          <div className="flex-1 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex items-center gap-3 pt-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


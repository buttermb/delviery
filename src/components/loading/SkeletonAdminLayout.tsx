import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export const SkeletonAdminLayout = () => {
  return (
    <div className="flex h-dvh bg-background">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 border-r bg-muted/40 p-4">
        <div className="space-y-4 w-full">
          {/* Logo */}
          <Skeleton className="h-8 w-32" />
          
          {/* Search */}
          <Skeleton className="h-10 w-full" />
          
          {/* Navigation items */}
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="h-16 border-b flex items-center justify-between px-6">
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Page title */}
          <Skeleton className="h-10 w-64 mb-6" />
          
          {/* Content cards */}
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


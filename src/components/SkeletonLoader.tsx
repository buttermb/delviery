import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

export function OrderCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="relative overflow-hidden bg-card/50 border border-border/50">
      {/* Badge placeholders */}
      <div className="absolute top-2 md:top-3 left-2 md:left-3 z-20 flex flex-col gap-1.5 md:gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Image area — matches h-72 from ProductCard */}
      <Skeleton className="h-72 w-full rounded-none" />

      <CardContent className="p-6 space-y-4">
        {/* Product name + strain */}
        <div>
          <Skeleton className="h-6 w-3/4 mb-1" />
          <Skeleton className="h-4 w-1/3" />
        </div>

        {/* Price */}
        <Skeleton className="h-10 w-24" />

        {/* Rating + reviews */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Stock badges */}
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0 flex flex-col gap-3">
        {/* Add to Cart button */}
        <Skeleton className="h-12 w-full rounded-md" />
        {/* View Details button */}
        <Skeleton className="h-10 w-full rounded-md" />
      </CardFooter>
    </Card>
  );
}

export function GiveawayEntrySkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  );
}

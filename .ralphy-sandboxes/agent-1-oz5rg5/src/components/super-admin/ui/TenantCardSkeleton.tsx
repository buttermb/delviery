/**
 * Tenant Card Skeleton
 * Loading skeleton for tenant cards
 */

export function TenantCardSkeleton() {
  return (
    <div className="p-4 border rounded-lg space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 bg-muted rounded w-32" />
        <div className="h-4 bg-muted rounded w-16" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-muted rounded w-20" />
        <div className="h-6 bg-muted rounded w-24" />
      </div>
    </div>
  );
}


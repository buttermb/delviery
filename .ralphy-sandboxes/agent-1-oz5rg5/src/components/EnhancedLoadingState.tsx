import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EnhancedLoadingStateProps {
  variant?: 'card' | 'list' | 'table' | 'hero' | 'grid' | 'spinner' | 'dashboard';
  count?: number;
  message?: string;
  className?: string;
}

export const EnhancedLoadingState = ({
  variant = 'card',
  count = 3,
  message = "Loading...",
  className
}: EnhancedLoadingStateProps) => {
  if (variant === 'hero') {
    return (
      <div className="min-h-[600px] flex items-center justify-center" role="status" aria-live="polite">
        <div className="container px-4 mx-auto max-w-4xl space-y-8">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-20 w-full max-w-3xl mx-auto" />
          <Skeleton className="h-16 w-96 mx-auto" />
          <div className="flex gap-4 justify-center">
            <Skeleton className="h-14 w-40" />
            <Skeleton className="h-14 w-40" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="status" aria-live="polite" aria-label={message}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-48 w-full" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full mt-4" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-4" role="status" aria-live="polite" aria-label={message}>
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-4" role="status" aria-live="polite" aria-label={message}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'spinner') {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-[400px] gap-4", className)} role="status" aria-live="polite">
        <div className="relative" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-full blur-xl animate-pulse" />
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent relative z-10" />
        </div>
        <p className="text-muted-foreground animate-pulse font-medium">{message}</p>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn("space-y-6 p-6", className)} role="status" aria-live="polite" aria-label={message}>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-live="polite" aria-label={message}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-6 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ))}
    </div>
  );
};


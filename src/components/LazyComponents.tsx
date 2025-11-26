/**
 * Lazy Loaded Components
 * Heavy components that are code-split for better initial load performance
 */

import React, { Suspense, ComponentType, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

/**
 * Loading fallback for lazy components
 */
function DefaultFallback() {
  return (
    <div className="flex items-center justify-center p-8 min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Chart loading skeleton
 */
function ChartSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[250px] w-full" />
    </div>
  );
}

/**
 * Map loading skeleton
 */
function MapSkeleton() {
  return (
    <div className="relative">
      <Skeleton className="h-[400px] w-full rounded-lg" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Table loading skeleton
 */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * Generic lazy wrapper with error boundary
 */
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function LazyWrapper({ children, fallback = <DefaultFallback /> }: LazyWrapperProps) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

/**
 * Create a lazy component with a custom fallback
 */
export function createLazyComponent<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  fallback: React.ReactNode = <DefaultFallback />
) {
  const LazyComponent = lazy(importFn);
  
  return function LazyLoadedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// ============================================
// Lazy loaded heavy components
// ============================================

/**
 * Recharts components (lazy loaded)
 */
export const LazyLineChart = createLazyComponent(
  () => import('recharts').then(m => ({ default: m.LineChart as ComponentType<unknown> })),
  <ChartSkeleton />
);

export const LazyBarChart = createLazyComponent(
  () => import('recharts').then(m => ({ default: m.BarChart as ComponentType<unknown> })),
  <ChartSkeleton />
);

export const LazyPieChart = createLazyComponent(
  () => import('recharts').then(m => ({ default: m.PieChart as ComponentType<unknown> })),
  <ChartSkeleton />
);

export const LazyAreaChart = createLazyComponent(
  () => import('recharts').then(m => ({ default: m.AreaChart as ComponentType<unknown> })),
  <ChartSkeleton />
);

/**
 * Map fallback wrapper
 */
export function MapLoadingWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<MapSkeleton />}>{children}</Suspense>;
}

/**
 * Table fallback wrapper
 */
export function TableLoadingWrapper({ 
  children, 
  rows = 5 
}: { 
  children: React.ReactNode;
  rows?: number;
}) {
  return <Suspense fallback={<TableSkeleton rows={rows} />}>{children}</Suspense>;
}

/**
 * Preload a lazy component (for route prefetching)
 */
export function preloadComponent(importFn: () => Promise<unknown>): void {
  // Use requestIdleCallback if available, otherwise setTimeout
  const schedule = 'requestIdleCallback' in window 
    ? window.requestIdleCallback 
    : (cb: () => void) => setTimeout(cb, 1);
  
  schedule(() => {
    importFn().catch(() => {
      // Silently fail - component will load on demand
    });
  });
}

// ============================================
// Exports for common patterns
// ============================================

export {
  DefaultFallback,
  ChartSkeleton,
  MapSkeleton,
  TableSkeleton,
};


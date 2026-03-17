import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// DriverTableSkeleton — matches driver directory table layout
// ---------------------------------------------------------------------------

interface DriverTableSkeletonProps {
  rows?: number;
  className?: string;
}

export function DriverTableSkeleton({ rows = 3, className }: DriverTableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-background px-4 py-3">
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted" />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
        >
          {/* Checkbox */}
          <div className="h-4 w-4 rounded bg-muted" />
          {/* Avatar */}
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          {/* Name + email */}
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-44 animate-pulse rounded bg-accent" />
          </div>
          {/* Status badge */}
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          {/* Vehicle */}
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          {/* Zone */}
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          {/* Actions */}
          <div className="h-7 w-7 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCardSkeleton — matches stat card layout
// ---------------------------------------------------------------------------

interface StatCardSkeletonProps {
  className?: string;
}

export function StatCardSkeleton({ className }: StatCardSkeletonProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-1.5 h-2.5 w-28 animate-pulse rounded bg-accent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MapLoadingSkeleton — full-height map placeholder
// ---------------------------------------------------------------------------

interface MapLoadingSkeletonProps {
  className?: string;
}

export function MapLoadingSkeleton({ className }: MapLoadingSkeletonProps) {
  return (
    <div className={cn('relative flex h-full w-full items-center justify-center bg-background', className)}>
      <div className="absolute inset-0 bg-muted/20" />
      <div className="relative flex flex-col items-center gap-3">
        <svg
          className="h-8 w-8 animate-spin text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-xs text-muted-foreground">Loading map...</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ButtonLoadingState — inline loading button
// ---------------------------------------------------------------------------

interface ButtonLoadingStateProps {
  label?: string;
  className?: string;
}

export function ButtonLoadingState({ label = 'Loading...', className }: ButtonLoadingStateProps) {
  return (
    <button
      type="button"
      disabled
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md bg-muted px-4 text-sm text-muted-foreground',
        className,
      )}
    >
      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label}
    </button>
  );
}

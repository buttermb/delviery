/**
 * Common Skeleton Components
 *
 * Reusable skeleton patterns for admin/storefront pages.
 * These complement the base primitives in @/components/ui/skeleton
 * and the page-level skeletons in other loading/ files.
 */

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ─── Page Layout Skeletons ─────────────────────────────────────────────────

interface PageHeaderSkeletonProps {
  /** Show breadcrumb above the title */
  hasBreadcrumb?: boolean;
  /** Show description below the title */
  hasDescription?: boolean;
  /** Number of action buttons on the right */
  actionCount?: number;
  className?: string;
}

/**
 * Admin page header skeleton with breadcrumb, title, description, and action buttons.
 * Matches the common layout: breadcrumb → title + actions → description.
 */
export function PageHeaderSkeleton({
  hasBreadcrumb = true,
  hasDescription = true,
  actionCount = 1,
  className,
}: PageHeaderSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading page header...">
      {hasBreadcrumb && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        {actionCount > 0 && (
          <div className="flex gap-2">
            {Array.from({ length: actionCount }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28" />
            ))}
          </div>
        )}
      </div>
      {hasDescription && <Skeleton className="h-4 w-72" />}
    </div>
  );
}

// ─── Tab Skeletons ──────────────────────────────────────────────────────────

interface TabsSkeletonProps {
  /** Number of tab items */
  tabCount?: number;
  /** Show content area below tabs */
  hasContent?: boolean;
  className?: string;
}

/**
 * Horizontal tabs skeleton matching shadcn/ui Tabs component.
 * Use for pages with lazy-loaded tab content.
 */
export function TabsSkeleton({
  tabCount = 4,
  hasContent = true,
  className,
}: TabsSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-label="Loading tabs...">
      <div className="flex gap-1 border-b pb-px">
        {Array.from({ length: tabCount }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn('h-10 rounded-t-md rounded-b-none', i === 0 ? 'w-28' : 'w-24')}
          />
        ))}
      </div>
      {hasContent && (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}
    </div>
  );
}

// ─── Search & Filter Skeletons ──────────────────────────────────────────────

interface SearchBarSkeletonProps {
  /** Number of filter buttons beside the search */
  filterCount?: number;
  className?: string;
}

/**
 * Search input + filter buttons skeleton.
 * Common pattern on list/table pages.
 */
export function SearchBarSkeleton({
  filterCount = 2,
  className,
}: SearchBarSkeletonProps) {
  return (
    <div
      className={cn('flex flex-col sm:flex-row gap-3', className)}
      role="status"
      aria-label="Loading search..."
    >
      <Skeleton className="h-10 flex-1 rounded-md" />
      {filterCount > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: filterCount }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Badge / Tag Skeletons ──────────────────────────────────────────────────

interface BadgeGroupSkeletonProps {
  /** Number of badges */
  count?: number;
  className?: string;
}

/**
 * Group of pill-shaped badge skeletons.
 * Use for tag lists, filter chips, status badges.
 */
export function BadgeGroupSkeleton({
  count = 4,
  className,
}: BadgeGroupSkeletonProps) {
  return (
    <div
      className={cn('flex flex-wrap gap-2', className)}
      role="status"
      aria-label="Loading badges..."
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-6 rounded-full', i % 2 === 0 ? 'w-20' : 'w-16')}
        />
      ))}
    </div>
  );
}

// ─── Metric / KPI Skeletons ─────────────────────────────────────────────────

interface MetricRowSkeletonProps {
  /** Number of metric items */
  count?: number;
  className?: string;
}

/**
 * Horizontal row of metric values (label + value pairs).
 * Common in summary sections and detail pages.
 */
export function MetricRowSkeleton({
  count = 4,
  className,
}: MetricRowSkeletonProps) {
  return (
    <div
      className={cn('grid gap-4', className)}
      style={{ gridTemplateColumns: `repeat(${Math.min(count, 4)}, minmax(0, 1fr))` }}
      role="status"
      aria-label="Loading metrics..."
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

// ─── Timeline / Activity Skeletons ──────────────────────────────────────────

interface TimelineSkeletonProps {
  /** Number of timeline entries */
  count?: number;
  className?: string;
}

/**
 * Vertical timeline / activity feed skeleton.
 * Use for order history, audit logs, activity feeds.
 */
export function TimelineSkeleton({
  count = 4,
  className,
}: TimelineSkeletonProps) {
  return (
    <div
      className={cn('space-y-0', className)}
      role="status"
      aria-label="Loading timeline..."
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4 pb-6 last:pb-0">
          <div className="flex flex-col items-center">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            {i < count - 1 && <Skeleton className="w-px flex-1 mt-2" />}
          </div>
          <div className="flex-1 space-y-1 pt-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar Navigation Skeleton ────────────────────────────────────────────

interface SidebarSkeletonProps {
  /** Number of nav sections */
  sectionCount?: number;
  /** Items per section */
  itemsPerSection?: number;
  className?: string;
}

/**
 * Sidebar navigation skeleton with sections and nav items.
 * Matches the admin sidebar layout.
 */
export function SidebarSkeleton({
  sectionCount = 3,
  itemsPerSection = 4,
  className,
}: SidebarSkeletonProps) {
  return (
    <div
      className={cn('w-64 p-4 space-y-6', className)}
      role="status"
      aria-label="Loading sidebar..."
    >
      {/* Logo */}
      <Skeleton className="h-8 w-32" />

      {/* Search */}
      <Skeleton className="h-9 w-full rounded-md" />

      {/* Nav sections */}
      {Array.from({ length: sectionCount }).map((_, si) => (
        <div key={si} className="space-y-1">
          <Skeleton className="h-3 w-16 mb-2" />
          {Array.from({ length: itemsPerSection }).map((_, ii) => (
            <div key={ii} className="flex items-center gap-3 px-2 py-2">
              <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Admin Hub Page Skeleton ────────────────────────────────────────────────

interface HubPageSkeletonProps {
  /** Number of tabs */
  tabCount?: number;
  /** Skeleton content for the active tab area */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Standard admin hub page skeleton: header + tabs + content.
 * Matches the consistent hub page pattern across admin pages.
 */
export function HubPageSkeleton({
  tabCount = 4,
  children,
  className,
}: HubPageSkeletonProps) {
  return (
    <div className={cn('p-6 space-y-6', className)} role="status" aria-label="Loading page...">
      <PageHeaderSkeleton />
      <TabsSkeleton tabCount={tabCount} hasContent={false} />
      {children ?? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchBarSkeleton />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Switch / Toggle Row Skeleton ───────────────────────────────────────────

interface SwitchRowSkeletonProps {
  className?: string;
}

/**
 * Settings-style switch/toggle row with label and description.
 */
export function SwitchRowSkeleton({ className }: SwitchRowSkeletonProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="space-y-1 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-6 w-11 rounded-full" />
    </div>
  );
}

// ─── Inline Stat Card ───────────────────────────────────────────────────────

interface InlineStatSkeletonProps {
  className?: string;
}

/**
 * Compact inline stat (icon + value + label in a row).
 * Use for summary bars at the top of list pages.
 */
export function InlineStatSkeleton({ className }: InlineStatSkeletonProps) {
  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', className)}>
      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
      <div className="space-y-1">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

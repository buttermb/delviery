/**
 * Sidebar Loading Skeleton Component
 *
 * Displays a skeleton loading state that matches the sidebar structure
 * while navigation configuration is loading.
 */

import { Skeleton } from '@/components/ui/skeleton';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';

interface SidebarLoadingSkeletonProps {
  collapsible?: "offcanvas" | "icon" | "none";
}

/**
 * A skeleton placeholder for sidebar section
 */
function SidebarSectionSkeleton({ itemCount = 4 }: { itemCount?: number }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <Skeleton className="h-4 w-24" />
      </SidebarGroupLabel>
      <SidebarMenu>
        {Array.from({ length: itemCount }).map((_, index) => (
          <SidebarMenuSkeleton key={index} showIcon />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/**
 * Full sidebar loading skeleton that matches the AdaptiveSidebar structure
 */
export function SidebarLoadingSkeleton({ collapsible = "offcanvas" }: SidebarLoadingSkeletonProps) {
  return (
    <Sidebar
      data-tutorial="navigation-sidebar"
      collapsible={collapsible}
      className="dark:bg-gray-900 dark:text-white"
    >
      {/* Header skeleton - matches tenant dropdown structure */}
      <SidebarHeader className="p-0 border-b">
        <div className="w-full p-3 flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
          <div className="flex flex-col min-w-0 flex-1 gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
        </div>
      </SidebarHeader>

      {/* Search and Quick Actions skeleton */}
      <div className="px-3 py-2 border-b space-y-2">
        {/* Search bar skeleton */}
        <Skeleton className="h-9 w-full rounded-md" />

        {/* Command palette trigger skeleton */}
        <Skeleton className="h-8 w-full rounded-md" />

        {/* Quick actions skeleton */}
        <div className="flex items-center gap-1">
          <Skeleton className="flex-1 h-8 rounded-md" />
          <Skeleton className="flex-1 h-8 rounded-md" />
          <Skeleton className="flex-1 h-8 rounded-md" />
        </div>
      </div>

      <SidebarContent>
        {/* Recently Used skeleton */}
        <SidebarSectionSkeleton itemCount={3} />

        {/* Main sections skeleton - simulate typical sidebar layout */}
        <SidebarSectionSkeleton itemCount={5} />
        <SidebarSectionSkeleton itemCount={4} />
        <SidebarSectionSkeleton itemCount={3} />
        <SidebarSectionSkeleton itemCount={4} />
      </SidebarContent>

      {/* Footer skeleton */}
      <SidebarFooter className="p-2 border-t">
        <div className="flex items-center justify-between gap-1">
          <Skeleton className="flex-1 h-8 rounded-md" />
          <Skeleton className="flex-1 h-8 rounded-md" />
        </div>
        <div className="flex justify-center gap-2 mt-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

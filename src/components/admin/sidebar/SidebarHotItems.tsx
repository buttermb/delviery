/**
 * Sidebar Hot Items Component
 *
 * Displays contextual quick actions based on business context
 */

import { useCallback, useMemo } from 'react';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from '@/components/ui/sidebar';
import { SidebarMenuItem } from './SidebarMenuItem';
import { useSidebar } from './SidebarContext';
import { matchesSearchQuery } from './SidebarSearch';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useParams, useLocation } from 'react-router-dom';
import type { FeatureId } from '@/lib/featureConfig';
import { isRouteActive } from '@/lib/sidebar/isRouteActive';

export function SidebarHotItems() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const { hotItems } = useSidebarConfig();
  const { canAccess } = useFeatureAccess();
  const { searchQuery } = useSidebar();

  // Guard: Ensure hotItems is an array - memoized to stabilize deps
  const safeHotItems = useMemo(() => Array.isArray(hotItems) ? hotItems : [], [hotItems]);

  // Filter hot items based on search query
  const filteredHotItems = useMemo(() => {
    if (!searchQuery.trim()) return safeHotItems;
    return safeHotItems.filter((item) => matchesSearchQuery(item.name, searchQuery));
  }, [safeHotItems, searchQuery]);

  const isActive = useCallback((url: string) => {
    if (!tenantSlug) return false;
    return isRouteActive(url, tenantSlug, location.pathname, location.search);
  }, [tenantSlug, location.pathname, location.search]);

  const handleItemClick = useCallback((_itemId: string, _featureId?: string) => {
    // Tracking is handled by SidebarMenuItem
  }, []);

  const handleLockedItemClick = useCallback((_featureId: FeatureId) => {
    // Upgrade modal is handled by parent AdaptiveSidebar
  }, []);

  // Don't render if no items match
  if (filteredHotItems.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-orange-600 dark:text-orange-400 px-3 py-2 min-h-[40px]">
        <span className="text-xs font-semibold uppercase tracking-wider">Quick Access</span>
      </SidebarGroupLabel>
      <SidebarGroupContent className="mt-1">
        <SidebarMenu>
          {filteredHotItems.map((hot) => {
            const hasAccess = hot.featureId ? canAccess(hot.featureId as FeatureId) : true;
            return (
              <SidebarMenuItem
                key={hot.id}
                item={{
                  id: hot.id,
                  name: hot.name,
                  path: hot.path,
                  icon: hot.icon,
                  featureId: hot.featureId,
                  hot: true,
                  badge: hot.badge,
                }}
                isActive={isActive(hot.path)}
                hasAccess={hasAccess}
                onItemClick={handleItemClick}
                onLockedItemClick={handleLockedItemClick}
              />
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}


/**
 * Sidebar Favorites Component
 *
 * Displays user's favorite menu items with database sync via useMutation.
 * Features:
 * - Displays favorited items from sidebar config
 * - Remove favorites directly with optimistic updates
 * - Database persistence through SidebarContext's toggleFavorite mutation
 * - Search filtering support for favorites
 */

import { useCallback, useMemo, memo } from 'react';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from '@/components/ui/sidebar';
import { SidebarMenuItem } from './SidebarMenuItem';
import { useSidebar } from './SidebarContext';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useParams, useLocation } from 'react-router-dom';

export const SidebarFavorites = memo(function SidebarFavorites() {
  const { tenantSlug } = useParams();
  const location = useLocation();
  const { sidebarConfig, favorites } = useSidebarConfig();
  const { canAccess } = useFeatureAccess();
  const { searchQuery, trackFeatureAccess } = useSidebar();

  // Guard: Ensure favorites is an array
  const safeFavorites = useMemo(() =>
    Array.isArray(favorites) ? favorites : [],
    [favorites]
  );

  // Guard: Ensure sidebarConfig is an array
  const safeConfig = useMemo(() =>
    Array.isArray(sidebarConfig) ? sidebarConfig : [],
    [sidebarConfig]
  );

  // Find favorite items from all sections, maintaining order based on favorites array
  const favoriteItems = useMemo(() => {
    const allItems = safeConfig.flatMap(section => section?.items || []);

    // Map favorites to items while preserving favorites order
    return safeFavorites
      .map(favId => allItems.find(item => item?.id === favId))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
  }, [safeConfig, safeFavorites]);

  // Filter favorites by search query
  const filteredFavoriteItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return favoriteItems;
    }
    const query = searchQuery.toLowerCase();
    return favoriteItems.filter(item => item.name.toLowerCase().includes(query));
  }, [favoriteItems, searchQuery]);

  // Check if path is active
  const isActive = useCallback((url: string) => {
    const fullPath = `/${tenantSlug}${url}`;
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  }, [tenantSlug, location.pathname]);

  // Handle item click - track feature access for recently used
  const handleItemClick = useCallback((itemId: string, featureId?: string) => {
    if (featureId) {
      trackFeatureAccess(featureId);
    }
  }, [trackFeatureAccess]);

  // Handle locked item click - parent handles upgrade modal
  const handleLockedItemClick = useCallback(() => {
    // Upgrade modal is handled by parent AdaptiveSidebar
  }, []);

  // Early return if no favorites or no filtered results
  if (filteredFavoriteItems.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-yellow-600 dark:text-yellow-400 px-3 py-2 min-h-[40px]">
        <span className="text-xs font-semibold uppercase tracking-wider">⭐ Favorites</span>
      </SidebarGroupLabel>
      <SidebarGroupContent className="mt-1">
        <SidebarMenu>
          {favoriteItems.map((item) => {
            const hasAccess = item.featureId ? canAccess(item.featureId) : true;
            return (
              <SidebarMenuItem
                key={item.id}
                item={item}
                isActive={isActive(item.path)}
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
});


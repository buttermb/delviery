/**
 * Sidebar Favorites Component
 * 
 * Displays user's favorite menu items
 */

import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from '@/components/ui/sidebar';
import { SidebarMenuItem } from './SidebarMenuItem';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useParams, useLocation } from 'react-router-dom';
import type { FeatureId } from '@/lib/featureConfig';

export function SidebarFavorites() {
  const { tenantSlug } = useParams();
  const location = useLocation();
  const { sidebarConfig, favorites } = useSidebarConfig();
  const { canAccess } = useFeatureAccess();

  // Guard: Ensure favorites is an array
  const safeFavorites = Array.isArray(favorites) ? favorites : [];
  
  // Guard: Early return if no favorites
  if (safeFavorites.length === 0) {
    return null;
  }

  // Guard: Ensure sidebarConfig is an array
  const safeConfig = Array.isArray(sidebarConfig) ? sidebarConfig : [];

  // Find favorite items from all sections
  const favoriteItems = safeConfig
    .flatMap(section => section?.items || [])
    .filter(item => item && safeFavorites.includes(item.id));

  // Double-check after filtering
  if (favoriteItems.length === 0) {
    return null;
  }

  const isActive = (url: string) => {
    const fullPath = `/${tenantSlug}${url}`;
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  };

  const handleItemClick = (itemId: string, featureId?: string) => {
    // Tracking is handled by SidebarMenuItem
  };

  const handleLockedItemClick = (featureId: FeatureId) => {
    // Upgrade modal is handled by parent AdaptiveSidebar
  };

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
}


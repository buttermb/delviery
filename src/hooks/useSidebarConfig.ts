/**
 * useSidebarConfig Hook
 * 
 * Main hook that orchestrates all sidebar logic:
 * - Gets operation size (auto or manual)
 * - Gets base config for that size
 * - Filters by role, tier, and feature access
 * - Adds hot items
 * - Adds favorites section
 * - Applies user preferences
 */

import { useMemo } from 'react';
import { useOperationSize } from './useOperationSize';
import { useSidebarPreferences } from './useSidebarPreferences';
import { usePermissions } from './usePermissions';
import { useFeatureAccess } from './useFeatureAccess';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { getSidebarConfig } from '@/lib/sidebar/sidebarConfigs';
import { applyAllFilters } from '@/lib/sidebar/sidebarFilters';
import { generateHotItems, getBusinessContext } from '@/lib/sidebar/hotItemsLogic';
import type { SidebarSection, HotItem } from '@/types/sidebar';

/**
 * Main hook to get complete sidebar configuration
 */
export function useSidebarConfig() {
  const { operationSize, detectedSize, isAutoDetected } = useOperationSize();
  const { preferences } = useSidebarPreferences();
  const { role, checkPermission } = usePermissions();
  const { currentTier, canAccess } = useFeatureAccess();
  const { tenant } = useTenantAdminAuth();

  // Safe defaults for preferences
  const safePreferences = preferences || {
    operationSize: null,
    customLayout: false,
    favorites: [],
    collapsedSections: [],
    pinnedItems: [],
    lastAccessedFeatures: [],
  };

  // Get base config for operation size
  const baseConfig = useMemo(() => {
    return getSidebarConfig(operationSize);
  }, [operationSize]);

  // Apply filters (role, tier, feature access)
  const filteredConfig = useMemo(() => {
    return applyAllFilters(baseConfig, {
      role,
      currentTier,
      checkPermission,
      canAccessFeature: canAccess,
    });
  }, [baseConfig, role, currentTier, checkPermission, canAccess]);

  // Generate hot items
  const hotItems = useMemo((): HotItem[] => {
    if (!tenant) return [];
    const context = getBusinessContext(tenant);
    return generateHotItems(context);
  }, [tenant]);

  // Add hot items section if any exist
  const configWithHotItems = useMemo(() => {
    if (hotItems.length === 0) return filteredConfig;

    return [
      {
        section: '🔥 Quick Access',
        pinned: true,
        defaultExpanded: true,
        items: hotItems.map(hot => ({
          id: hot.id,
          name: hot.name,
          path: hot.path,
          icon: hot.icon,
          featureId: hot.featureId,
          hot: true,
          badge: hot.badge,
        })),
      },
      ...filteredConfig,
    ];
  }, [filteredConfig, hotItems]);

  // Add favorites section if user has favorites
  const configWithFavorites = useMemo(() => {
    if (!safePreferences.favorites || safePreferences.favorites.length === 0) return configWithHotItems;

    // Find favorite items from all sections
    const favoriteItems = configWithHotItems
      .flatMap(section => section.items)
      .filter(item => safePreferences.favorites.includes(item.id));

    if (favoriteItems.length === 0) return configWithHotItems;

    return [
      {
        section: '⭐ Favorites',
        pinned: true,
        defaultExpanded: true,
        items: favoriteItems,
      },
      ...configWithHotItems,
    ];
  }, [configWithHotItems, safePreferences.favorites]);

  // Apply user preferences (collapsed sections, pinned items)
  const finalConfig = useMemo(() => {
    return configWithFavorites.map(section => {
      // Check if section should be collapsed based on preferences
      const isCollapsed = safePreferences.collapsedSections?.includes(section.section) || false;

      return {
        ...section,
        collapsed: section.pinned ? false : isCollapsed, // Pinned sections never collapse
        defaultExpanded: section.pinned ? true : !isCollapsed,
      };
    });
  }, [configWithFavorites, safePreferences.collapsedSections]);

  return {
    sidebarConfig: finalConfig,
    operationSize,
    detectedSize,
    isAutoDetected,
    hotItems,
    favorites: safePreferences.favorites,
  };
}


import { logger } from '@/lib/logger';
/**
 * useSidebarConfig Hook
 * 
 * Main hook that orchestrates all sidebar logic:
 * - Gets operation size (auto or manual)
 * - Gets base config for that size
 * - Filters by role, tier, and feature access
 * - Filters by business tier (5-tier Hotbox system)
 * - Adds hot items
 * - Adds favorites section
 * - Applies user preferences
 */

import { useMemo } from 'react';
import { useOperationSize } from './useOperationSize';
import { useSidebarPreferences } from './useSidebarPreferences';
import { usePermissions } from './usePermissions';
import { useFeatureAccess } from './useFeatureAccess';
import { useBusinessTier } from './useBusinessTier';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { getSidebarConfig } from '@/lib/sidebar/sidebarConfigs';
import { applyAllFilters } from '@/lib/sidebar/sidebarFilters';
import { generateHotItems, getBusinessContext } from '@/lib/sidebar/hotItemsLogic';
import { getLayoutPreset } from '@/lib/sidebar/layoutPresets';
import { getHiddenFeaturesByIntegrations } from '@/lib/sidebar/integrations';
import { ESSENTIAL_FEATURES } from '@/lib/sidebar/featureRegistry';
import type { HotItem } from '@/types/sidebar';

/**
 * Main hook to get complete sidebar configuration
 */
export function useSidebarConfig() {
  const { operationSize, detectedSize, isAutoDetected, isLoading: operationSizeLoading } = useOperationSize();
  const { preferences, isLoading: preferencesLoading } = useSidebarPreferences();
  const { role, checkPermission } = usePermissions();
  const { currentTier, canAccess } = useFeatureAccess();
  const { tenant } = useTenantAdminAuth();
  const { preset: businessPreset, isFeatureEnabled, tier: businessTier, isLoading: businessTierLoading } = useBusinessTier();

  // Aggregate loading states from all dependent hooks
  const isLoading = operationSizeLoading || preferencesLoading || businessTierLoading;

  // Safe defaults for preferences
  const safePreferences = preferences || {
    operationSize: null,
    customLayout: false,
    favorites: [],
    collapsedSections: [],
    pinnedItems: [],
    lastAccessedFeatures: [],
    hiddenFeatures: [],
    sectionOrder: [],
    customSections: [],
    enabledIntegrations: ['mapbox', 'stripe'], // Both integrations enabled by default
    customMenuItems: [],
    layoutPreset: 'default',
    sidebarBehavior: {
      autoCollapse: true,
      iconOnly: false,
      showTooltips: true,
    },
    customPresets: [],
  };

  // Get base config - use enterprise for non-default presets to enable full feature access
  const baseConfig = useMemo(() => {
    const currentLayoutPreset = preferences?.layoutPreset || 'default';

    // If user explicitly chose a preset (other than default), use ENTERPRISE config
    // This ensures all features are available for the preset to filter from
    if (currentLayoutPreset !== 'default') {
      logger.info('Using enterprise base config for preset:', currentLayoutPreset, { component: 'useSidebarConfig' });
      return getSidebarConfig('enterprise');
    }

    // For 'default' preset, use operation-size-based config
    return getSidebarConfig(operationSize);
  }, [operationSize, preferences?.layoutPreset]);



  // Create permissive access function for non-default presets
  // When a preset is selected, bypass business tier filtering to allow preset full control
  const canAccessForFiltering = useMemo(() => {
    const currentLayoutPreset = preferences?.layoutPreset || 'default';

    if (currentLayoutPreset !== 'default') {
      // Permissive: allow all features through security filter
      // The preset will control visibility later in the pipeline
      return (_featureId: string) => true;
    }

    // Default behavior: respect business tier filtering
    return canAccess;
  }, [preferences?.layoutPreset, canAccess]);

  // 1. Apply Security Filters (Role, Permissions) - ALWAYS APPLY
  const securityFilteredConfig = useMemo(() => {
    return applyAllFilters(baseConfig, {
      role,
      currentTier,
      checkPermission,
      canAccessFeature: canAccessForFiltering, // Use conditional function
    });
  }, [baseConfig, role, currentTier, checkPermission, canAccessForFiltering]);

  // 2. Apply Layout Preset & Integration Filters
  const visibilityFilteredConfig = useMemo(() => {
    const hiddenFeatures = safePreferences.hiddenFeatures ?? [];
    const enabledIntegrations = safePreferences.enabledIntegrations || ['mapbox', 'stripe'];
    const currentLayoutPreset = preferences?.layoutPreset || 'default';
    const layoutPreset = getLayoutPreset(currentLayoutPreset);

    // Check if it's a custom preset
    const customPresets = preferences?.customPresets ?? [];
    const customPreset = customPresets.find(p => p.id === currentLayoutPreset);

    // Get features hidden by disabled integrations (using single source of truth)
    const integrationHiddenFeatures = getHiddenFeaturesByIntegrations(enabledIntegrations);

    const allHiddenFeatures = [...hiddenFeatures, ...integrationHiddenFeatures]
      .filter(id => !ESSENTIAL_FEATURES.includes(id));

    // Apply preset visibility
    let config = securityFilteredConfig.map(section => ({
      ...section,
      items: section.items.filter(item => !allHiddenFeatures.includes(item.id)),
    }));

    // Determine visible features from preset
    let presetVisibleFeatures: string[] | 'all' = 'all';

    if (customPreset) {
      presetVisibleFeatures = customPreset.visibleFeatures;
    } else if (layoutPreset) {
      presetVisibleFeatures = layoutPreset.visibleFeatures;
    }

    // Filter by preset if not 'all'
    if (presetVisibleFeatures !== 'all') {
      config = config.map(section => ({
        ...section,
        items: section.items.filter(item =>
          ESSENTIAL_FEATURES.includes(item.id) || (presetVisibleFeatures as string[]).includes(item.id)
        ),
      }));
    }

    return config.filter(section => section.items.length > 0);
  }, [securityFilteredConfig, safePreferences.hiddenFeatures, safePreferences.enabledIntegrations, preferences?.layoutPreset, preferences?.customPresets]);

  // 3. Apply Business Tier Sorting - ONLY if Default Preset
  // Note: Feature filtering is now done by subscription tier in useFeatureAccess
  // Business tier only controls section ordering now
  const businessTierFilteredConfig = useMemo(() => {
    const currentLayoutPreset = preferences?.layoutPreset || 'default';

    // If user explicitly chose a preset (other than default), skip business tier processing
    if (currentLayoutPreset !== 'default' || !businessPreset) {
      return visibilityFilteredConfig;
    }

    // Map internal section IDs to display titles
    const SECTION_MAPPING: Record<string, string[]> = {
      'operations': ['⚙️ Operations', '⚙️ Manage', '📦 Inventory'],
      'delivery': ['⚙️ Operations', '⚙️ Global Operations'],
      'wholesale': ['🛍️ Sales & Orders', '🛍️ Catalog & Sales'],
      'people': ['👥 Customers', '👥 Customer Experience'],
      'analytics': ['📊 Analytics & Finance', '📊 Intelligence', '📊 Reports'],
      'compliance': ['⚙️ Global Operations', '⚙️ Manage'],
      'settings': ['⚙️ Settings', '🔧 Settings', '🔧 System & Admin'],
      'all': [],
    };

    // Sort sections based on navSections order from business preset
    if (businessPreset.navSections && !businessPreset.navSections.includes('all')) {
      const preferredOrder = businessPreset.navSections;

      return [...visibilityFilteredConfig].sort((a, b) => {
        const getSectionIndex = (title: string) => {
          const index = preferredOrder.findIndex(prefId => {
            const mappedTitles = SECTION_MAPPING[prefId] ?? [];
            return mappedTitles.includes(title);
          });
          return index === -1 ? 999 : index;
        };

        const indexA = getSectionIndex(a.section);
        const indexB = getSectionIndex(b.section);

        return indexA - indexB;
      });
    }

    return visibilityFilteredConfig;
  }, [visibilityFilteredConfig, businessPreset, preferences?.layoutPreset]);

  // Generate hot items
  const hotItems = useMemo((): HotItem[] => {
    if (!tenant) return [];
    const context = getBusinessContext(tenant);
    return generateHotItems(context);
  }, [tenant]);

  // Add hot items section if any exist
  const configWithHotItems = useMemo(() => {
    if (hotItems.length === 0) return businessTierFilteredConfig;

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
      ...businessTierFilteredConfig,
    ];
  }, [businessTierFilteredConfig, hotItems]);

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
      const isCollapsed = safePreferences.collapsedSections?.includes(section.section) ?? false;

      return {
        ...section,
        collapsed: section.pinned ? false : isCollapsed, // Pinned sections never collapse
        defaultExpanded: section.pinned ? true : !isCollapsed,
      };
    });
  }, [configWithFavorites, safePreferences.collapsedSections]);



  return {
    sidebarConfig: Array.isArray(finalConfig) ? finalConfig : [],
    operationSize,
    detectedSize,
    isAutoDetected,
    hotItems: Array.isArray(hotItems) ? hotItems : [],
    favorites: Array.isArray(safePreferences.favorites) ? safePreferences.favorites : [],
    // Business tier info
    businessTier,
    businessPreset,
    isFeatureEnabledByTier: isFeatureEnabled,
    // Loading state - true while navigation config is still being loaded
    isLoading,
  };
}


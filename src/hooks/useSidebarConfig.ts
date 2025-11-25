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

import { useMemo, useEffect } from 'react';
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
import { ESSENTIAL_FEATURES, FEATURE_REGISTRY } from '@/lib/sidebar/featureRegistry';
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
  const { preset: businessPreset, isFeatureEnabled, tier: businessTier } = useBusinessTier();

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

  // Development validation: warn if ENTERPRISE_SIDEBAR is missing features from registry
  useEffect(() => {
    if (import.meta.env.DEV) {
      const registryIds = Object.keys(FEATURE_REGISTRY);
      const enterpriseConfig = getSidebarConfig('enterprise');
      const enterpriseIds = enterpriseConfig.flatMap(s => s.items.map(i => i.id));
      const missing = registryIds.filter(id => !enterpriseIds.includes(id));
      
      if (missing.length > 0) {
        console.warn('⚠️ ENTERPRISE_SIDEBAR missing features from FEATURE_REGISTRY:', missing);
      }
    }
  }, []);

  // 1. Apply Security Filters (Role, Permissions) - ALWAYS APPLY
  const securityFilteredConfig = useMemo(() => {
    return applyAllFilters(baseConfig, {
      role,
      currentTier: currentTier as any,
      checkPermission,
      canAccessFeature: canAccess,
    });
  }, [baseConfig, role, currentTier, checkPermission, canAccess]);

  // 2. Apply Layout Preset & Integration Filters
  const visibilityFilteredConfig = useMemo(() => {
    const hiddenFeatures = safePreferences.hiddenFeatures || [];
    const enabledIntegrations = safePreferences.enabledIntegrations || ['mapbox', 'stripe'];
    const currentLayoutPreset = preferences?.layoutPreset || 'default';
    const layoutPreset = getLayoutPreset(currentLayoutPreset);

    // Check if it's a custom preset
    const customPresets = preferences?.customPresets || [];
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

  // 3. Apply Business Tier Filters - ONLY if Default Preset
  const businessTierFilteredConfig = useMemo(() => {
    const currentLayoutPreset = preferences?.layoutPreset || 'default';

    // If user explicitly chose a preset (other than default), OVERRIDE business tier hiding
    // We still apply sorting if available, but we don't hide features based on tier
    const shouldApplyTierFiltering = currentLayoutPreset === 'default';

    if (!shouldApplyTierFiltering || !businessPreset || businessPreset.enabledFeatures.includes('all')) {
      // Even if we don't filter, we might want to sort?
      // For now, just return the visibility filtered config
      return visibilityFilteredConfig;
    }

    const enabledFeatures = businessPreset.enabledFeatures;
    const hiddenFeatures = businessPreset.hiddenFeatures;

    // Use centralized essential features
    const TIER_ESSENTIAL = ESSENTIAL_FEATURES;

    // Filter items
    const filteredSections = visibilityFilteredConfig.map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (TIER_ESSENTIAL.includes(item.id)) return true;
        if (hiddenFeatures.includes(item.id) || hiddenFeatures.includes(item.featureId || '')) return false;
        if (enabledFeatures.includes(item.id) || enabledFeatures.includes(item.featureId || '')) return true;
        return !hiddenFeatures.includes(item.id);
      }),
    })).filter(section => section.items.length > 0);

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

    // Sort sections based on navSections order
    if (businessPreset.navSections && !businessPreset.navSections.includes('all')) {
      const preferredOrder = businessPreset.navSections;

      return filteredSections.sort((a, b) => {
        const getSectionIndex = (title: string) => {
          const index = preferredOrder.findIndex(prefId => {
            const mappedTitles = SECTION_MAPPING[prefId] || [];
            return mappedTitles.includes(title);
          });
          return index === -1 ? 999 : index;
        };

        const indexA = getSectionIndex(a.section);
        const indexB = getSectionIndex(b.section);

        return indexA - indexB;
      });
    }

    return filteredSections;
  }, [visibilityFilteredConfig, businessPreset, preferences?.layoutPreset]);

  // Generate hot items
  const hotItems = useMemo((): HotItem[] => {
    if (!tenant) return [];
    const context = getBusinessContext(tenant);
    return generateHotItems(context, tenant.slug);
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
      const isCollapsed = safePreferences.collapsedSections?.includes(section.section) || false;

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
  };
}


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
    enabledIntegrations: ['mapbox', 'stripe'],
    customMenuItems: [],
    layoutPreset: 'default',
    sidebarBehavior: {
      autoCollapse: true,
      iconOnly: false,
      showTooltips: true,
    },
    customPresets: [],
  };

  // Get base config for operation size
  const baseConfig = useMemo(() => {
    const config = getSidebarConfig(operationSize);
    logger.debug('Base config loaded', {
      component: 'useSidebarConfig',
      operationSize,
      detectedSize,
      isAutoDetected,
      sectionsCount: config.length,
      totalItems: config.reduce((sum, s) => sum + s.items.length, 0),
      sections: config.map(s => ({ 
        name: s.section, 
        itemCount: s.items.length,
        items: s.items.map(i => i.id)
      }))
    });
    return config;
  }, [operationSize, detectedSize, isAutoDetected]);

  // Apply filters (role, tier, feature access)
  const filteredConfig = useMemo(() => {
    logger.debug('Before filtering', {
      component: 'useSidebarConfig',
      sectionsCount: baseConfig.length,
      totalItems: baseConfig.reduce((sum, s) => sum + s.items.length, 0),
      role,
      currentTier,
      sampleItem: baseConfig[0]?.items[0]
    });
    
    const result = applyAllFilters(baseConfig, {
      role,
      currentTier: currentTier as any, // BusinessTier used in filter contexts
      checkPermission,
      canAccessFeature: canAccess,
    });
    
    logger.debug('After filtering', {
      component: 'useSidebarConfig',
      sectionsCount: result.length,
      totalItems: result.reduce((sum, s) => sum + s.items.length, 0),
      sections: result.map(s => ({ name: s.section, itemCount: s.items.length }))
    });
    
    return result;
  }, [baseConfig, role, currentTier, checkPermission, canAccess]);

  // Filter by hidden features, integration settings, and layout presets
  const visibilityFilteredConfig = useMemo(() => {
    const hiddenFeatures = safePreferences.hiddenFeatures || [];
    const enabledIntegrations = safePreferences.enabledIntegrations || ['mapbox', 'stripe'];
    const currentLayoutPreset = preferences?.layoutPreset || 'default';
    const layoutPreset = getLayoutPreset(currentLayoutPreset);
    
    // Check if it's a custom preset
    const customPresets = preferences?.customPresets || [];
    const customPreset = customPresets.find(p => p.id === currentLayoutPreset);
    
    // Essential features that can never be hidden
    const ESSENTIAL_FEATURES = ['dashboard', 'settings', 'billing'];
    
    // Get features hidden by disabled integrations
    const integrationHiddenFeatures: string[] = [];
    Object.entries({
      mapbox: ['logistics', 'route-planning', 'driver-tracking', 'live-map'],
      stripe: ['subscriptions', 'payment-links', 'invoices'],
      twilio: ['sms-notifications', '2fa', 'customer-alerts'],
      sendgrid: ['email-campaigns', 'email-notifications', 'marketing'],
      custom: ['webhooks', 'custom-integrations'],
    }).forEach(([integrationId, features]) => {
      if (!enabledIntegrations.includes(integrationId)) {
        integrationHiddenFeatures.push(...features);
      }
    });
    
    const allHiddenFeatures = [...hiddenFeatures, ...integrationHiddenFeatures]
      .filter(id => !ESSENTIAL_FEATURES.includes(id)); // Never hide essential features
    
    // Apply preset visibility if it's not 'all'
    let config = filteredConfig.map(section => ({
      ...section,
      items: section.items.filter(item => !allHiddenFeatures.includes(item.id)),
    }));
    
    // Apply custom preset filtering first
    if (customPreset) {
      const visibleFeatures = customPreset.visibleFeatures;
      config = config.map(section => ({
        ...section,
        items: section.items.filter(item => 
          ESSENTIAL_FEATURES.includes(item.id) || visibleFeatures.includes(item.id)
        ),
      }));
    }
    // Then apply predefined preset filtering
    else if (layoutPreset && layoutPreset.visibleFeatures !== 'all') {
      const visibleFeatures = layoutPreset.visibleFeatures as string[];
      config = config.map(section => ({
        ...section,
        items: section.items.filter(item => 
          ESSENTIAL_FEATURES.includes(item.id) || visibleFeatures.includes(item.id)
        ),
      }));
    }
    
    return config.filter(section => section.items.length > 0);
  }, [filteredConfig, safePreferences.hiddenFeatures, safePreferences.enabledIntegrations, preferences?.layoutPreset, preferences?.customPresets]);

  // Filter by business tier (5-tier Hotbox system)
  const businessTierFilteredConfig = useMemo(() => {
    // If business tier is not loaded or preset has 'all' enabled, skip filtering
    if (!businessPreset || businessPreset.enabledFeatures.includes('all')) {
      return visibilityFilteredConfig;
    }

    const enabledFeatures = businessPreset.enabledFeatures;
    const hiddenFeatures = businessPreset.hiddenFeatures;
    
    // Essential features that should never be hidden regardless of tier
    const TIER_ESSENTIAL = ['dashboard', 'settings', 'billing', 'hotbox'];

    return visibilityFilteredConfig.map(section => ({
      ...section,
      items: section.items.filter(item => {
        // Always show essential features
        if (TIER_ESSENTIAL.includes(item.id)) return true;
        
        // Hide if explicitly in hidden features
        if (hiddenFeatures.includes(item.id) || hiddenFeatures.includes(item.featureId || '')) {
          return false;
        }
        
        // Show if in enabled features
        if (enabledFeatures.includes(item.id) || enabledFeatures.includes(item.featureId || '')) {
          return true;
        }
        
        // Default: show if not explicitly hidden
        return !hiddenFeatures.includes(item.id);
      }),
    })).filter(section => section.items.length > 0);
  }, [visibilityFilteredConfig, businessPreset]);

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


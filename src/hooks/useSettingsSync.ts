/**
 * useSettingsSync Hook
 *
 * Provides unified access to all settings across the application and handles
 * synchronization between different settings sources (localStorage, database, etc.)
 *
 * This hook acts as a bridge between:
 * - Global settings (account, security, notifications)
 * - Sidebar preferences
 * - Payment settings
 * - Storefront settings
 * - Theme preferences
 *
 * Features:
 * - Unified settings access
 * - Cross-feature settings sync
 * - Settings change detection
 * - Optimistic updates
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalSettings, type SecuritySettings, type NotificationSettings, type GeneralSettings } from '@/hooks/useGlobalSettings';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import { useTenantPaymentSettings, type PaymentSettings } from '@/hooks/usePaymentSettings';
import { useTheme } from '@/contexts/ThemeContext';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import type { SidebarPreferences } from '@/types/sidebar';
import type { StorefrontSettings } from '@/hooks/useStorefrontSettings';

export interface UnifiedSettings {
  // Core settings
  general: GeneralSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;

  // Theme
  theme: 'light' | 'dark';

  // Sidebar
  sidebar: SidebarPreferences | null;

  // Payment
  payment: PaymentSettings | null;

  // Storefront
  storefront: StorefrontSettings | null;

  // Metadata
  isLoading: boolean;
  lastSynced: Date | null;
}

interface SettingsUpdateHandlers {
  updateGeneral: (updates: Partial<GeneralSettings>) => void;
  updateSecurity: (updates: Partial<SecuritySettings>) => void;
  updateNotifications: (updates: Partial<NotificationSettings>) => void;
  updateTheme: (theme: 'light' | 'dark') => void;
  updateSidebar: (updates: Partial<SidebarPreferences>) => Promise<void>;
  refreshAll: () => Promise<void>;
}

/**
 * Hook for unified settings access and synchronization
 */
export function useSettingsSync(): UnifiedSettings & SettingsUpdateHandlers {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const { theme, setTheme } = useTheme();

  // Get settings from various sources
  const {
    settings: globalSettings,
    isLoading: globalLoading,
    updateGeneralSettings,
    updateSecuritySettings,
    updateNotificationSettings,
    refreshSettings: refreshGlobal,
  } = useGlobalSettings();

  const { preferences: sidebarPrefs, isLoading: sidebarLoading, updatePreferences: updateSidebar } = useSidebarPreferences();
  const { data: paymentSettings, isLoading: paymentLoading } = useTenantPaymentSettings();
  const { data: storefrontSettings, isLoading: storefrontLoading } = useStorefrontSettings();

  // Combined loading state
  const isLoading = globalLoading || sidebarLoading || paymentLoading || storefrontLoading;

  // Build unified settings object
  const unifiedSettings = useMemo((): UnifiedSettings => ({
    general: globalSettings.general,
    security: globalSettings.security,
    notifications: globalSettings.notifications,
    theme,
    sidebar: sidebarPrefs,
    payment: paymentSettings || null,
    storefront: storefrontSettings || null,
    isLoading,
    lastSynced: new Date(),
  }), [globalSettings, theme, sidebarPrefs, paymentSettings, storefrontSettings, isLoading]);

  // Update theme handler
  const updateTheme = useCallback((newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  }, [setTheme]);

  // Refresh all settings
  const refreshAll = useCallback(async () => {
    try {
      await refreshGlobal();

      // Invalidate all settings-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sidebar-preferences'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantPaymentSettings(tenant?.id || '') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.byTenant(tenant?.id || '') }),
      ]);

      logger.debug('All settings refreshed', { component: 'useSettingsSync' });
    } catch (error) {
      logger.error('Failed to refresh settings', error, { component: 'useSettingsSync' });
    }
  }, [refreshGlobal, queryClient, tenant?.id]);

  // Log settings sync status
  useEffect(() => {
    if (!isLoading && tenant?.id) {
      logger.debug('Settings synchronized', {
        component: 'useSettingsSync',
        hasGeneral: !!globalSettings.general.companyName,
        hasSidebar: !!sidebarPrefs,
        hasPayment: !!paymentSettings,
        hasStorefront: !!storefrontSettings,
      });
    }
  }, [isLoading, tenant?.id, globalSettings, sidebarPrefs, paymentSettings, storefrontSettings]);

  return {
    ...unifiedSettings,
    updateGeneral: updateGeneralSettings,
    updateSecurity: updateSecuritySettings,
    updateNotifications: updateNotificationSettings,
    updateTheme,
    updateSidebar,
    refreshAll,
  };
}

/**
 * Hook to check if settings have been fully loaded
 */
export function useSettingsReady(): boolean {
  const { isLoading } = useSettingsSync();
  return !isLoading;
}

/**
 * Hook to get settings for a specific feature
 */
export function useFeatureSettings<K extends keyof UnifiedSettings>(feature: K): UnifiedSettings[K] {
  const settings = useSettingsSync();
  return settings[feature];
}

/**
 * Hook to subscribe to settings changes
 */
export function useSettingsChangeListener(
  onSettingsChange: (settings: UnifiedSettings) => void
) {
  const settings = useSettingsSync();

  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);
}

/**
 * Hook to access only sidebar-related settings
 */
export function useSidebarSettingsSync() {
  const { sidebar, updateSidebar, isLoading } = useSettingsSync();

  return {
    preferences: sidebar,
    updatePreferences: updateSidebar,
    isLoading,
    // Convenience getters
    operationSize: sidebar?.operationSize ?? null,
    hiddenFeatures: sidebar?.hiddenFeatures ?? [],
    favorites: sidebar?.favorites ?? [],
    collapsedSections: sidebar?.collapsedSections ?? [],
    layoutPreset: sidebar?.layoutPreset ?? 'default',
  };
}

/**
 * Hook to access theme settings with sync capabilities
 */
export function useThemeSettingsSync() {
  const { theme, updateTheme } = useSettingsSync();

  return {
    theme,
    setTheme: updateTheme,
    isDarkMode: theme === 'dark',
    isLightMode: theme === 'light',
    toggleTheme: () => updateTheme(theme === 'light' ? 'dark' : 'light'),
  };
}

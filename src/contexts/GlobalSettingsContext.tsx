/**
 * GlobalSettingsContext
 *
 * Provides centralized access to global settings throughout the application.
 * This context aggregates settings from multiple sources and provides
 * real-time updates when settings change.
 *
 * Features:
 * - Centralized settings access without prop drilling
 * - Automatic sync with database changes
 * - Type-safe settings interface
 * - Optimistic updates for instant feedback
 */

import { createContext, useContext, ReactNode, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from '@/contexts/AccountContext';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { useTenantPaymentSettings } from '@/hooks/usePaymentSettings';
import { useStorefrontSettings } from '@/hooks/useStorefrontSettings';
import { logger } from '@/lib/logger';
import type { SidebarPreferences } from '@/types/sidebar';
import type { PaymentSettings } from '@/hooks/usePaymentSettings';
import type { StorefrontSettings } from '@/hooks/useStorefrontSettings';

// Types
export interface SecuritySettings {
  twoFactorEnabled: boolean;
  requirePasswordChange: boolean;
  sessionTimeout: number;
  passwordMinLength: number;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  lowStockAlerts: boolean;
  overdueAlerts: boolean;
  orderAlerts: boolean;
}

export interface GeneralSettings {
  companyName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
}

export interface GlobalSettingsContextValue {
  // Core settings
  general: GeneralSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;

  // Feature-specific settings
  sidebar: SidebarPreferences | null;
  payment: PaymentSettings | null;
  storefront: StorefrontSettings | null;

  // Theme
  theme: 'light' | 'dark';

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  refreshSettings: () => Promise<void>;

  // Feature flags derived from settings
  features: {
    isTwoFactorEnabled: boolean;
    isEmailNotificationsEnabled: boolean;
    isSmsNotificationsEnabled: boolean;
    isLowStockAlertsEnabled: boolean;
    hasStorefront: boolean;
    hasPaymentSettings: boolean;
  };
}

const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  twoFactorEnabled: false,
  requirePasswordChange: false,
  sessionTimeout: 30,
  passwordMinLength: 8,
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailNotifications: true,
  smsNotifications: false,
  lowStockAlerts: true,
  overdueAlerts: true,
  orderAlerts: true,
};

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  companyName: '',
  email: null,
  phone: null,
  address: null,
  timezone: 'America/New_York',
  currency: 'USD',
};

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | undefined>(undefined);

interface GlobalSettingsProviderProps {
  children: ReactNode;
}

export function GlobalSettingsProvider({ children }: GlobalSettingsProviderProps) {
  const queryClient = useQueryClient();
  const { account, accountSettings, loading: accountLoading, refreshAccount } = useAccount();
  const { tenant } = useTenantAdminAuth();

  // Get settings from various sources
  const { preferences: sidebarPrefs, isLoading: sidebarLoading } = useSidebarPreferences();
  const { data: paymentSettings, isLoading: paymentLoading } = useTenantPaymentSettings();
  const { data: storefrontSettings, isLoading: storefrontLoading } = useStorefrontSettings();

  // Derive general settings
  const general = useMemo((): GeneralSettings => {
    if (!account) return DEFAULT_GENERAL_SETTINGS;

    const metadata = (account as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;

    return {
      companyName: account.company_name || '',
      email: account.billing_email || null,
      phone: (metadata?.phone as string) || null,
      address: (metadata?.address as string) || null,
      timezone: 'America/New_York',
      currency: 'USD',
    };
  }, [account]);

  // Derive security settings
  const security = useMemo((): SecuritySettings => {
    if (!account) return DEFAULT_SECURITY_SETTINGS;

    const metadata = (account as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    const securityData = (metadata?.security as Partial<SecuritySettings>) || {};

    return {
      ...DEFAULT_SECURITY_SETTINGS,
      ...securityData,
    };
  }, [account]);

  // Derive notification settings
  const notifications = useMemo((): NotificationSettings => {
    if (!accountSettings) return DEFAULT_NOTIFICATION_SETTINGS;

    const notifData = (accountSettings.notification_settings as Partial<NotificationSettings>) || {};

    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...notifData,
    };
  }, [accountSettings]);

  // Get theme from localStorage
  const theme = useMemo((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem('theme');
    return stored === 'dark' ? 'dark' : 'light';
  }, []);

  // Loading state
  const isLoading = accountLoading || sidebarLoading || paymentLoading || storefrontLoading;
  const isInitialized = !accountLoading && account !== null;

  // Refresh all settings
  const refreshSettings = useCallback(async () => {
    try {
      await refreshAccount();
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['sidebar-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-payment-settings'] });
      queryClient.invalidateQueries({ queryKey: ['storefront-settings'] });
    } catch (error) {
      logger.error('Failed to refresh settings', error, { component: 'GlobalSettingsContext' });
    }
  }, [refreshAccount, queryClient]);

  // Feature flags derived from settings
  const features = useMemo(() => ({
    isTwoFactorEnabled: security.twoFactorEnabled,
    isEmailNotificationsEnabled: notifications.emailNotifications,
    isSmsNotificationsEnabled: notifications.smsNotifications,
    isLowStockAlertsEnabled: notifications.lowStockAlerts,
    hasStorefront: !!storefrontSettings?.id,
    hasPaymentSettings: !!(paymentSettings && Object.keys(paymentSettings).length > 0),
  }), [security, notifications, storefrontSettings, paymentSettings]);

  // Log settings initialization
  useEffect(() => {
    if (isInitialized) {
      logger.debug('Global settings initialized', {
        component: 'GlobalSettingsContext',
        hasAccount: !!account,
        hasTenant: !!tenant,
        hasStorefront: features.hasStorefront,
      });
    }
  }, [isInitialized, account, tenant, features.hasStorefront]);

  const value: GlobalSettingsContextValue = {
    general,
    security,
    notifications,
    sidebar: sidebarPrefs,
    payment: paymentSettings || null,
    storefront: storefrontSettings || null,
    theme,
    isLoading,
    isInitialized,
    refreshSettings,
    features,
  };

  return (
    <GlobalSettingsContext.Provider value={value}>
      {children}
    </GlobalSettingsContext.Provider>
  );
}

/**
 * Hook to access global settings
 */
export function useGlobalSettingsContext(): GlobalSettingsContextValue {
  const context = useContext(GlobalSettingsContext);
  if (context === undefined) {
    throw new Error('useGlobalSettingsContext must be used within a GlobalSettingsProvider');
  }
  return context;
}

/**
 * Hook to check if a specific feature is enabled based on settings
 */
export function useFeatureEnabled(featureName: keyof GlobalSettingsContextValue['features']): boolean {
  const { features } = useGlobalSettingsContext();
  return features[featureName];
}

/**
 * Hook to get notification settings
 */
export function useNotificationSettings(): NotificationSettings & { isLoading: boolean } {
  const { notifications, isLoading } = useGlobalSettingsContext();
  return { ...notifications, isLoading };
}

/**
 * Hook to get security settings
 */
export function useSecuritySettingsContext(): SecuritySettings & { isLoading: boolean } {
  const { security, isLoading } = useGlobalSettingsContext();
  return { ...security, isLoading };
}

/**
 * Hook to check if notifications of a specific type are enabled
 */
export function useIsNotificationEnabled(type: keyof NotificationSettings): boolean {
  const { notifications } = useGlobalSettingsContext();
  return notifications[type];
}

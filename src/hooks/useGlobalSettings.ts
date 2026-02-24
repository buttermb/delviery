/**
 * useGlobalSettings Hook
 *
 * Centralized hook for accessing all global configuration settings.
 * This hook aggregates settings from multiple sources and provides
 * a unified interface for features across the application.
 *
 * Settings Sources:
 * - Account settings (from accounts table)
 * - Notification settings (from account_settings table)
 * - Security settings (from account metadata)
 * - Theme preferences (from ThemeContext + localStorage)
 * - Sidebar preferences (from sidebar_preferences table)
 * - Payment settings (from tenant_payment_settings table)
 * - Storefront settings (from marketplace_stores table)
 */

import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { STORAGE_KEYS } from '@/constants/storageKeys';

// Types
export interface SecuritySettings {
  twoFactorEnabled: boolean;
  requirePasswordChange: boolean;
  sessionTimeout: number; // in minutes
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

export interface GlobalSettings {
  general: GeneralSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
  theme: 'light' | 'dark';
  isLoading: boolean;
  lastUpdated: string | null;
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

/**
 * Hook to access and manage global settings
 */
export function useGlobalSettings() {
  const { account, accountSettings, loading: accountLoading, refreshAccount } = useAccount();

  // Derive settings from account data
  const settings = useMemo((): GlobalSettings => {
    // General settings from account
    const general: GeneralSettings = account ? {
      companyName: account.company_name || '',
      email: account.billing_email || null,
      phone: ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>)?.phone as string | null || null,
      address: ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>)?.address as string | null || null,
      timezone: 'America/New_York', // TODO: Make configurable
      currency: 'USD', // TODO: Make configurable
    } : DEFAULT_GENERAL_SETTINGS;

    // Security settings from account metadata
    const securityMetadata = ((account as unknown as Record<string, unknown>)?.metadata as Record<string, unknown>)?.security as Partial<SecuritySettings> || {};
    const security: SecuritySettings = {
      ...DEFAULT_SECURITY_SETTINGS,
      ...securityMetadata,
    };

    // Notification settings from account_settings
    const notifSettings = (accountSettings?.notification_settings as Partial<NotificationSettings>) || {};
    const notifications: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...notifSettings,
    };

    // Theme from localStorage (ThemeContext handles this)
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.THEME) : null;
    const theme = (storedTheme === 'dark' || storedTheme === 'light') ? storedTheme : 'light';

    return {
      general,
      security,
      notifications,
      theme,
      isLoading: accountLoading,
      lastUpdated: account ? (account as unknown as Record<string, unknown>).updated_at as string || null : null,
    };
  }, [account, accountSettings, accountLoading]);

  // Mutation to update general settings
  const updateGeneralSettings = useMutation({
    mutationFn: async (updates: Partial<GeneralSettings>) => {
      if (!account) throw new Error('No account found');

      const currentMetadata = ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('accounts')
        .update({
          company_name: updates.companyName ?? account.company_name,
          billing_email: updates.email ?? account.billing_email,
          metadata: {
            ...currentMetadata,
            phone: updates.phone ?? currentMetadata.phone,
            address: updates.address ?? currentMetadata.address,
          } as Record<string, unknown>,
        })
        .eq('id', account.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refreshAccount();
      toast.success('General settings updated');
    },
    onError: (error) => {
      logger.error('Failed to update general settings', error, { component: 'useGlobalSettings' });
      toast.error('Failed to update settings', { description: humanizeError(error) });
    },
  });

  // Mutation to update security settings
  const updateSecuritySettings = useMutation({
    mutationFn: async (updates: Partial<SecuritySettings>) => {
      if (!account) throw new Error('No account found');

      const currentMetadata = ((account as unknown as Record<string, unknown>).metadata as Record<string, unknown>) || {};
      const currentSecurity = (currentMetadata.security as Partial<SecuritySettings>) || {};

      const { error } = await supabase
        .from('accounts')
        .update({
          metadata: {
            ...currentMetadata,
            security: {
              ...currentSecurity,
              ...updates,
            },
          },
        })
        .eq('id', account.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refreshAccount();
      toast.success('Security settings updated');
    },
    onError: (error) => {
      logger.error('Failed to update security settings', error, { component: 'useGlobalSettings' });
      toast.error('Failed to update security settings', { description: humanizeError(error) });
    },
  });

  // Mutation to update notification settings
  const updateNotificationSettings = useMutation({
    mutationFn: async (updates: Partial<NotificationSettings>) => {
      if (!account) throw new Error('No account found');

      const currentNotifSettings = (accountSettings?.notification_settings as Partial<NotificationSettings>) || {};

      if (accountSettings) {
        const { error } = await supabase
          .from('account_settings')
          .update({
            notification_settings: {
              ...currentNotifSettings,
              ...updates,
            } as Record<string, unknown>,
          })
          .eq('id', accountSettings.id);

        if (error) throw error;
      } else {
        // Create new account settings record
        const { error } = await supabase
          .from('account_settings')
          .insert([{
            account_id: account.id,
            notification_settings: {
              ...DEFAULT_NOTIFICATION_SETTINGS,
              ...updates,
            } as Record<string, unknown>,
          }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      refreshAccount();
      toast.success('Notification settings updated');
    },
    onError: (error) => {
      logger.error('Failed to update notification settings', error, { component: 'useGlobalSettings' });
      toast.error('Failed to update notification settings', { description: humanizeError(error) });
    },
  });

  return {
    settings,
    isLoading: accountLoading,
    updateGeneralSettings: updateGeneralSettings.mutate,
    updateSecuritySettings: updateSecuritySettings.mutate,
    updateNotificationSettings: updateNotificationSettings.mutate,
    isPendingGeneral: updateGeneralSettings.isPending,
    isPendingSecurity: updateSecuritySettings.isPending,
    isPendingNotifications: updateNotificationSettings.isPending,
    refreshSettings: refreshAccount,
  };
}

/**
 * Hook to check if a specific notification type is enabled
 */
export function useNotificationEnabled(notificationType: keyof NotificationSettings): boolean {
  const { settings } = useGlobalSettings();
  return settings.notifications[notificationType];
}

/**
 * Hook to get security settings for validation
 */
export function useSecuritySettings(): SecuritySettings & { isLoading: boolean } {
  const { settings, isLoading } = useGlobalSettings();
  return {
    ...settings.security,
    isLoading,
  };
}

/**
 * Hook to get session timeout setting
 */
export function useSessionTimeout(): number {
  const { settings } = useGlobalSettings();
  return settings.security.sessionTimeout;
}

/**
 * Hook to check if 2FA is enabled
 */
export function useTwoFactorEnabled(): boolean {
  const { settings } = useGlobalSettings();
  return settings.security.twoFactorEnabled;
}

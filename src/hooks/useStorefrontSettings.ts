/**
 * useStorefrontSettings Hook
 *
 * Provides query and mutation hooks for storefront settings with:
 * - Optimistic updates for instant UI feedback
 * - Automatic rollback on error
 * - Query invalidation on success
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// Types
interface DeliveryZone {
  zip_code: string;
  fee: number;
  min_order?: number;
}

interface TimeSlot {
  label: string;
  start: string;
  end: string;
  enabled: boolean;
}

interface ThemeConfig {
  theme: 'standard' | 'luxury';
  colors?: {
    accent?: string;
  };
}

interface CheckoutSettings {
  allow_guest_checkout: boolean;
  require_phone: boolean;
  require_address: boolean;
  show_delivery_notes: boolean;
  enable_coupons: boolean;
  enable_tips: boolean;
}

interface PurchaseLimits {
  enabled: boolean;
  max_per_order: number | null;
  max_daily: number | null;
  max_weekly: number | null;
}

interface OperatingHours {
  [day: string]: {
    open: string;
    close: string;
    closed: boolean;
  };
}

export interface StorefrontSettings {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  encrypted_url_token: string | null;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  custom_domain: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  ga4_measurement_id: string | null;
  is_active: boolean;
  is_public: boolean;
  require_account: boolean;
  require_age_verification: boolean;
  minimum_age: number;
  delivery_zones: DeliveryZone[];
  payment_methods: string[];
  time_slots: TimeSlot[];
  theme_config: ThemeConfig | null;
  free_delivery_threshold: number;
  default_delivery_fee: number;
  checkout_settings: CheckoutSettings;
  operating_hours: OperatingHours;
  purchase_limits: PurchaseLimits | null;
  featured_product_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export type StorefrontSettingsInput = Partial<Omit<StorefrontSettings, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;

interface UseStorefrontSettingsOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch storefront settings for the current tenant
 */
export function useStorefrontSettings(options: UseStorefrontSettingsOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.storefrontSettings.byTenant(tenant?.id || ''),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists in database
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to fetch storefront settings', error, { component: 'useStorefrontSettings' });
        throw error;
      }

      return data as unknown as StorefrontSettings | null;
    },
    enabled: enabled && !!tenant?.id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

/**
 * Hook to save storefront settings with optimistic updates and rollback
 */
export function useSaveStorefrontSettings() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storeId, settings }: { storeId: string; settings: StorefrontSettingsInput }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists in database
      const { data, error } = await (supabase as any)
        .from('marketplace_stores')
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', storeId)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to save storefront settings', { storeId, error }, { component: 'useSaveStorefrontSettings' });
        throw error;
      }

      return data as unknown as StorefrontSettings;
    },
    onMutate: async ({ storeId, settings }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.storefrontSettings.byTenant(tenant?.id || '') });
      await queryClient.cancelQueries({ queryKey: queryKeys.storefrontSettings.detail(storeId) });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<StorefrontSettings>(
        queryKeys.storefrontSettings.byTenant(tenant?.id || '')
      );

      // Optimistically update to the new value
      if (previousSettings) {
        const optimisticSettings: StorefrontSettings = {
          ...previousSettings,
          ...settings,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<StorefrontSettings>(
          queryKeys.storefrontSettings.byTenant(tenant?.id || ''),
          optimisticSettings
        );

        queryClient.setQueryData<StorefrontSettings>(
          queryKeys.storefrontSettings.detail(storeId),
          optimisticSettings
        );
      }

      // Return context with the previous value for rollback
      return { previousSettings, storeId };
    },
    onError: (error, _variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousSettings) {
        queryClient.setQueryData<StorefrontSettings>(
          queryKeys.storefrontSettings.byTenant(tenant?.id || ''),
          context.previousSettings
        );

        if (context.storeId) {
          queryClient.setQueryData<StorefrontSettings>(
            queryKeys.storefrontSettings.detail(context.storeId),
            context.previousSettings
          );
        }
      }

      const message = error instanceof Error ? error.message : 'Failed to save settings';
      logger.error('Storefront settings save failed', error, { component: 'useSaveStorefrontSettings' });
      toast.error('Failed to save settings', { description: message });
    },
    onSuccess: (data) => {
      // Update cache with actual server response
      queryClient.setQueryData<StorefrontSettings>(
        queryKeys.storefrontSettings.byTenant(tenant?.id || ''),
        data
      );

      if (data?.id) {
        queryClient.setQueryData<StorefrontSettings>(
          queryKeys.storefrontSettings.detail(data.id),
          data
        );
      }

      toast.success('Settings saved', { description: 'Your storefront settings have been updated.' });
    },
    onSettled: (_data, _error, variables) => {
      // Invalidate related queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.byTenant(tenant?.id || '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.detail(variables.storeId) });
      // Also invalidate the legacy query key used in StorefrontSettings.tsx
      queryClient.invalidateQueries({ queryKey: ['marketplace-store', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
    },
  });
}

/**
 * Hook to update a single field in storefront settings with optimistic updates
 * Useful for toggle switches and inline edits
 */
export function useUpdateStorefrontSettingsField() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storeId,
      field,
      value
    }: {
      storeId: string;
      field: keyof StorefrontSettingsInput;
      value: unknown;
    }) => {
      if (!tenant?.id) throw new Error('No tenant');

      // @ts-ignore - Table exists in database
      const { data, error } = await supabase
        .from('marketplace_stores')
        .update({
          [field]: value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storeId)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update storefront field', { storeId, field, error }, { component: 'useUpdateStorefrontSettingsField' });
        throw error;
      }

      return data as StorefrontSettings;
    },
    onMutate: async ({ storeId, field, value }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.storefrontSettings.byTenant(tenant?.id || '') });

      const previousSettings = queryClient.getQueryData<StorefrontSettings>(
        queryKeys.storefrontSettings.byTenant(tenant?.id || '')
      );

      if (previousSettings) {
        const optimisticSettings: StorefrontSettings = {
          ...previousSettings,
          [field]: value,
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<StorefrontSettings>(
          queryKeys.storefrontSettings.byTenant(tenant?.id || ''),
          optimisticSettings
        );
      }

      return { previousSettings, storeId, field };
    },
    onError: (error, _variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData<StorefrontSettings>(
          queryKeys.storefrontSettings.byTenant(tenant?.id || ''),
          context.previousSettings
        );
      }

      const message = error instanceof Error ? error.message : 'Failed to update setting';
      logger.error('Storefront field update failed', error, { component: 'useUpdateStorefrontSettingsField' });
      toast.error('Failed to update setting', { description: message });
    },
    onSuccess: () => {
      toast.success('Setting updated');
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.byTenant(tenant?.id || '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontSettings.detail(variables.storeId) });
      queryClient.invalidateQueries({ queryKey: ['marketplace-store', tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
    },
  });
}

/**
 * Hook to fetch storefront settings by store ID (for non-tenant contexts)
 */
export function useStorefrontSettingsByStoreId(storeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.storefrontSettings.detail(storeId || ''),
    queryFn: async () => {
      if (!storeId) throw new Error('No store ID');

      // @ts-ignore - Table exists in database
      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('id', storeId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch storefront settings by ID', { storeId, error }, { component: 'useStorefrontSettingsByStoreId' });
        throw error;
      }

      return data as StorefrontSettings | null;
    },
    enabled: !!storeId,
    staleTime: 30000,
  });
}

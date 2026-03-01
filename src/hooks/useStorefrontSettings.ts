/**
 * Storefront Settings Hook
 * Fetches and manages storefront configuration for the current tenant
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface StorefrontSettings {
  id: string;
  tenant_id: string;
  store_name: string | null;
  store_description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  custom_css: string | null;
  custom_domain: string | null;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  social_links: Record<string, string> | null;
  business_hours: Record<string, unknown> | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch storefront settings for the current tenant
 */
export function useStorefrontSettings() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.storefrontSettingsHook.byTenant(tenant?.id),
    queryFn: async (): Promise<StorefrontSettings | null> => {
      if (!tenant?.id) return null;

      try {
        const { data, error } = await supabase
          .from('storefront_settings')
          .select('*')
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (error && error.code !== '42P01') {
          logger.error('Failed to fetch storefront settings', error, {
            component: 'useStorefrontSettings',
          });
          return null;
        }

        return data as StorefrontSettings | null;
      } catch (error) {
        logger.error('Error fetching storefront settings', error, {
          component: 'useStorefrontSettings',
        });
        return null;
      }
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes — store config changes infrequently
  });
}

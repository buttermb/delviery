import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

interface StorefrontTheme {
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_url: string;
  custom_css: string;
}

export function useStorefrontTheme(tenantSlug?: string) {
  const { data: theme } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenantSlug, 'storefront_theme'),
    queryFn: async () => {
      if (!tenantSlug) return null;

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, metadata')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (!tenant) return null;

      const metadata = tenant.metadata as Record<string, unknown> || {};
      const themeSettings = metadata.storefront_theme as StorefrontTheme | undefined;

      return themeSettings || null;
    },
    enabled: !!tenantSlug,
  });

  useEffect(() => {
    if (!theme) return;

    const root = document.documentElement;

    if (theme.primary_color) {
      root.style.setProperty('--primary', theme.primary_color);
    }

    if (theme.secondary_color) {
      root.style.setProperty('--secondary', theme.secondary_color);
    }

    if (theme.font_family) {
      root.style.setProperty('--font-family', theme.font_family);
    }

    if (theme.custom_css) {
      const styleEl = document.createElement('style');
      styleEl.id = 'storefront-custom-css';
      styleEl.textContent = theme.custom_css;
      document.head.appendChild(styleEl);

      return () => {
        const el = document.getElementById('storefront-custom-css');
        if (el) el.remove();
      };
    }
  }, [theme]);

  return theme;
}

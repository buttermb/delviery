import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Hook to fetch Mapbox token from tenant settings
 * Falls back to environment variable if not set in database
 */
export function useMapboxToken() {
  const [token, setToken] = useState<string | null>(import.meta.env.VITE_MAPBOX_TOKEN || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: tenantUser } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (!tenantUser) {
          setLoading(false);
          return;
        }

        const { data: settings } = await supabase
          .from('account_settings')
          .select('integration_settings')
          .eq('account_id', tenantUser.tenant_id)
          .single();

        const integrationSettings = settings?.integration_settings as Record<string, any> | null;
        if (integrationSettings && typeof integrationSettings === 'object' && integrationSettings.mapbox_token) {
          setToken(integrationSettings.mapbox_token as string);
        }
      } catch (error) {
        logger.error('Failed to load Mapbox token', error, { component: 'useMapboxToken' });
      } finally {
        setLoading(false);
      }
    };

    if (!token || token === import.meta.env.VITE_MAPBOX_TOKEN) {
      loadToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  return { token, loading };
}

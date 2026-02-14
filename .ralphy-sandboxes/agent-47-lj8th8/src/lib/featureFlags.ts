import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Default flags as fallback when database is unavailable
const defaultFlags: Record<string, boolean> = {
  'multi_tenant': true,
  'advanced_analytics': false,
  'ai_recommendations': true,
  'USE_HTTP_ONLY_COOKIES': true,
  'ENABLE_RATE_LIMITING': true,
  'ENABLE_CAPTCHA': true,
};

// Cache for feature flags to avoid repeated DB calls
const flagsCache: Map<string, { enabled: boolean; cachedAt: number }> = new Map();
const CACHE_TTL = 60000; // 1 minute cache

export async function isFeatureEnabled(flagKey: string, tenantId?: string): Promise<boolean> {
  try {
    // Check cache first
    const cacheKey = `${flagKey}:${tenantId || 'global'}`;
    const cached = flagsCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.enabled;
    }

    // Query from feature_flags table
    let query = supabase
      .from('feature_flags')
      .select('enabled')
      .eq('flag_name', flagKey);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.warn(`Feature flag query failed for ${flagKey}`, { message: error.message });
      return defaultFlags[flagKey] ?? false;
    }

    if (data) {
      flagsCache.set(cacheKey, { enabled: data.enabled, cachedAt: Date.now() });
      return data.enabled;
    }

    return defaultFlags[flagKey] ?? false;
  } catch (error) {
    logger.warn(`Feature flag error for ${flagKey}`, error);
    return defaultFlags[flagKey] ?? false;
  }
}

export async function getFeatureFlags(tenantId?: string): Promise<Array<{ flag_key: string; enabled: boolean; rollout_percentage: number }>> {
  try {
    let query = supabase.from('feature_flags').select('flag_name, enabled');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn('Failed to fetch feature flags', { message: error.message });
      return Object.entries(defaultFlags).map(([key, enabled]) => ({
        flag_key: key,
        enabled,
        rollout_percentage: enabled ? 100 : 0,
      }));
    }

    return (data || []).map(f => ({
      flag_key: f.flag_name,
      enabled: f.enabled,
      rollout_percentage: f.enabled ? 100 : 0,
    }));
  } catch (error) {
    logger.warn('Feature flags error', error);
    return Object.entries(defaultFlags).map(([key, enabled]) => ({
      flag_key: key,
      enabled,
      rollout_percentage: enabled ? 100 : 0,
    }));
  }
}

export function clearFeatureFlagCache(): void {
  flagsCache.clear();
}

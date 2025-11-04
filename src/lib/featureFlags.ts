/**
 * Feature Flag Helper
 * Check feature flags for tenants and platform
 */

import { supabase } from '@/integrations/supabase/client';

export interface FeatureFlag {
  flag_key: string;
  enabled: boolean;
  rollout_percentage: number;
  target_tenants: string[] | null;
}

/**
 * Check if a feature flag is enabled for a tenant
 */
export async function isFeatureEnabled(
  flagKey: string,
  tenantId?: string
): Promise<boolean> {
  try {
    // Check for tenant-specific override first
    if (tenantId) {
      const { data: override } = await supabase
        .from('tenant_feature_overrides')
        .select('enabled')
        .eq('tenant_id', tenantId)
        .eq('flag_key', flagKey)
        .maybeSingle();

      if (override) {
        return override.enabled;
      }
    }

    // Get the feature flag
    const { data: flag } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('flag_key', flagKey)
      .maybeSingle();

    if (!flag) {
      return false; // Flag doesn't exist, disabled by default
    }

    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rollout_percentage < 100) {
      // Simple hash-based rollout (in production, use consistent hashing)
      if (tenantId) {
        const hash = hashString(tenantId + flagKey);
        const percentage = hash % 100;
        return percentage < flag.rollout_percentage;
      }
      return false; // No tenant ID, can't determine rollout
    }

    // Check if tenant is in target list
    if (flag.target_tenants && flag.target_tenants.length > 0) {
      if (tenantId) {
        return flag.target_tenants.includes(tenantId);
      }
      return false;
    }

    return true; // Fully enabled
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return false; // Fail closed
  }
}

/**
 * Simple string hash function
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get all feature flags for a tenant
 */
export async function getFeatureFlags(tenantId?: string): Promise<Record<string, boolean>> {
  try {
    const { data: flags } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('enabled', true);

    if (!flags) return {};

    const result: Record<string, boolean> = {};

    for (const flag of flags) {
      result[flag.flag_key] = await isFeatureEnabled(flag.flag_key, tenantId);
    }

    return result;
  } catch (error) {
    console.error('Error getting feature flags:', error);
    return {};
  }
}


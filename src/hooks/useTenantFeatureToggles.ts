import { useCallback, useMemo } from 'react';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import { FEATURE_TOGGLE_DEFAULTS, type FeatureToggleKey } from '@/lib/featureFlags';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

interface UseTenantFeatureTogglesReturn {
  isEnabled: (flag: FeatureToggleKey) => boolean;
  toggleFeature: (flag: FeatureToggleKey, enabled: boolean) => Promise<void>;
  flags: Record<FeatureToggleKey, boolean>;
  isLoading: boolean;
}

/**
 * Hook for reading and writing per-tenant feature toggles.
 *
 * Reads the `feature_toggles` JSONB column from the `tenants` table,
 * merges with FEATURE_TOGGLE_DEFAULTS, and provides toggle mutations.
 * Falls back to defaults when the query fails or data is unavailable.
 *
 * Uses TanStack Query with 5-minute staleTime to minimise DB calls.
 */
export function useTenantFeatureToggles(): UseTenantFeatureTogglesReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id ?? null;
  const queryClient = useQueryClient();

  const queryKey = queryKeys.featureToggles.byTenant(tenantId);

  // Fetch feature_toggles from the tenants table
  const { data: dbToggles, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Record<string, boolean>> => {
      if (!tenantId) return {};

      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('feature_toggles')
          .eq('id', tenantId)
          .maybeSingle();

        if (error) {
          logger.warn('[FeatureToggles] Failed to fetch toggles', { message: error.message });
          return {};
        }

        // feature_toggles is JSONB, may be null or an object
        const toggles = (data as Record<string, unknown> | null)?.feature_toggles;
        if (toggles && typeof toggles === 'object' && !Array.isArray(toggles)) {
          return toggles as Record<string, boolean>;
        }
        return {};
      } catch (err) {
        logger.warn('[FeatureToggles] Query error, returning defaults', err instanceof Error ? err : new Error(String(err)));
        return {};
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    placeholderData: {},
  });

  // Merge defaults with DB overrides (DB values take precedence)
  const flags = useMemo<Record<FeatureToggleKey, boolean>>(() => {
    return {
      ...FEATURE_TOGGLE_DEFAULTS,
      ...(dbToggles ?? {}),
    } as Record<FeatureToggleKey, boolean>;
  }, [dbToggles]);

  const isEnabled = useCallback(
    (flag: FeatureToggleKey): boolean => {
      if (flag in flags) return flags[flag];
      return FEATURE_TOGGLE_DEFAULTS[flag] ?? false;
    },
    [flags],
  );

  // Mutation to update a single toggle
  const { mutateAsync } = useMutation({
    mutationFn: async ({ flag, enabled }: { flag: FeatureToggleKey; enabled: boolean }) => {
      if (!tenantId) throw new Error('No tenant context');

      // Merge with current DB toggles
      const current: Record<string, boolean> = { ...(dbToggles ?? {}) };
      current[flag] = enabled;

      const { error } = await supabase
        .from('tenants')
        .update({ feature_toggles: current } as Record<string, unknown>)
        .eq('id', tenantId);

      if (error) throw error;

      return current;
    },
    onMutate: async ({ flag, enabled }) => {
      // Cancel in-flight fetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot for rollback
      const previous = queryClient.getQueryData<Record<string, boolean>>(queryKey);

      // Optimistic update
      queryClient.setQueryData<Record<string, boolean>>(queryKey, (old) => ({
        ...(old ?? {}),
        [flag]: enabled,
      }));

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      logger.error('[FeatureToggles] Failed to update toggle', _err instanceof Error ? _err : new Error(String(_err)));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleFeature = useCallback(
    async (flag: FeatureToggleKey, enabled: boolean): Promise<void> => {
      await mutateAsync({ flag, enabled });
    },
    [mutateAsync],
  );

  return {
    isEnabled,
    toggleFeature,
    flags,
    isLoading,
  };
}

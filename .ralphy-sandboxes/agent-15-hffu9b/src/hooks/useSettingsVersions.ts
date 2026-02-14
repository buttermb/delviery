import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

export interface SettingsVersion {
  id: string;
  settings_key: string;
  snapshot: Record<string, unknown>;
  changed_fields: string[];
  changed_by: string | null;
  changed_by_email: string | null;
  version_number: number;
  description: string | null;
  created_at: string;
}

interface UseSettingsVersionsOptions {
  tenantId: string | undefined;
  settingsKey: string;
  enabled?: boolean;
}

interface SaveVersionOptions {
  tenantId: string;
  settingsKey: string;
  snapshot: Record<string, unknown>;
  changedFields?: string[];
  changedBy?: string;
  changedByEmail?: string;
  description?: string;
}

/**
 * Hook for fetching and managing settings version history
 * Returns the last 10 versions of settings for a given category
 */
export function useSettingsVersions({
  tenantId,
  settingsKey,
  enabled = true,
}: UseSettingsVersionsOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.settingsVersions.byKey(tenantId ?? '', settingsKey),
    queryFn: async (): Promise<SettingsVersion[]> => {
      if (!tenantId) return [];

      const { data, error } = await (supabase as any).rpc('get_settings_versions', {
        p_tenant_id: tenantId,
        p_settings_key: settingsKey,
        p_limit: 10,
      });

      if (error) {
        logger.error('Failed to fetch settings versions', { error, tenantId, settingsKey });
        throw error;
      }

      return (data ?? []) as unknown as SettingsVersion[];
    },
    enabled: enabled && !!tenantId,
    staleTime: 30000, // 30 seconds
  });

  const saveVersionMutation = useMutation({
    mutationFn: async ({
      tenantId: tid,
      settingsKey: key,
      snapshot,
      changedFields = [],
      changedBy,
      changedByEmail,
      description,
    }: SaveVersionOptions) => {
      const { data, error } = await (supabase as any).rpc('save_settings_version', {
        p_tenant_id: tid,
        p_settings_key: key,
        p_snapshot: snapshot,
        p_changed_fields: changedFields,
        p_changed_by: changedBy ?? null,
        p_changed_by_email: changedByEmail ?? null,
        p_description: description ?? null,
      });

      if (error) {
        logger.error('Failed to save settings version', { error, tid, key });
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the versions query to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.settingsVersions.byKey(variables.tenantId, variables.settingsKey),
      });
    },
  });

  return {
    versions: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    saveVersion: saveVersionMutation.mutate,
    saveVersionAsync: saveVersionMutation.mutateAsync,
    isSaving: saveVersionMutation.isPending,
  };
}

/**
 * Calculates which fields changed between two settings objects
 */
export function getChangedFields(
  oldSettings: Record<string, unknown>,
  newSettings: Record<string, unknown>
): string[] {
  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(oldSettings), ...Object.keys(newSettings)]);

  for (const key of allKeys) {
    const oldValue = oldSettings[key];
    const newValue = newSettings[key];

    // Deep comparison for objects/arrays
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { getChangedFields } from '@/hooks/useSettingsVersions';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface VersionTrackingOptions {
  /** Enable version tracking for this setting */
  enabled: boolean;
  /** Tenant ID for the version */
  tenantId: string;
  /** Settings category key (e.g., 'business', 'payment') */
  settingsKey: string;
  /** Email of the user making the change */
  userEmail?: string;
  /** User ID making the change */
  userId?: string;
}

interface UseAutoSaveOptions<T> {
  onSave: (value: T) => Promise<void>;
  debounceMs?: number;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
  /** Options for tracking settings version history */
  versionTracking?: VersionTrackingOptions;
}

export function useAutoSave<T extends Record<string, unknown>>({
  onSave,
  debounceMs = 500,
  onError,
  onSuccess,
  versionTracking,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValue = useRef<T | null>(null);
  const previousValue = useRef<T | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (value: T) => {
      // First save the settings
      await onSave(value);

      // Then save version if tracking is enabled
      if (versionTracking?.enabled && versionTracking.tenantId) {
        try {
          const changedFields = previousValue.current
            ? getChangedFields(previousValue.current as Record<string, unknown>, value as Record<string, unknown>)
            : Object.keys(value);

          // Only save version if there are actual changes
          if (changedFields.length > 0) {
            await (supabase as any).rpc('save_settings_version', {
              p_tenant_id: versionTracking.tenantId,
              p_settings_key: versionTracking.settingsKey,
              p_snapshot: value,
              p_changed_fields: changedFields,
              p_changed_by: versionTracking.userId ?? null,
              p_changed_by_email: versionTracking.userEmail ?? null,
              p_description: null,
            });

            // Invalidate version history query
            queryClient.invalidateQueries({
              queryKey: queryKeys.settingsVersions.byKey(
                versionTracking.tenantId,
                versionTracking.settingsKey
              ),
            });
          }
        } catch (versionError) {
          // Log but don't fail the save if version tracking fails
          logger.warn('Failed to save settings version', { error: versionError });
        }
      }

      // Update previous value for next comparison
      previousValue.current = value;
    },
    onSuccess: () => {
      setStatus('saved');
      onSuccess?.();
      // Reset to idle after 2 seconds
      setTimeout(() => setStatus('idle'), 2000);
    },
    onError: (error: Error) => {
      setStatus('error');
      onError?.(error);
    },
  });

  const save = useCallback(
    (value: T) => {
      pendingValue.current = value;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setStatus('saving');

      // Debounce the save
      timeoutRef.current = setTimeout(() => {
        if (pendingValue.current !== null) {
          mutation.mutate(pendingValue.current);
        }
      }, debounceMs);
    },
    [debounceMs, mutation]
  );

  const saveImmediate = useCallback(
    (value: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setStatus('saving');
      mutation.mutate(value);
    },
    [mutation]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    save,
    saveImmediate,
    status,
    isLoading: status === 'saving',
    isError: status === 'error',
    isSaved: status === 'saved',
  };
}


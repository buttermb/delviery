/**
 * React hook for activity logging with tenant context auto-fill
 * Wraps the activityLog utility for convenient use in React components
 *
 * Usage:
 *   const { logActivity, recentActivity, isLoading } = useActivityLog();
 *   await logActivity('created', 'order', orderId, { total: 100 });
 */

import { useCallback, useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { ActivityLogEntry, ActivityActionType, ActivityMetadata } from '@/lib/activityLog';
import { logActivity as logActivityUtil, ActivityAction, EntityType } from '@/lib/activityLog';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * Filters for fetching activity logs
 */
export interface ActivityLogFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: ActivityActionType | string;
  limit?: number;
}

/**
 * Options for the useActivityLog hook
 */
export interface UseActivityLogOptions {
  /** Filters to apply when fetching activity logs */
  filters?: ActivityLogFilters;
  /** Whether to enable the activity query (default: true) */
  enabled?: boolean;
  /** Refetch interval in milliseconds (default: none) */
  refetchInterval?: number;
}

/**
 * Return type for the useActivityLog hook
 */
export interface UseActivityLogResult {
  /** Log an activity event with tenant/user context auto-filled */
  logActivity: (
    action: ActivityActionType | string,
    entityType: string,
    entityId?: string | null,
    metadata?: ActivityMetadata
  ) => Promise<void>;
  /** Recent activity log entries */
  recentActivity: ActivityLogEntry[];
  /** Whether activity data is loading */
  isLoading: boolean;
  /** Whether activity data is being fetched in the background */
  isFetching: boolean;
  /** Error from fetching activity */
  error: Error | null;
  /** Refetch activity data */
  refetch: () => Promise<unknown>;
  /** Invalidate activity cache */
  invalidateActivity: () => Promise<void>;
  /** Context is ready for logging */
  isReady: boolean;
}

/**
 * Fetch activity logs from Supabase with filters
 */
async function fetchActivityLogs(
  tenantId: string,
  filters: ActivityLogFilters
): Promise<ActivityLogEntry[]> {
  let query = supabase
    .from('activity_log')
    .select('id, tenant_id, user_id, action, entity_type, entity_id, metadata, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }

  if (filters.entityId) {
    query = query.eq('entity_id', filters.entityId);
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  } else {
    // Default limit to prevent fetching too many records
    query = query.limit(50);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('[useActivityLog] Failed to fetch activity logs', error, {
      tenantId,
      filters,
    });
    throw error;
  }

  return (data ?? []) as ActivityLogEntry[];
}

/**
 * Hook for activity logging with tenant context auto-fill and activity queries
 *
 * @param options - Configuration options for the hook
 * @returns Object with logActivity function, activity data, and loading states
 *
 * @example
 * ```tsx
 * // Basic usage - log activity
 * const { logActivity, isReady } = useActivityLog();
 *
 * if (isReady) {
 *   await logActivity('created', 'order', orderId, { total: 100 });
 * }
 *
 * // Fetch activity by entity
 * const { recentActivity, isLoading } = useActivityLog({
 *   filters: { entityType: 'order', entityId: orderId, limit: 10 }
 * });
 *
 * // Fetch activity by user
 * const { recentActivity } = useActivityLog({
 *   filters: { userId: someUserId, limit: 20 }
 * });
 * ```
 */
export function useActivityLog(options: UseActivityLogOptions = {}): UseActivityLogResult {
  const { filters = {}, enabled = true, refetchInterval } = options;
  const { tenantId, userId, isReady } = useTenantContext();
  const queryClient = useQueryClient();

  // Build query key based on filters
  const queryKey = useMemo(() => {
    if (!tenantId) return queryKeys.activity.all;

    if (filters.entityType && filters.entityId) {
      return queryKeys.activity.byEntity(tenantId, filters.entityType, filters.entityId);
    }

    if (filters.userId) {
      return queryKeys.activity.byUser(tenantId, filters.userId);
    }

    return queryKeys.activity.list(tenantId, filters as Record<string, unknown>);
  }, [tenantId, filters]);

  // Query for fetching activity logs
  const {
    data: activityData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => {
      if (!tenantId) {
        return Promise.resolve([]);
      }
      return fetchActivityLogs(tenantId, filters);
    },
    enabled: enabled && isReady && !!tenantId,
    refetchInterval,
    staleTime: 30000, // 30 seconds
  });

  // Memoized log activity function with context auto-fill
  const logActivity = useCallback(
    async (
      action: ActivityActionType | string,
      entityType: string,
      entityId?: string | null,
      metadata: ActivityMetadata = {}
    ): Promise<void> => {
      if (!tenantId || !userId) {
        logger.warn('[useActivityLog] Cannot log activity - missing tenant or user context', {
          hasTenantId: !!tenantId,
          hasUserId: !!userId,
        });
        return;
      }

      logger.debug('[useActivityLog] Logging activity', {
        action,
        entityType,
        entityId,
      });

      await logActivityUtil(tenantId, userId, action, entityType, entityId, metadata);

      // Invalidate activity queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.activity.byTenant(tenantId),
      });
    },
    [tenantId, userId, queryClient]
  );

  // Invalidate all activity cache for this tenant
  const invalidateActivity = useCallback(async (): Promise<void> => {
    if (!tenantId) return;

    logger.debug('[useActivityLog] Invalidating activity cache', { tenantId });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.activity.byTenant(tenantId),
    });
  }, [tenantId, queryClient]);

  return {
    logActivity,
    recentActivity: activityData ?? [],
    isLoading,
    isFetching,
    error: error as Error | null,
    refetch,
    invalidateActivity,
    isReady,
  };
}

// Re-export constants for convenience
export { ActivityAction, EntityType };

export default useActivityLog;

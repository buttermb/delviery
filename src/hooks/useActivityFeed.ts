/**
 * useActivityFeed Hook
 * Provides filtered, paginated access to the unified activity feed.
 * Supports filtering by category, severity, date range, and search term.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { useState, useCallback, useMemo } from 'react';

export type ActivityCategory = 'order' | 'inventory' | 'user' | 'system' | 'payment' | 'settings' | 'crm' | 'delivery';
export type ActivitySeverity = 'info' | 'warning' | 'error' | 'success';

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  tenant_id: string;
  action: string;
  category: string;
  severity: string;
  resource: string | null;
  resource_id: string | null;
  description: string | null;
  user_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityFeedFilters {
  category?: ActivityCategory | 'all';
  severity?: ActivitySeverity | 'all';
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

interface LogActivityParams {
  action: string;
  category?: ActivityCategory;
  severity?: ActivitySeverity;
  resource?: string;
  resourceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export function useActivityFeed(initialFilters?: Partial<ActivityFeedFilters>) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<ActivityFeedFilters>({
    category: 'all',
    severity: 'all',
    searchTerm: '',
    limit: 50,
    offset: 0,
    ...initialFilters,
  });

  const queryKeyForFilters = useMemo(
    () => queryKeys.activityFeed.list({
      tenantId,
      ...filters,
    }),
    [tenantId, filters]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeyForFilters,
    queryFn: async (): Promise<{ entries: ActivityLogEntry[]; totalCount: number }> => {
      if (!tenantId) return { entries: [], totalCount: 0 };

      try {
        let query = supabase
          .from('activity_logs' as unknown as string)
          .select('*', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        // Apply category filter
        if (filters.category && filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }

        // Apply severity filter
        if (filters.severity && filters.severity !== 'all') {
          query = query.eq('severity', filters.severity);
        }

        // Apply search filter (search in action and description)
        if (filters.searchTerm) {
          query = query.or(
            `action.ilike.%${filters.searchTerm}%,description.ilike.%${filters.searchTerm}%,user_email.ilike.%${filters.searchTerm}%`
          );
        }

        // Apply date range filter
        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }

        // Apply user filter
        if (filters.userId) {
          query = query.eq('user_id', filters.userId);
        }

        // Apply pagination
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;
        query = query.range(offset, offset + limit - 1);

        const { data: entries, error: queryError, count } = await query;

        if (queryError) {
          // Table might not exist yet
          if (queryError.code === '42P01') {
            return { entries: [], totalCount: 0 };
          }
          throw queryError;
        }

        return {
          entries: (entries || []) as unknown as ActivityLogEntry[],
          totalCount: count ?? 0,
        };
      } catch (err) {
        if ((err as { code?: string })?.code === '42P01') {
          return { entries: [], totalCount: 0 };
        }
        logger.error('Failed to fetch activity feed', err as Error, {
          component: 'useActivityFeed',
          tenantId,
        });
        throw err;
      }
    },
    enabled: !!tenantId,
  });

  const logActivity = useMutation({
    mutationFn: async (params: LogActivityParams) => {
      if (!tenantId) throw new Error('No tenant context');

      const { data: result, error: rpcError } = await supabase.rpc(
        'log_unified_activity' as unknown as string,
        {
          p_tenant_id: tenantId,
          p_action: params.action,
          p_category: params.category ?? 'system',
          p_severity: params.severity ?? 'info',
          p_resource: params.resource ?? null,
          p_resource_id: params.resourceId ?? null,
          p_description: params.description ?? null,
          p_metadata: params.metadata ?? {},
        } as Record<string, unknown>
      );

      if (rpcError) throw rpcError;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.activityFeed.all,
      });
    },
    onError: (err) => {
      logger.error('Failed to log activity', err as Error, {
        component: 'useActivityFeed',
      });
    },
  });

  const updateFilters = useCallback((newFilters: Partial<ActivityFeedFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      // Reset offset when filters change (except when explicitly setting offset)
      offset: 'offset' in newFilters ? newFilters.offset : 0,
    }));
  }, []);

  const nextPage = useCallback(() => {
    const limit = filters.limit ?? 50;
    setFilters((prev) => ({
      ...prev,
      offset: (prev.offset ?? 0) + limit,
    }));
  }, [filters.limit]);

  const prevPage = useCallback(() => {
    const limit = filters.limit ?? 50;
    setFilters((prev) => ({
      ...prev,
      offset: Math.max(0, (prev.offset ?? 0) - limit),
    }));
  }, [filters.limit]);

  const currentPage = useMemo(() => {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    return Math.floor(offset / limit) + 1;
  }, [filters.limit, filters.offset]);

  const totalPages = useMemo(() => {
    const limit = filters.limit ?? 50;
    return Math.ceil((data?.totalCount ?? 0) / limit);
  }, [data?.totalCount, filters.limit]);

  return {
    entries: data?.entries ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
    error,
    filters,
    updateFilters,
    refetch,
    logActivity,
    // Pagination
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

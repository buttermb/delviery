/**
 * useAuditTrail Hook
 * Provides filtered, paginated access to the audit trail.
 * Supports filtering by action, resource type, date range, and search.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { AuditTrailEntry, AuditTrailFilters } from '@/types/auditTrail';

const PAGE_SIZE = 50;

export function useAuditTrail(initialFilters?: Partial<AuditTrailFilters>) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const [filters, setFilters] = useState<AuditTrailFilters>({
    action: 'all',
    resourceType: 'all',
    searchTerm: '',
    limit: PAGE_SIZE,
    offset: 0,
    ...initialFilters,
  });

  const queryKeyForFilters = useMemo(
    () => queryKeys.auditTrail.list(tenantId, { ...filters }),
    [tenantId, filters]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeyForFilters,
    queryFn: async (): Promise<{ entries: AuditTrailEntry[]; totalCount: number }> => {
      if (!tenantId) return { entries: [], totalCount: 0 };

      try {
        // audit_trail is not in generated Supabase types, cast through unknown
        let query = (supabase as unknown as Record<string, (...args: unknown[]) => unknown>)
          .from('audit_trail') as ReturnType<typeof supabase.from>;

        query = query
          .select('*', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (filters.action && filters.action !== 'all') {
          query = query.eq('action', filters.action);
        }

        if (filters.resourceType && filters.resourceType !== 'all') {
          query = query.eq('resource_type', filters.resourceType);
        }

        if (filters.searchTerm) {
          query = query.or(
            `action.ilike.%${filters.searchTerm}%,resource_type.ilike.%${filters.searchTerm}%,actor_type.ilike.%${filters.searchTerm}%`
          );
        }

        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }

        const limit = filters.limit ?? PAGE_SIZE;
        const offset = filters.offset ?? 0;
        query = query.range(offset, offset + limit - 1);

        const { data: entries, error: queryError, count } = await query;

        if (queryError) {
          if (queryError.code === '42P01') {
            return { entries: [], totalCount: 0 };
          }
          throw queryError;
        }

        return {
          entries: (entries || []) as unknown as AuditTrailEntry[],
          totalCount: count ?? 0,
        };
      } catch (err) {
        if ((err as { code?: string })?.code === '42P01') {
          return { entries: [], totalCount: 0 };
        }
        logger.error('Failed to fetch audit trail', err as Error, {
          component: 'useAuditTrail',
          tenantId,
        });
        throw err;
      }
    },
    enabled: !!tenantId,
  });

  const updateFilters = useCallback((newFilters: Partial<AuditTrailFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      offset: 'offset' in newFilters ? newFilters.offset : 0,
    }));
  }, []);

  const nextPage = useCallback(() => {
    const limit = filters.limit ?? PAGE_SIZE;
    setFilters((prev) => ({
      ...prev,
      offset: (prev.offset ?? 0) + limit,
    }));
  }, [filters.limit]);

  const prevPage = useCallback(() => {
    const limit = filters.limit ?? PAGE_SIZE;
    setFilters((prev) => ({
      ...prev,
      offset: Math.max(0, (prev.offset ?? 0) - limit),
    }));
  }, [filters.limit]);

  const currentPage = useMemo(() => {
    const limit = filters.limit ?? PAGE_SIZE;
    const offset = filters.offset ?? 0;
    return Math.floor(offset / limit) + 1;
  }, [filters.limit, filters.offset]);

  const totalPages = useMemo(() => {
    const limit = filters.limit ?? PAGE_SIZE;
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
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

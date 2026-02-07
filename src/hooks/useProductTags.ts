/**
 * Product Tags Hook
 *
 * Provides tag management for product filtering and search:
 * - Fetch available tags for the tenant
 * - Create new tags
 * - Search/filter tags by name
 *
 * Note: Reuses the existing `tags` table which is tenant-scoped.
 * This hook provides product-specific functionality for tag selection
 * in product filters and search interfaces.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// Types
export interface ProductTag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductTagInput {
  name: string;
  color?: string;
  description?: string;
}

/**
 * Hook to fetch all tags for the current tenant (for product filtering)
 */
export function useProductTags() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.tags.list({ tenantId: tenant?.id, context: 'products' }),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              order: (column: string, options: { ascending: boolean }) => Promise<{ data: ProductTag[] | null; error: Error | null }>;
            };
          };
        };
      })
        .from('tags')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name', { ascending: true });

      if (error) {
        logger.error('Failed to fetch product tags', { error });
        throw error;
      }

      return (data || []) as ProductTag[];
    },
    enabled: !!tenant?.id,
    staleTime: 30000,
  });
}

/**
 * Hook to search tags by name
 */
export function useSearchProductTags(searchTerm: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.tags.list({ tenantId: tenant?.id, context: 'products', search: searchTerm }),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              ilike: (column: string, value: string) => {
                order: (column: string, options: { ascending: boolean }) => {
                  limit: (count: number) => Promise<{ data: ProductTag[] | null; error: Error | null }>;
                };
              };
            };
          };
        };
      })
        .from('tags')
        .select('*')
        .eq('tenant_id', tenant.id)
        .ilike('name', `%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error) {
        logger.error('Failed to search product tags', { error, searchTerm });
        throw error;
      }

      return (data || []) as ProductTag[];
    },
    enabled: !!tenant?.id && searchTerm.length >= 1,
    staleTime: 10000,
  });
}

/**
 * Hook to create a new tag (for use in product tag input)
 */
export function useCreateProductTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductTagInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          insert: (row: Record<string, unknown>) => {
            select: () => {
              maybeSingle: () => Promise<{ data: ProductTag | null; error: Error | null }>;
            };
          };
        };
      })
        .from('tags')
        .insert({
          tenant_id: tenant.id,
          name: input.name.trim(),
          color: input.color || '#6B7280',
          description: input.description || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create product tag', { error, input });
        throw error;
      }

      return data as ProductTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

/**
 * Hook to get tags by their IDs
 */
export function useProductTagsByIds(tagIds: string[]) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.tags.list({ tenantId: tenant?.id, ids: tagIds }),
    queryFn: async () => {
      if (!tenant?.id || tagIds.length === 0) return [];

      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              in: (column: string, values: string[]) => Promise<{ data: ProductTag[] | null; error: Error | null }>;
            };
          };
        };
      })
        .from('tags')
        .select('*')
        .eq('tenant_id', tenant.id)
        .in('id', tagIds);

      if (error) {
        logger.error('Failed to fetch tags by ids', { error, tagIds });
        throw error;
      }

      return (data || []) as ProductTag[];
    },
    enabled: !!tenant?.id && tagIds.length > 0,
    staleTime: 30000,
  });
}

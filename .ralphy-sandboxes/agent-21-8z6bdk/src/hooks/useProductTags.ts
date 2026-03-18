/**
 * Product Tags Hook
 *
 * Provides comprehensive tag management for products including:
 * - CRUD operations for product tags
 * - Assigning/removing tags from products
 * - Fetching tags for a specific product
 * - Popular tags for filter bar
 * - Search/autocomplete functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// Types
export interface ProductTag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ProductTagAssignment {
  id: string;
  product_id: string;
  tag_id: string;
  tag?: ProductTag;
}

export interface CreateProductTagInput {
  name: string;
  color?: string;
}

export interface UpdateProductTagInput {
  id: string;
  name?: string;
  color?: string;
}

export interface PopularTag extends ProductTag {
  usage_count: number;
}

// Default tag colors
export const TAG_COLORS = [
  { name: 'Gray', value: '#6B7280' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Lime', value: '#84CC16' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Fuchsia', value: '#D946EF' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Rose', value: '#F43F5E' },
];

/**
 * Hook to fetch all product tags for the current tenant
 */
export function useProductTags() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.productTags.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('product_tags')
        .select('id, tenant_id, name, color, created_at')
        .eq('tenant_id', tenant.id)
        .order('name', { ascending: true });

      // Handle table not existing gracefully
      if (error && (error as { code?: string }).code === '42P01') {
        logger.warn('product_tags table does not exist yet', { error });
        return [];
      }

      if (error) {
        logger.error('Failed to fetch product tags', error, { tenantId: tenant.id });
        throw error;
      }

      return (data ?? []) as ProductTag[];
    },
    enabled: !!tenant?.id,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch popular tags (most used) for filter bar
 */
export function usePopularProductTags(limit = 10) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.productTags.popular(tenant?.id, limit),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      // First get all tags
      const { data: tags, error: tagsError } = await supabase
        .from('product_tags')
        .select('id, tenant_id, name, color, created_at')
        .eq('tenant_id', tenant.id);

      if (tagsError && (tagsError as { code?: string }).code === '42P01') {
        return [];
      }

      if (tagsError) {
        logger.error('Failed to fetch product tags for popularity', tagsError, { tenantId: tenant.id });
        throw tagsError;
      }

      if (!tags || tags.length === 0) return [];

      // Get assignment counts for each tag
      const tagIds = tags.map(t => t.id);
      const { data: assignments, error: assignError } = await supabase
        .from('product_tag_assignments')
        .select('tag_id')
        .in('tag_id', tagIds);

      if (assignError && (assignError as { code?: string }).code !== '42P01') {
        logger.warn('Failed to fetch tag assignments', assignError);
      }

      // Count assignments per tag
      const countMap = new Map<string, number>();
      (assignments ?? []).forEach((a) => {
        countMap.set(a.tag_id, (countMap.get(a.tag_id) ?? 0) + 1);
      });

      // Add usage count and sort
      const tagsWithCount: PopularTag[] = tags.map(tag => ({
        ...tag,
        usage_count: countMap.get(tag.id) ?? 0,
      }));

      return tagsWithCount
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, limit);
    },
    enabled: !!tenant?.id,
    staleTime: 60000,
  });
}

/**
 * Hook to fetch tags for a specific product
 */
export function useProductTagAssignments(productId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.productTags.byProduct(productId ?? ''),
    queryFn: async () => {
      if (!tenant?.id || !productId) throw new Error('No tenant or product');

      // First get assignments
      const { data: assignments, error: assignError } = await supabase
        .from('product_tag_assignments')
        .select('id, product_id, tag_id')
        .eq('product_id', productId);

      if (assignError && (assignError as { code?: string }).code === '42P01') {
        return [];
      }

      if (assignError) {
        logger.error('Failed to fetch product tag assignments', assignError, { productId });
        throw assignError;
      }

      if (!assignments || assignments.length === 0) return [];

      // Then get the tags for these assignments
      const tagIds = assignments.map(a => a.tag_id);
      const { data: tags, error: tagsError } = await supabase
        .from('product_tags')
        .select('id, tenant_id, name, color, created_at')
        .in('id', tagIds)
        .eq('tenant_id', tenant.id);

      if (tagsError) {
        logger.error('Failed to fetch tags for assignments', tagsError, { tagIds });
        throw tagsError;
      }

      // Combine assignments with their tags
      const tagMap = new Map((tags ?? []).map(t => [t.id, t]));
      return assignments.map(a => ({
        ...a,
        tag: tagMap.get(a.tag_id),
      })) as ProductTagAssignment[];
    },
    enabled: !!tenant?.id && !!productId,
    staleTime: 30000,
  });
}

/**
 * Hook to create a new product tag
 */
export function useCreateProductTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductTagInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('product_tags')
        .insert({
          tenant_id: tenant.id,
          name: input.name.trim(),
          color: input.color || '#6B7280',
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create product tag', error, { input });
        throw error;
      }

      return data as ProductTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productTags.all });
      toast.success('Tag created successfully');
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to create tag'));
    },
  });
}

/**
 * Hook to update an existing product tag
 */
export function useUpdateProductTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProductTagInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.color !== undefined) updateData.color = input.color;

      const { data, error } = await supabase
        .from('product_tags')
        .update(updateData)
        .eq('id', input.id)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update product tag', error, { input });
        throw error;
      }

      return data as ProductTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productTags.all });
      toast.success('Tag updated successfully');
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to update tag'));
    },
  });
}

/**
 * Hook to delete a product tag (cascades to assignments)
 */
export function useDeleteProductTag() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('product_tags')
        .delete()
        .eq('id', tagId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to delete product tag', error, { tagId });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productTags.all });
      toast.success('Tag deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to delete tag'));
    },
  });
}

/**
 * Hook to assign a tag to a product
 */
export function useAssignProductTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, tagId }: { productId: string; tagId: string }) => {
      const { data, error } = await supabase
        .from('product_tag_assignments')
        .insert({
          product_id: productId,
          tag_id: tagId,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to assign product tag', error, { productId, tagId });
        throw error;
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.productTags.byProduct(variables.productId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.productTags.popular() });
      toast.success('Tag assigned');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        toast.error('Tag is already assigned to this product');
      } else {
        toast.error(humanizeError(error, 'Failed to assign tag'));
      }
    },
  });
}

/**
 * Hook to remove a tag from a product
 */
export function useRemoveProductTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, tagId }: { productId: string; tagId: string }) => {
      const { error } = await supabase
        .from('product_tag_assignments')
        .delete()
        .eq('product_id', productId)
        .eq('tag_id', tagId);

      if (error) {
        logger.error('Failed to remove product tag', error, { productId, tagId });
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.productTags.byProduct(variables.productId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.productTags.popular() });
      toast.success('Tag removed');
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to remove tag'));
    },
  });
}

/**
 * Hook to batch assign tags to multiple products
 */
export function useBatchAssignProductTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productIds,
      tagIds,
    }: {
      productIds: string[];
      tagIds: string[];
    }) => {
      const insertData = productIds.flatMap((productId) =>
        tagIds.map((tagId) => ({
          product_id: productId,
          tag_id: tagId,
        }))
      );

      const { error } = await supabase
        .from('product_tag_assignments')
        .upsert(insertData, { onConflict: 'product_id,tag_id', ignoreDuplicates: true });

      if (error) {
        logger.error('Failed to batch assign product tags', error, { productIds, tagIds });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.productTags.all });
      toast.success('Tags assigned to products');
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to assign tags'));
    },
  });
}

/**
 * Hook to search tags by name (for autocomplete)
 */
export function useSearchProductTags(searchTerm: string) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.productTags.list(tenant?.id), 'search', searchTerm],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('product_tags')
        .select('id, tenant_id, name, color, created_at')
        .eq('tenant_id', tenant.id)
        .ilike('name', `%${escapePostgresLike(searchTerm)}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error && (error as { code?: string }).code === '42P01') {
        return [];
      }

      if (error) {
        logger.error('Failed to search product tags', error, { searchTerm });
        throw error;
      }

      return (data ?? []) as ProductTag[];
    },
    enabled: !!tenant?.id && searchTerm.length > 0,
    staleTime: 10000,
  });
}

/**
 * Hook to get tags by their IDs
 */
export function useProductTagsByIds(tagIds: string[]) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.productTags.list(tenant?.id), 'by-ids', tagIds],
    queryFn: async () => {
      if (!tenant?.id || tagIds.length === 0) return [];

      const { data, error } = await supabase
        .from('product_tags')
        .select('id, tenant_id, name, color, created_at')
        .eq('tenant_id', tenant.id)
        .in('id', tagIds);

      if (error && (error as { code?: string }).code === '42P01') {
        return [];
      }

      if (error) {
        logger.error('Failed to fetch tags by ids', error, { tagIds });
        throw error;
      }

      return (data ?? []) as ProductTag[];
    },
    enabled: !!tenant?.id && tagIds.length > 0,
    staleTime: 30000,
  });
}

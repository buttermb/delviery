/**
 * useProductVariants Hook
 *
 * Provides CRUD operations for product variants (size, weight, strain options).
 * Follows FloraIQ patterns with tenant isolation and TanStack Query.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

export type VariantType = 'size' | 'weight' | 'strain';

export interface ProductVariant {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  variant_type: VariantType;
  sku: string | null;
  price: number | null;
  cost_per_unit: number | null;
  wholesale_price: number | null;
  retail_price: number | null;
  available_quantity: number;
  low_stock_alert: number;
  display_order: number;
  is_active: boolean;
  thc_percent: number | null;
  cbd_percent: number | null;
  strain_type: 'indica' | 'sativa' | 'hybrid' | 'cbd' | null;
  weight_grams: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVariantInput {
  product_id: string;
  name: string;
  variant_type: VariantType;
  sku?: string;
  price?: number;
  cost_per_unit?: number;
  wholesale_price?: number;
  retail_price?: number;
  available_quantity?: number;
  low_stock_alert?: number;
  display_order?: number;
  is_active?: boolean;
  thc_percent?: number;
  cbd_percent?: number;
  strain_type?: 'indica' | 'sativa' | 'hybrid' | 'cbd';
  weight_grams?: number;
}

export interface UpdateVariantInput extends Partial<Omit<CreateVariantInput, 'product_id'>> {
  id: string;
}

// Extend queryKeys for product variants
const variantKeys = {
  all: ['product-variants'] as const,
  lists: () => [...variantKeys.all, 'list'] as const,
  list: (productId?: string) => [...variantKeys.lists(), { productId }] as const,
  details: () => [...variantKeys.all, 'detail'] as const,
  detail: (id: string) => [...variantKeys.details(), id] as const,
};

/**
 * Hook to fetch all variants for a product
 */
export function useProductVariants(productId: string | undefined) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: variantKeys.list(productId),
    queryFn: async () => {
      if (!tenant?.id || !productId) return [];

      const { data, error } = await supabase
        .from('product_variants')
        .select('id, tenant_id, product_id, name, variant_type, sku, price, cost_per_unit, wholesale_price, retail_price, available_quantity, low_stock_alert, display_order, is_active, thc_percent, cbd_percent, strain_type, weight_grams, created_at, updated_at')
        .eq('tenant_id', tenant.id)
        .eq('product_id', productId)
        .order('display_order', { ascending: true });

      if (error) {
        logger.error('Failed to fetch product variants', { error, productId });
        throw error;
      }

      return data as ProductVariant[];
    },
    enabled: !!tenant?.id && !!productId,
  });
}

/**
 * Hook to create a new variant
 */
export function useCreateVariant() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVariantInput) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from('product_variants')
        .insert({
          ...input,
          tenant_id: tenant.id,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to create variant', { error, input });
        throw error;
      }

      return data as ProductVariant;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.list(data.product_id) });
      toast.success('Variant created');
    },
    onError: (error) => {
      logger.error('Variant creation failed', { error });
      toast.error('Failed to create variant', { description: humanizeError(error) });
    },
  });
}

/**
 * Hook to update an existing variant
 */
export function useUpdateVariant() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateVariantInput) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { id, ...updateData } = input;

      const { data, error } = await supabase
        .from('product_variants')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to update variant', { error, input });
        throw error;
      }

      return data as ProductVariant;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.list(data.product_id) });
      queryClient.invalidateQueries({ queryKey: variantKeys.detail(data.id) });
      toast.success('Variant updated');
    },
    onError: (error) => {
      logger.error('Variant update failed', { error });
      toast.error('Failed to update variant', { description: humanizeError(error) });
    },
  });
}

/**
 * Hook to delete a variant
 */
export function useDeleteVariant() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to delete variant', { error, id });
        throw error;
      }

      return { id, productId };
    },
    onSuccess: ({ productId }) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.list(productId) });
      toast.success('Variant deleted');
    },
    onError: (error) => {
      logger.error('Variant deletion failed', { error });
      toast.error('Failed to delete variant', { description: humanizeError(error) });
    },
  });
}

/**
 * Hook to reorder variants
 */
export function useReorderVariants() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      orderedIds,
    }: {
      productId: string;
      orderedIds: string[];
    }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      // Update each variant's display_order
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('product_variants')
          .update({ display_order: index })
          .eq('id', id)
          .eq('tenant_id', tenant.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        logger.error('Failed to reorder some variants', { errors });
        throw new Error('Failed to reorder variants');
      }

      return { productId };
    },
    onSuccess: ({ productId }) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.list(productId) });
    },
    onError: (error) => {
      logger.error('Variant reordering failed', { error });
      toast.error('Failed to reorder variants', { description: humanizeError(error) });
    },
  });
}

/**
 * Hook to bulk create variants (e.g., preset weight options)
 */
export function useBulkCreateVariants() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      variants,
    }: {
      productId: string;
      variants: Omit<CreateVariantInput, 'product_id'>[];
    }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const variantsWithTenant = variants.map((v, index) => ({
        ...v,
        product_id: productId,
        tenant_id: tenant.id,
        display_order: index,
      }));

      const { data, error } = await supabase
        .from('product_variants')
        .insert(variantsWithTenant)
        .select();

      if (error) {
        logger.error('Failed to bulk create variants', { error });
        throw error;
      }

      return { productId, variants: data as ProductVariant[] };
    },
    onSuccess: ({ productId }) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.list(productId) });
      toast.success('Variants created');
    },
    onError: (error) => {
      logger.error('Bulk variant creation failed', { error });
      toast.error('Failed to create variants', { description: humanizeError(error) });
    },
  });
}

// Preset weight options for cannabis products
export const PRESET_WEIGHTS = [
  { name: '1g', weight_grams: 1, display_order: 0 },
  { name: '1/8 oz (3.5g)', weight_grams: 3.5, display_order: 1 },
  { name: '1/4 oz (7g)', weight_grams: 7, display_order: 2 },
  { name: '1/2 oz (14g)', weight_grams: 14, display_order: 3 },
  { name: '1 oz (28g)', weight_grams: 28, display_order: 4 },
] as const;

// Preset size options
export const PRESET_SIZES = [
  { name: 'Small', display_order: 0 },
  { name: 'Medium', display_order: 1 },
  { name: 'Large', display_order: 2 },
] as const;

export { variantKeys };

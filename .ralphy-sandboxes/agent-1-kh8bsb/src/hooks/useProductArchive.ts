/**
 * useProductArchive Hook
 * Provides archive and unarchive functionality for products with data preservation.
 * Archived products are hidden from active lists and menus but retain order history.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface ArchiveProductResult {
  success: boolean;
  productId: string;
  archived: boolean;
}

interface UseProductArchiveOptions {
  /** Callback after successful archive */
  onArchiveSuccess?: (productId: string) => void;
  /** Callback after successful unarchive */
  onUnarchiveSuccess?: (productId: string) => void;
}

/**
 * Hook for archiving and unarchiving products
 * Handles menu sync and activity logging automatically
 */
export function useProductArchive(options: UseProductArchiveOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();

  /**
   * Archive a product - hides from active lists, removes from menus
   */
  const archiveMutation = useMutation({
    mutationFn: async (productId: string): Promise<ArchiveProductResult> => {
      if (!tenant?.id) {
        throw new Error('Tenant context required');
      }

      logger.info('[useProductArchive] Archiving product', { productId, tenantId: tenant.id });

      // Get product name for activity log before archiving
      const { data: product } = await supabase
        .from('products')
        .select('name')
        .eq('id', productId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      // Use the RPC function for atomic archive operation
      const { data, error } = await (supabase as any).rpc('archive_product', {
        p_product_id: productId,
        p_tenant_id: tenant.id,
      });

      if (error) {
        logger.error('[useProductArchive] Archive failed', { error, productId });
        throw error;
      }

      if (!data) {
        throw new Error('Product not found or already archived');
      }

      // Log activity
      await logActivity(
        'archived',
        'product',
        productId,
        {
          productName: product?.name,
          action: 'archive',
        }
      );

      logger.info('[useProductArchive] Product archived successfully', { productId });

      return {
        success: true,
        productId,
        archived: true,
      };
    },
    onSuccess: (result) => {
      // Invalidate product queries to refresh lists
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });

      toast.success('Product archived', {
        description: 'Product has been hidden from active lists and menus',
      });

      options.onArchiveSuccess?.(result.productId);
    },
    onError: (error) => {
      logger.error('[useProductArchive] Archive mutation error', { error });
      toast.error('Failed to archive product', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  /**
   * Unarchive a product - restores to active lists (menu visibility stays off)
   */
  const unarchiveMutation = useMutation({
    mutationFn: async (productId: string): Promise<ArchiveProductResult> => {
      if (!tenant?.id) {
        throw new Error('Tenant context required');
      }

      logger.info('[useProductArchive] Unarchiving product', { productId, tenantId: tenant.id });

      // Get product name for activity log before unarchiving
      const { data: product } = await supabase
        .from('products')
        .select('name')
        .eq('id', productId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      // Use the RPC function for atomic unarchive operation
      const { data, error } = await (supabase as any).rpc('unarchive_product', {
        p_product_id: productId,
        p_tenant_id: tenant.id,
      });

      if (error) {
        logger.error('[useProductArchive] Unarchive failed', { error, productId });
        throw error;
      }

      if (!data) {
        throw new Error('Product not found or not archived');
      }

      // Log activity
      await logActivity(
        'unarchived',
        'product',
        productId,
        {
          productName: product?.name,
          action: 'unarchive',
        }
      );

      logger.info('[useProductArchive] Product unarchived successfully', { productId });

      return {
        success: true,
        productId,
        archived: false,
      };
    },
    onSuccess: (result) => {
      // Invalidate product queries to refresh lists
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      toast.success('Product restored', {
        description: 'Product is now visible in active lists',
      });

      options.onUnarchiveSuccess?.(result.productId);
    },
    onError: (error) => {
      logger.error('[useProductArchive] Unarchive mutation error', { error });
      toast.error('Failed to restore product', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  return {
    /** Archive a product */
    archiveProduct: archiveMutation.mutate,
    /** Unarchive a product */
    unarchiveProduct: unarchiveMutation.mutate,
    /** Async archive */
    archiveProductAsync: archiveMutation.mutateAsync,
    /** Async unarchive */
    unarchiveProductAsync: unarchiveMutation.mutateAsync,
    /** Loading state for archive operation */
    isArchiving: archiveMutation.isPending,
    /** Loading state for unarchive operation */
    isUnarchiving: unarchiveMutation.isPending,
    /** Combined loading state */
    isLoading: archiveMutation.isPending || unarchiveMutation.isPending,
  };
}

export default useProductArchive;

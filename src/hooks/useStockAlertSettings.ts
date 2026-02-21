/**
 * Hook for managing stock alert threshold settings
 * Provides CRUD operations for per-product threshold configuration
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface ThresholdConfig {
  productId: string;
  threshold: number;
}

export function useStockAlertSettings() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Mutation to update a single product's threshold
  const updateThresholdMutation = useMutation({
    mutationFn: async ({ productId, threshold }: { productId: string; threshold: number }) => {
      if (!tenant?.id) throw new Error('No tenant context');

      // Validate threshold
      if (threshold < 1) throw new Error('Threshold must be at least 1');
      if (threshold > 10000) throw new Error('Threshold cannot exceed 10,000');

      const { error } = await supabase
        .from('products')
        .update({
          low_stock_alert: threshold,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      return { productId, threshold };
    },
    onSuccess: (data) => {
      toast.success('Threshold updated successfully');

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });

      logger.info('Stock alert threshold updated', {
        productId: data.productId,
        threshold: data.threshold
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to update threshold', {
        description: humanizeError(error),
      });
      logger.error('Failed to update stock alert threshold', { error: error.message });
    },
  });

  // Mutation to update multiple products' thresholds in bulk
  const updateBulkThresholdsMutation = useMutation({
    mutationFn: async (configs: ThresholdConfig[]) => {
      if (!tenant?.id) throw new Error('No tenant context');
      if (configs.length === 0) throw new Error('No products to update');

      // Validate all thresholds
      for (const config of configs) {
        if (config.threshold < 1) throw new Error('Threshold must be at least 1');
        if (config.threshold > 10000) throw new Error('Threshold cannot exceed 10,000');
      }

      // Update all products in parallel
      const updatePromises = configs.map(({ productId, threshold }) =>
        supabase
          .from('products')
          .update({
            low_stock_alert: threshold,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId)
          .eq('tenant_id', tenant.id)
      );

      const results = await Promise.all(updatePromises);

      // Check for errors
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} product(s)`);
      }

      return { updatedCount: configs.length };
    },
    onSuccess: (data) => {
      toast.success(`Updated thresholds for ${data.updatedCount} product(s)`);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });

      logger.info('Bulk stock alert thresholds updated', {
        updatedCount: data.updatedCount
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to update thresholds', {
        description: humanizeError(error),
      });
      logger.error('Failed to bulk update stock alert thresholds', { error: error.message });
    },
  });

  return {
    updateThreshold: (productId: string, threshold: number) =>
      updateThresholdMutation.mutateAsync({ productId, threshold }),
    updateBulkThresholds: (configs: ThresholdConfig[]) =>
      updateBulkThresholdsMutation.mutateAsync(configs),
    isSaving: updateThresholdMutation.isPending || updateBulkThresholdsMutation.isPending,
  };
}

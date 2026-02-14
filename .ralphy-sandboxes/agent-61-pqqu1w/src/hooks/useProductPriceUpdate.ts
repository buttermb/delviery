/**
 * useProductPriceUpdate Hook
 *
 * Provides a mutation for updating product prices with menu sync confirmation.
 * Detects price changes, shows affected menus, and handles the update flow.
 *
 * Task 099: Create product price update with menu sync
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/eventBus';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logActivityAuto } from '@/lib/activityLogger';
import type { PriceUpdateData } from '@/components/admin/products/ProductPriceUpdateDialog';

interface ProductPriceFields {
  wholesale_price?: number | null;
  retail_price?: number | null;
  cost_per_unit?: number | null;
}

interface UpdateProductPriceParams {
  productId: string;
  currentPrices: ProductPriceFields;
  newPrices: ProductPriceFields;
  changeReason?: string;
  skipConfirmation?: boolean;
}

interface UseProductPriceUpdateReturn {
  updatePrice: (params: UpdateProductPriceParams) => Promise<void>;
  isPending: boolean;
  pendingUpdate: PriceUpdateData | null;
  confirmUpdate: () => Promise<void>;
  cancelUpdate: () => void;
  showConfirmDialog: boolean;
  setShowConfirmDialog: (show: boolean) => void;
}

/**
 * Hook for managing product price updates with menu sync
 */
export function useProductPriceUpdate(): UseProductPriceUpdateReturn {
  const { tenant, user } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PriceUpdateData | null>(null);
  const [isPending, setIsPending] = useState(false);

  /**
   * Mutation for updating product prices in the database
   */
  const updatePriceMutation = useMutation({
    mutationFn: async ({
      productId,
      newPrices,
    }: {
      productId: string;
      newPrices: ProductPriceFields;
    }) => {
      if (!tenant?.id) {
        throw new Error('No tenant context');
      }

      const updateData: Record<string, unknown> = {};

      if (newPrices.wholesale_price !== undefined) {
        updateData.wholesale_price = newPrices.wholesale_price;
      }
      if (newPrices.retail_price !== undefined) {
        updateData.retail_price = newPrices.retail_price;
      }
      if (newPrices.cost_per_unit !== undefined) {
        updateData.cost_per_unit = newPrices.cost_per_unit;
      }

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .eq('tenant_id', tenant.id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update product price', error, {
          component: 'useProductPriceUpdate',
          productId,
        });
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all product queries to refresh product data
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
    },
    onError: (error) => {
      logger.error('Product price update mutation failed', error, {
        component: 'useProductPriceUpdate',
      });
    },
  });

  /**
   * Check if prices have changed
   */
  const hasPriceChanged = useCallback(
    (current: ProductPriceFields, updated: ProductPriceFields): boolean => {
      const wholesaleChanged =
        updated.wholesale_price !== undefined &&
        current.wholesale_price !== updated.wholesale_price;

      const retailChanged =
        updated.retail_price !== undefined &&
        current.retail_price !== updated.retail_price;

      const costChanged =
        updated.cost_per_unit !== undefined &&
        current.cost_per_unit !== updated.cost_per_unit;

      return wholesaleChanged || retailChanged || costChanged;
    },
    []
  );

  /**
   * Initiate a price update - shows confirmation dialog if prices changed
   */
  const updatePrice = useCallback(
    async (params: UpdateProductPriceParams) => {
      const { productId, currentPrices, newPrices, changeReason, skipConfirmation } = params;

      // Check if any price has actually changed
      if (!hasPriceChanged(currentPrices, newPrices)) {
        logger.debug('No price changes detected, skipping update', {
          component: 'useProductPriceUpdate',
          productId,
        });
        return;
      }

      // Build the price update data
      const priceUpdateData: PriceUpdateData = {
        productId,
        wholesalePriceOld: currentPrices.wholesale_price ?? null,
        wholesalePriceNew: newPrices.wholesale_price ?? currentPrices.wholesale_price ?? null,
        retailPriceOld: currentPrices.retail_price ?? null,
        retailPriceNew: newPrices.retail_price ?? currentPrices.retail_price ?? null,
        costPerUnitOld: currentPrices.cost_per_unit ?? null,
        costPerUnitNew: newPrices.cost_per_unit ?? currentPrices.cost_per_unit ?? null,
        changeReason,
      };

      // If skipping confirmation, update directly
      if (skipConfirmation) {
        setIsPending(true);
        try {
          await updatePriceMutation.mutateAsync({ productId, newPrices });

          // Publish price_changed event
          if (tenant?.id) {
            eventBus.publish('price_changed', {
              productId,
              tenantId: tenant.id,
              wholesalePriceOld: priceUpdateData.wholesalePriceOld,
              wholesalePriceNew: priceUpdateData.wholesalePriceNew,
              retailPriceOld: priceUpdateData.retailPriceOld,
              retailPriceNew: priceUpdateData.retailPriceNew,
              changedAt: new Date().toISOString(),
            });

            // Log activity
            await logActivityAuto(
              tenant.id,
              'update_product_price',
              'product',
              productId,
              {
                wholesale_old: priceUpdateData.wholesalePriceOld,
                wholesale_new: priceUpdateData.wholesalePriceNew,
                retail_old: priceUpdateData.retailPriceOld,
                retail_new: priceUpdateData.retailPriceNew,
                reason: changeReason,
              }
            );
          }

          showSuccessToast('Price updated successfully');
        } catch (error) {
          showErrorToast('Failed to update price');
          throw error;
        } finally {
          setIsPending(false);
        }
        return;
      }

      // Show confirmation dialog
      setPendingUpdate(priceUpdateData);
      setShowConfirmDialog(true);
    },
    [tenant, hasPriceChanged, updatePriceMutation]
  );

  /**
   * Confirm the pending update (called from dialog)
   */
  const confirmUpdate = useCallback(async () => {
    if (!pendingUpdate || !tenant?.id) return;

    setIsPending(true);
    try {
      // Update the product price
      await updatePriceMutation.mutateAsync({
        productId: pendingUpdate.productId,
        newPrices: {
          wholesale_price: pendingUpdate.wholesalePriceNew,
          retail_price: pendingUpdate.retailPriceNew,
          cost_per_unit: pendingUpdate.costPerUnitNew,
        },
      });

      logger.info('Product price confirmed and updated', {
        productId: pendingUpdate.productId,
        component: 'useProductPriceUpdate',
      });
    } catch (error) {
      logger.error('Failed to confirm price update', error as Error, {
        component: 'useProductPriceUpdate',
      });
      throw error;
    } finally {
      setIsPending(false);
      setPendingUpdate(null);
      setShowConfirmDialog(false);
    }
  }, [pendingUpdate, tenant, updatePriceMutation]);

  /**
   * Cancel the pending update
   */
  const cancelUpdate = useCallback(() => {
    setPendingUpdate(null);
    setShowConfirmDialog(false);
    logger.debug('Price update cancelled', { component: 'useProductPriceUpdate' });
  }, []);

  return {
    updatePrice,
    isPending: isPending || updatePriceMutation.isPending,
    pendingUpdate,
    confirmUpdate,
    cancelUpdate,
    showConfirmDialog,
    setShowConfirmDialog,
  };
}

export default useProductPriceUpdate;

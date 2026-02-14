/**
 * Real-time Inventory Check Hook
 * Validates stock availability before add-to-cart and during checkout
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface StockStatus {
  productId: string;
  productName: string;
  available: number;
  requested: number;
  isAvailable: boolean;
  isLowStock: boolean;
}

interface InventoryCheckResult {
  isValid: boolean;
  outOfStock: StockStatus[];
  lowStock: StockStatus[];
  allStatuses: StockStatus[];
}

export function useInventoryCheck() {
  const queryClient = useQueryClient();

  // Check single product stock
  const checkProductStock = useCallback(async (
    productId: string,
    requestedQuantity: number = 1
  ): Promise<StockStatus | null> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, available_quantity')
        .eq('id', productId)
        .single();

      if (error) {
        logger.warn('Failed to check stock for product', { productId, error });
        return null;
      }

      const available = data.available_quantity ?? data.stock_quantity ?? 0;
      
      return {
        productId: data.id,
        productName: data.name,
        available,
        requested: requestedQuantity,
        isAvailable: available >= requestedQuantity,
        isLowStock: available > 0 && available <= 5,
      };
    } catch (err) {
      logger.error('Error checking product stock', err);
      return null;
    }
  }, []);

  // Check multiple products stock (for cart/checkout)
  const checkCartStock = useCallback(async (
    items: Array<{ productId: string; quantity: number; name?: string }>
  ): Promise<InventoryCheckResult> => {
    if (items.length === 0) {
      return { isValid: true, outOfStock: [], lowStock: [], allStatuses: [] };
    }

    try {
      const productIds = items.map(item => item.productId);
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, available_quantity')
        .in('id', productIds);

      if (error) {
        logger.warn('Failed to check cart stock', error);
        // Don't block checkout on stock check failure
        return { isValid: true, outOfStock: [], lowStock: [], allStatuses: [] };
      }

      const statuses: StockStatus[] = items.map(item => {
        const product = data?.find(p => p.id === item.productId);
        const available = product?.available_quantity ?? product?.stock_quantity ?? 0;
        
        return {
          productId: item.productId,
          productName: product?.name || item.name || 'Unknown Product',
          available,
          requested: item.quantity,
          isAvailable: available >= item.quantity,
          isLowStock: available > 0 && available <= 5,
        };
      });

      const outOfStock = statuses.filter(s => !s.isAvailable);
      const lowStock = statuses.filter(s => s.isAvailable && s.isLowStock);

      return {
        isValid: outOfStock.length === 0,
        outOfStock,
        lowStock,
        allStatuses: statuses,
      };
    } catch (err) {
      logger.error('Error checking cart stock', err);
      return { isValid: true, outOfStock: [], lowStock: [], allStatuses: [] };
    }
  }, []);

  // Invalidate stock cache for a product
  const invalidateStock = useCallback((productId: string) => {
    queryClient.invalidateQueries({ queryKey: ['product-stock', productId] });
  }, [queryClient]);

  return {
    checkProductStock,
    checkCartStock,
    invalidateStock,
  };
}

// Hook for getting real-time stock for a specific product
export function useProductStock(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-stock', productId],
    queryFn: async () => {
      if (!productId) return null;
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, available_quantity')
        .eq('id', productId)
        .single();

      if (error) throw error;
      
      const available = data.available_quantity ?? data.stock_quantity ?? 0;
      
      return {
        productId: data.id,
        productName: data.name,
        available,
        isInStock: available > 0,
        isLowStock: available > 0 && available <= 5,
      };
    },
    enabled: !!productId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

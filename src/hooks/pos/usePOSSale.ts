/**
 * usePOSSale Hook
 *
 * Manages POS sale transactions including:
 * - Cart state management
 * - Payment processing
 * - Receipt generation
 * - Transaction history
 *
 * @returns {Object} Sale management utilities
 * @returns {Array} items - Current cart items
 * @returns {Function} addItem - Add item to cart
 * @returns {Function} removeItem - Remove item from cart
 * @returns {Function} updateQuantity - Update item quantity
 * @returns {Function} clearCart - Clear all cart items
 * @returns {Function} processSale - Process the sale transaction
 * @returns {number} total - Total cart value
 * @returns {boolean} isProcessing - Sale processing state
 *
 * @example
 * const { items, addItem, total, processSale } = usePOSSale();
 *
 * // Add item to cart
 * addItem({ id: '123', name: 'Product', price: 10.00, quantity: 2 });
 *
 * // Process sale
 * await processSale({ paymentMethod: 'cash', amountTendered: 50.00 });
 */

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ProcessSaleParams {
  paymentMethod: 'cash' | 'card' | 'digital';
  amountTendered?: number;
  customerId?: string;
}

export const usePOSSale = () => {
  const [items, setItems] = useState<CartItem[]>([]);
  const { tenantId } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, quantity } : i))
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const processSaleMutation = useMutation({
    mutationFn: async (params: ProcessSaleParams) => {
      if (!tenantId) throw new Error('No tenant context');
      if (items.length === 0) throw new Error('Cart is empty');

      const { data, error } = await supabase
        .from('orders')
        .insert({
          tenant_id: tenantId,
          customer_id: params.customerId,
          total_amount: total,
          payment_method: params.paymentMethod,
          payment_status: 'paid',
          status: 'completed',
          order_type: 'pos',
          items: items,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Sale completed successfully');
      clearCart();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
    },
    onError: (error) => {
      logger.error('Failed to process POS sale', { error });
      toast.error('Failed to process sale');
    },
  });

  const processSale = useCallback(
    (params: ProcessSaleParams) => processSaleMutation.mutateAsync(params),
    [processSaleMutation]
  );

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    processSale,
    total,
    isProcessing: processSaleMutation.isPending,
  };
};

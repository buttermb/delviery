/**
 * Menu Order Flow Hook
 *
 * Handles the complete flow when a customer places an order through a disposable menu.
 * Ensures orders appear immediately in admin panel via:
 * - Supabase realtime subscription (already set up in useRealtimeSync)
 * - EventBus notification for cross-module sync
 * - Proper inventory decrement through reserve_inventory RPC
 *
 * Order includes source=disposable_menu and menu_id reference for traceability.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { publish } from '@/lib/eventBus';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

/**
 * Order item structure for menu orders
 */
export interface MenuOrderItem {
  product_id: string;
  quantity: number;
  price: number;
  product_name?: string;
}

/**
 * Input data for placing a menu order
 */
export interface MenuOrderInput {
  menu_id: string;
  order_items: MenuOrderItem[];
  contact_phone: string;
  contact_email?: string;
  customer_name?: string;
  payment_method: 'cash' | 'card' | 'crypto' | 'other';
  delivery_address?: string;
  customer_notes?: string;
  total_amount: number;
}

/**
 * Result from a successful menu order
 */
export interface MenuOrderResult {
  success: boolean;
  order_id: string;
  status: string;
  trace_id: string;
}

/**
 * Options for the hook
 */
export interface UseMenuOrderFlowOptions {
  /** Callback when order is successfully placed */
  onSuccess?: (result: MenuOrderResult) => void;
  /** Callback when order fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for the hook
 */
export interface UseMenuOrderFlowResult {
  /** Submit a menu order */
  submitOrder: (input: MenuOrderInput) => Promise<MenuOrderResult>;
  /** Whether an order is currently being submitted */
  isSubmitting: boolean;
  /** Error from the last submission, if any */
  error: Error | null;
  /** Last successful order result */
  lastOrder: MenuOrderResult | null;
  /** Reset the error state */
  clearError: () => void;
}

/**
 * Hook for handling menu order flow with admin panel integration
 *
 * This hook ensures that when a customer places an order through a disposable menu:
 * 1. The order is created with proper source tracking (source_menu_id)
 * 2. Inventory is decremented atomically
 * 3. The admin panel is notified via eventBus
 * 4. Realtime sync ensures instant appearance in LiveOrders
 *
 * @example
 * ```tsx
 * const { submitOrder, isSubmitting, error } = useMenuOrderFlow({
 *   onSuccess: (result) => {
 *     toast.success(`Order ${result.order_id} placed!`);
 *     clearCart();
 *   },
 * });
 *
 * const handleCheckout = async () => {
 *   await submitOrder({
 *     menu_id: menuId,
 *     order_items: cartItems,
 *     contact_phone: phone,
 *     payment_method: 'cash',
 *     total_amount: cartTotal,
 *   });
 * };
 * ```
 */
export function useMenuOrderFlow(
  options: UseMenuOrderFlowOptions = {}
): UseMenuOrderFlowResult {
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();

  const [lastOrder, setLastOrder] = useState<MenuOrderResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: MenuOrderInput): Promise<MenuOrderResult> => {
      logger.info('[MenuOrderFlow] Submitting menu order', {
        menuId: input.menu_id,
        itemCount: input.order_items.length,
        totalAmount: input.total_amount,
        component: 'useMenuOrderFlow',
      });

      // Generate trace ID for debugging
      const traceId = crypto.randomUUID();

      // Call the menu-order-place edge function
      // This handles:
      // - Inventory reservation (atomic decrement)
      // - Payment processing
      // - Customer creation
      // - Order insertion into menu_orders table
      const { data, error: fnError } = await supabase.functions.invoke('menu-order-place', {
        body: {
          menu_id: input.menu_id,
          order_items: input.order_items,
          contact_phone: input.contact_phone,
          contact_email: input.contact_email,
          customer_name: input.customer_name,
          payment_method: input.payment_method,
          delivery_address: input.delivery_address,
          customer_notes: input.customer_notes,
          total_amount: input.total_amount,
        },
        headers: {
          'x-trace-id': traceId,
        },
      });

      if (fnError) {
        logger.error('[MenuOrderFlow] Edge function error', fnError, {
          traceId,
          component: 'useMenuOrderFlow',
        });
        throw new Error(fnError.message || 'Failed to place order');
      }

      // Check for error in response body (edge functions can return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : 'Failed to place order';
        logger.error('[MenuOrderFlow] Order rejected', { error: data.error, traceId });
        throw new Error(errorMessage);
      }

      const result: MenuOrderResult = {
        success: true,
        order_id: data?.order_id || crypto.randomUUID(),
        status: data?.status || 'confirmed',
        trace_id: traceId,
      };

      logger.info('[MenuOrderFlow] Order placed successfully', {
        orderId: result.order_id,
        traceId,
        component: 'useMenuOrderFlow',
      });

      return result;
    },

    onSuccess: async (result, input) => {
      setLastOrder(result);
      setError(null);

      // Get tenant_id from menu for event publishing
      const { data: menuData } = await supabase
        .from('disposable_menus')
        .select('tenant_id')
        .eq('id', input.menu_id)
        .maybeSingle();

      const tenantId = menuData?.tenant_id;

      if (tenantId) {
        // Publish order_created event for cross-module sync
        // This notifies:
        // - Notification system (admin alerts)
        // - Dashboard stats
        // - Analytics
        // - Inventory trackers
        publish('order_created', {
          orderId: result.order_id,
          tenantId,
          // No customerId for anonymous menu orders
        });

        // Publish detailed menu_order_created event for admin notifications
        // Includes full order details for rich notifications with sound/push
        publish('menu_order_created', {
          orderId: result.order_id,
          tenantId,
          menuId: input.menu_id,
          customerName: input.customer_name,
          customerPhone: input.contact_phone,
          deliveryAddress: input.delivery_address,
          items: input.order_items.map((item) => ({
            productName: item.product_name || `Product ${item.product_id.slice(0, 8)}`,
            quantity: item.quantity,
            price: item.price,
          })),
          totalAmount: input.total_amount,
          paymentMethod: input.payment_method,
          customerNotes: input.customer_notes,
          createdAt: new Date().toISOString(),
        });

        logger.debug('[MenuOrderFlow] Published order_created and menu_order_created events', {
          orderId: result.order_id,
          tenantId,
          component: 'useMenuOrderFlow',
        });

        // Invalidate relevant queries for immediate UI updates
        // The realtime subscription will also trigger invalidation,
        // but this ensures the UI updates even if realtime is delayed
        queryClient.invalidateQueries({
          queryKey: queryKeys.orders.live(tenantId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.stats(tenantId),
        });
        queryClient.invalidateQueries({
          queryKey: ['menu-orders'],
        });
        queryClient.invalidateQueries({
          queryKey: ['admin-badge-counts'],
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventory.all,
        });
      }

      // Call user's success callback
      onSuccess?.(result);
    },

    onError: (err: unknown) => {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);

      logger.error('[MenuOrderFlow] Order submission failed', errorObj, {
        component: 'useMenuOrderFlow',
      });

      // Call user's error callback
      onError?.(errorObj);
    },
  });

  const submitOrder = useCallback(
    async (input: MenuOrderInput): Promise<MenuOrderResult> => {
      return mutation.mutateAsync(input);
    },
    [mutation]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    submitOrder,
    isSubmitting: mutation.isPending,
    error,
    lastOrder,
    clearError,
  };
}

/**
 * Simpler hook variant for components that just need to know about order status
 */
export function useMenuOrderFlowWithToasts(): UseMenuOrderFlowResult {
  return useMenuOrderFlow({
    onSuccess: (result) => {
      showSuccessToast(
        'Order Placed!',
        `Your order #${result.order_id.slice(0, 8).toUpperCase()} has been submitted.`
      );
    },
    onError: (error) => {
      showErrorToast('Order Failed', error.message);
    },
  });
}

export default useMenuOrderFlow;

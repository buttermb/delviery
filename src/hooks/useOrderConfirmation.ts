/**
 * Hook for order confirmation with inventory decrement
 * When an order status changes to confirmed, automatically decrements inventory
 * for all order line items and logs changes to inventory_history.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

/**
 * Order item structure from unified_order_items
 */
interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

/**
 * Result of a single inventory decrement operation
 */
interface DecrementResult {
  productId: string;
  productName: string;
  previousQuantity: number;
  newQuantity: number;
  decrementedBy: number;
  success: boolean;
  error?: string;
}

/**
 * Options for the confirmation mutation
 */
interface ConfirmOrderOptions {
  orderId: string;
  skipInventoryDecrement?: boolean;
}

/**
 * Hook result type
 */
interface UseOrderConfirmationResult {
  confirmOrder: (options: ConfirmOrderOptions) => void;
  confirmOrderAsync: (options: ConfirmOrderOptions) => Promise<DecrementResult[]>;
  isConfirming: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  results: DecrementResult[] | undefined;
}

/**
 * Hook to confirm an order and decrement inventory for all line items.
 *
 * @example
 * ```tsx
 * const { confirmOrder, isConfirming } = useOrderConfirmation();
 *
 * const handleConfirm = () => {
 *   confirmOrder({ orderId: 'order-123' });
 * };
 * ```
 */
export function useOrderConfirmation(): UseOrderConfirmationResult {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ orderId, skipInventoryDecrement = false }: ConfirmOrderOptions): Promise<DecrementResult[]> => {
      if (!tenant?.id) {
        throw new Error('No tenant context available');
      }

      if (!orderId) {
        throw new Error('Order ID is required');
      }

      logger.info('Starting order confirmation', {
        component: 'useOrderConfirmation',
        orderId,
        tenantId: tenant.id,
      });

      // Fetch order with items from unified_order_items
      const { data: orderData, error: orderError } = await supabase
        .from('unified_orders')
        .select(`
          id,
          order_number,
          status,
          unified_order_items(
            id,
            product_id,
            product_name,
            quantity,
            unit_price
          )
        `)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (orderError) {
        logger.error('Failed to fetch order for confirmation', orderError, {
          component: 'useOrderConfirmation',
          orderId,
        });
        throw new Error(`Failed to fetch order: ${orderError.message}`);
      }

      if (!orderData) {
        throw new Error('Order not found');
      }

      const items = (orderData.unified_order_items || []) as OrderItem[];

      if (items.length === 0) {
        logger.warn('Order has no line items to decrement', {
          component: 'useOrderConfirmation',
          orderId,
        });
      }

      // Update order status to confirmed
      const { error: statusError } = await supabase
        .from('unified_orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (statusError) {
        logger.error('Failed to update order status', statusError, {
          component: 'useOrderConfirmation',
          orderId,
        });
        throw new Error(`Failed to update order status: ${statusError.message}`);
      }

      // Skip inventory decrement if requested
      if (skipInventoryDecrement) {
        logger.info('Skipping inventory decrement as requested', {
          component: 'useOrderConfirmation',
          orderId,
        });
        return [];
      }

      // Process each order item - decrement inventory
      const results: DecrementResult[] = [];

      for (const item of items) {
        try {
          // Fetch current product stock
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, stock_quantity')
            .eq('id', item.product_id)
            .eq('tenant_id', tenant.id)
            .maybeSingle();

          if (productError) {
            logger.error('Failed to fetch product for decrement', productError, {
              component: 'useOrderConfirmation',
              productId: item.product_id,
            });
            results.push({
              productId: item.product_id,
              productName: item.product_name,
              previousQuantity: 0,
              newQuantity: 0,
              decrementedBy: item.quantity,
              success: false,
              error: productError.message,
            });
            continue;
          }

          if (!product) {
            logger.warn('Product not found for inventory decrement', {
              component: 'useOrderConfirmation',
              productId: item.product_id,
            });
            results.push({
              productId: item.product_id,
              productName: item.product_name,
              previousQuantity: 0,
              newQuantity: 0,
              decrementedBy: item.quantity,
              success: false,
              error: 'Product not found',
            });
            continue;
          }

          const previousQuantity = product.stock_quantity || 0;
          const newQuantity = Math.max(0, previousQuantity - item.quantity);

          // Update product stock
          const { error: updateError } = await supabase
            .from('products')
            .update({
              stock_quantity: newQuantity,
              available_quantity: newQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.product_id)
            .eq('tenant_id', tenant.id);

          if (updateError) {
            logger.error('Failed to update product stock', updateError, {
              component: 'useOrderConfirmation',
              productId: item.product_id,
            });
            results.push({
              productId: item.product_id,
              productName: item.product_name,
              previousQuantity,
              newQuantity: previousQuantity,
              decrementedBy: 0,
              success: false,
              error: updateError.message,
            });
            continue;
          }

          // Log to inventory_history
          const historyEntry = {
            tenant_id: tenant.id,
            product_id: item.product_id,
            change_type: 'sale' as const,
            previous_quantity: previousQuantity,
            new_quantity: newQuantity,
            change_amount: -(item.quantity),
            reference_type: 'order_confirmed',
            reference_id: orderId,
            reason: 'order_confirmed',
            notes: `Order ${orderData.order_number || orderId} confirmed - inventory decremented`,
            performed_by: admin?.id || null,
            metadata: {
              order_id: orderId,
              order_number: orderData.order_number,
              order_item_id: item.id,
              source: 'order_confirmation',
            },
          };

          const { error: historyError } = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
            .from('inventory_history')
            .insert(historyEntry);

          if (historyError) {
            // Log but don't fail - stock was already updated
            logger.error('Failed to record inventory history', historyError, {
              component: 'useOrderConfirmation',
              productId: item.product_id,
              orderId,
            });
          }

          results.push({
            productId: item.product_id,
            productName: item.product_name || product.name,
            previousQuantity,
            newQuantity,
            decrementedBy: item.quantity,
            success: true,
          });

          logger.debug('Decremented inventory for order item', {
            component: 'useOrderConfirmation',
            productId: item.product_id,
            previousQuantity,
            newQuantity,
            decrementedBy: item.quantity,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          logger.error('Error processing order item', err, {
            component: 'useOrderConfirmation',
            productId: item.product_id,
          });
          results.push({
            productId: item.product_id,
            productName: item.product_name,
            previousQuantity: 0,
            newQuantity: 0,
            decrementedBy: 0,
            success: false,
            error: message,
          });
        }
      }

      logger.info('Order confirmation completed', {
        component: 'useOrderConfirmation',
        orderId,
        totalItems: items.length,
        successfulDecrements: results.filter(r => r.success).length,
        failedDecrements: results.filter(r => !r.success).length,
      });

      return results;
    },

    onMutate: async ({ orderId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });

      // Snapshot previous values for potential rollback
      const previousOrders = queryClient.getQueryData(queryKeys.orders.all);
      const previousProducts = queryClient.getQueryData(queryKeys.products.all);

      // Optimistic update - mark order as confirmed in cache
      queryClient.setQueriesData(
        { queryKey: queryKeys.orders.detail(tenant?.id || '', orderId) },
        (old: Record<string, unknown> | undefined) => {
          if (!old) return old;
          return { ...old, status: 'confirmed' };
        }
      );

      return { previousOrders, previousProducts };
    },

    onSuccess: (results, { orderId }) => {
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      if (failedCount === 0) {
        showSuccessToast(
          'Order Confirmed',
          `Inventory decremented for ${successCount} item${successCount !== 1 ? 's' : ''}`
        );
      } else {
        showSuccessToast(
          'Order Confirmed',
          `${successCount} items updated, ${failedCount} failed`
        );
      }

      // Cross-panel invalidation
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenant.id, { orderId });
        invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id);
      }

      // Invalidate specific queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },

    onError: (error, { orderId }, context) => {
      const message = error instanceof Error ? error.message : 'Failed to confirm order';
      logger.error('Order confirmation failed', error, {
        component: 'useOrderConfirmation',
        orderId,
      });
      showErrorToast('Confirmation Failed', message);

      // Rollback optimistic updates
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKeys.orders.all, context.previousOrders);
      }
      if (context?.previousProducts) {
        queryClient.setQueryData(queryKeys.products.all, context.previousProducts);
      }
    },
  });

  return {
    confirmOrder: mutation.mutate,
    confirmOrderAsync: mutation.mutateAsync,
    isConfirming: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    results: mutation.data,
  };
}

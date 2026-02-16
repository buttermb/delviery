/**
 * Hook for order cancellation with inventory restoration
 * When an order is cancelled, restores inventory for all line items
 * and logs changes to inventory_history with reason order_cancelled.
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
 * Result of a single inventory restore operation
 */
interface RestoreResult {
  productId: string;
  productName: string;
  previousQuantity: number;
  newQuantity: number;
  restoredBy: number;
  success: boolean;
  error?: string;
}

/**
 * Options for the cancellation mutation
 */
interface CancelOrderOptions {
  orderId: string;
  reason: string;
  restoreInventory?: boolean;
}

/**
 * Hook result type
 */
interface UseOrderCancellationResult {
  cancelOrder: (options: CancelOrderOptions) => void;
  cancelOrderAsync: (options: CancelOrderOptions) => Promise<RestoreResult[]>;
  isCancelling: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  results: RestoreResult[] | undefined;
}

/**
 * Hook to cancel an order and restore inventory for all line items.
 *
 * @example
 * ```tsx
 * const { cancelOrder, isCancelling } = useOrderCancellation();
 *
 * const handleCancel = () => {
 *   cancelOrder({
 *     orderId: 'order-123',
 *     reason: 'Customer requested cancellation',
 *     restoreInventory: true,
 *   });
 * };
 * ```
 */
export function useOrderCancellation(): UseOrderCancellationResult {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      orderId,
      reason,
      restoreInventory = true,
    }: CancelOrderOptions): Promise<RestoreResult[]> => {
      if (!tenant?.id) {
        throw new Error('No tenant context available');
      }

      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!reason) {
        throw new Error('Cancellation reason is required');
      }

      logger.info('Starting order cancellation with inventory restore', {
        component: 'useOrderCancellation',
        orderId,
        tenantId: tenant.id,
        restoreInventory,
      });

      // Fetch order with items from unified_order_items
      const { data: orderData, error: orderError } = await supabase
        .from('unified_orders')
        .select(`
          id,
          order_number,
          status,
          customer_id,
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
        logger.error('Failed to fetch order for cancellation', orderError, {
          component: 'useOrderCancellation',
          orderId,
        });
        throw new Error(`Failed to fetch order: ${orderError.message}`);
      }

      if (!orderData) {
        throw new Error('Order not found');
      }

      // Check if order can be cancelled
      if (orderData.status === 'cancelled') {
        throw new Error('Order is already cancelled');
      }

      if (orderData.status === 'delivered') {
        throw new Error('Cannot cancel a delivered order');
      }

      const items = (orderData.unified_order_items || []) as OrderItem[];

      // Update order status to cancelled
      const { error: statusError } = await supabase
        .from('unified_orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (statusError) {
        logger.error('Failed to update order status to cancelled', statusError, {
          component: 'useOrderCancellation',
          orderId,
        });
        throw new Error(`Failed to cancel order: ${statusError.message}`);
      }

      // Skip inventory restore if not requested or no items
      if (!restoreInventory || items.length === 0) {
        logger.info('Skipping inventory restore', {
          component: 'useOrderCancellation',
          orderId,
          reason: !restoreInventory ? 'not_requested' : 'no_items',
        });
        return [];
      }

      // Process each order item - restore inventory
      const results: RestoreResult[] = [];

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
            logger.error('Failed to fetch product for inventory restore', productError, {
              component: 'useOrderCancellation',
              productId: item.product_id,
            });
            results.push({
              productId: item.product_id,
              productName: item.product_name,
              previousQuantity: 0,
              newQuantity: 0,
              restoredBy: item.quantity,
              success: false,
              error: productError.message,
            });
            continue;
          }

          if (!product) {
            logger.warn('Product not found for inventory restore', {
              component: 'useOrderCancellation',
              productId: item.product_id,
            });
            results.push({
              productId: item.product_id,
              productName: item.product_name,
              previousQuantity: 0,
              newQuantity: 0,
              restoredBy: item.quantity,
              success: false,
              error: 'Product not found',
            });
            continue;
          }

          const previousQuantity = product.stock_quantity || 0;
          const newQuantity = previousQuantity + item.quantity;

          // Update product stock - increment by cancelled quantity
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
            logger.error('Failed to restore product stock', updateError, {
              component: 'useOrderCancellation',
              productId: item.product_id,
            });
            results.push({
              productId: item.product_id,
              productName: item.product_name,
              previousQuantity,
              newQuantity: previousQuantity,
              restoredBy: 0,
              success: false,
              error: updateError.message,
            });
            continue;
          }

          // Log to inventory_history with reason order_cancelled
          const historyEntry = {
            tenant_id: tenant.id,
            product_id: item.product_id,
            change_type: 'return' as const,
            previous_quantity: previousQuantity,
            new_quantity: newQuantity,
            change_amount: item.quantity,
            reference_type: 'order_cancelled',
            reference_id: orderId,
            reason: 'order_cancelled',
            notes: `Order ${orderData.order_number || orderId} cancelled - inventory restored`,
            performed_by: admin?.id || null,
            metadata: {
              order_id: orderId,
              order_number: orderData.order_number,
              order_item_id: item.id,
              cancellation_reason: reason,
              source: 'order_cancellation',
            },
          };

          const { error: historyError } = await (
            supabase as any
          )
            .from('inventory_history')
            .insert(historyEntry);

          if (historyError) {
            // Log but don't fail - stock was already restored
            logger.error('Failed to record inventory history for cancellation', historyError, {
              component: 'useOrderCancellation',
              productId: item.product_id,
              orderId,
            });
          }

          results.push({
            productId: item.product_id,
            productName: item.product_name || product.name,
            previousQuantity,
            newQuantity,
            restoredBy: item.quantity,
            success: true,
          });

          logger.debug('Restored inventory for cancelled order item', {
            component: 'useOrderCancellation',
            productId: item.product_id,
            previousQuantity,
            newQuantity,
            restoredBy: item.quantity,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          logger.error('Error processing inventory restore for order item', err, {
            component: 'useOrderCancellation',
            productId: item.product_id,
          });
          results.push({
            productId: item.product_id,
            productName: item.product_name,
            previousQuantity: 0,
            newQuantity: 0,
            restoredBy: 0,
            success: false,
            error: message,
          });
        }
      }

      logger.info('Order cancellation with inventory restore completed', {
        component: 'useOrderCancellation',
        orderId,
        totalItems: items.length,
        successfulRestores: results.filter((r) => r.success).length,
        failedRestores: results.filter((r) => !r.success).length,
      });

      return results;
    },

    onMutate: async ({ orderId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.inventory.all });

      // Snapshot previous values for potential rollback
      const previousOrders = queryClient.getQueryData(queryKeys.orders.all);
      const previousProducts = queryClient.getQueryData(queryKeys.products.all);

      // Optimistic update - mark order as cancelled in cache
      queryClient.setQueriesData(
        { queryKey: queryKeys.orders.detail(tenant?.id || '', orderId) },
        (old: Record<string, unknown> | undefined) => {
          if (!old) return old;
          return { ...old, status: 'cancelled' };
        }
      );

      return { previousOrders, previousProducts };
    },

    onSuccess: (results, { orderId }) => {
      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;
      const totalRestored = results
        .filter((r) => r.success)
        .reduce((sum, r) => sum + r.restoredBy, 0);

      if (results.length === 0) {
        showSuccessToast('Order Cancelled', 'Order has been cancelled successfully');
      } else if (failedCount === 0) {
        showSuccessToast(
          'Order Cancelled',
          `Inventory restored for ${successCount} item${successCount !== 1 ? 's' : ''} (+${totalRestored} units)`
        );
      } else {
        showSuccessToast(
          'Order Cancelled',
          `${successCount} items restored, ${failedCount} failed`
        );
      }

      // Cross-panel invalidation using event system
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenant.id, { orderId });
        invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id);
      }

      // Invalidate specific queries for orders, products, and inventory
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },

    onError: (error, { orderId }, context) => {
      const message = error instanceof Error ? error.message : 'Failed to cancel order';
      logger.error('Order cancellation failed', error, {
        component: 'useOrderCancellation',
        orderId,
      });
      showErrorToast('Cancellation Failed', message);

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
    cancelOrder: mutation.mutate,
    cancelOrderAsync: mutation.mutateAsync,
    isCancelling: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    results: mutation.data,
  };
}

export default useOrderCancellation;

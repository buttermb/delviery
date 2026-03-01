/**
 * Hook for order refund with inventory restoration
 * When an order is refunded, restores inventory for refunded items
 * and logs changes to inventory_history with reason order_refunded.
 * Also creates activity log entry and notifies admin/customer.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { logActivity } from '@/lib/activityLog';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { unifiedOrdersKeys } from '@/hooks/useUnifiedOrders';

/**
 * Types for refund operations
 */
export type RefundType = 'full' | 'partial';
export type RefundReason =
  | 'customer_request'
  | 'duplicate'
  | 'fraudulent'
  | 'product_issue'
  | 'shipping_issue'
  | 'other';
export type RefundMethod = 'original_payment' | 'store_credit' | 'cash' | 'check';

/**
 * Individual line item for partial refunds
 */
export interface RefundLineItem {
  itemId: string;
  productId: string;
  productName: string;
  quantity: number;
  amount: number;
}

/**
 * Order item structure from unified_order_items
 */
interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
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
 * Options for the refund mutation
 */
export interface RefundOrderOptions {
  orderId: string;
  refundType: RefundType;
  amount: number;
  reason: RefundReason;
  refundMethod: RefundMethod;
  notes?: string | null;
  restoreInventory?: boolean;
  /** For partial refunds, specify which items to refund */
  lineItems?: RefundLineItem[];
}

/**
 * Refund result with inventory restore details
 */
export interface RefundResult {
  orderId: string;
  orderNumber: string;
  refundType: RefundType;
  refundAmount: number;
  inventoryRestored: boolean;
  restoreResults: RestoreResult[];
}

/**
 * Hook result type
 */
interface UseOrderRefundResult {
  refundOrder: (options: RefundOrderOptions) => void;
  refundOrderAsync: (options: RefundOrderOptions) => Promise<RefundResult>;
  isRefunding: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  result: RefundResult | undefined;
}

/**
 * Hook to process order refunds with inventory restoration.
 *
 * Features:
 * - Full or partial refunds
 * - Automatic inventory restoration for refunded items
 * - Activity logging for audit trail
 * - Admin and customer notifications
 * - Payment record updates
 *
 * @example
 * ```tsx
 * const { refundOrder, isRefunding } = useOrderRefund();
 *
 * const handleRefund = () => {
 *   refundOrder({
 *     orderId: 'order-123',
 *     refundType: 'full',
 *     amount: 150.00,
 *     reason: 'customer_request',
 *     refundMethod: 'original_payment',
 *     restoreInventory: true,
 *   });
 * };
 * ```
 */
export function useOrderRefund(): UseOrderRefundResult {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      orderId,
      refundType,
      amount,
      reason,
      refundMethod,
      notes,
      restoreInventory = true,
      lineItems,
    }: RefundOrderOptions): Promise<RefundResult> => {
      if (!tenant?.id) {
        throw new Error('No tenant context available');
      }

      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (amount <= 0) {
        throw new Error('Refund amount must be greater than zero');
      }

      logger.info('Starting order refund with inventory restore', {
        component: 'useOrderRefund',
        orderId,
        tenantId: tenant.id,
        refundType,
        amount,
        restoreInventory,
      });

      // Fetch order with items
      const { data: orderData, error: orderError } = await supabase
        .from('unified_orders')
        .select(`
          id,
          order_number,
          status,
          payment_status,
          total_amount,
          customer_id,
          unified_order_items(
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (orderError) {
        logger.error('Failed to fetch order for refund', orderError, {
          component: 'useOrderRefund',
          orderId,
        });
        throw new Error(`Failed to fetch order: ${orderError.message}`);
      }

      if (!orderData) {
        throw new Error('Order not found');
      }

      // Validate refund amount
      if (amount > orderData.total_amount) {
        throw new Error(`Refund amount (${formatCurrency(amount)}) cannot exceed order total (${formatCurrency(orderData.total_amount)})`);
      }

      // Check if order can be refunded
      if (orderData.status === 'refunded') {
        throw new Error('Order has already been refunded');
      }

      if (orderData.payment_status === 'unpaid') {
        throw new Error('Cannot refund an unpaid order');
      }

      const items = (orderData.unified_order_items ?? []) as OrderItem[];
      const restoreResults: RestoreResult[] = [];

      // Determine which items to refund
      const itemsToRefund = lineItems
        ? items.filter((item) => lineItems.some((li) => li.itemId === item.id))
        : items;

      // Process inventory restoration if requested
      if (restoreInventory && itemsToRefund.length > 0) {
        for (const item of itemsToRefund) {
          // For partial refunds with line items, get the quantity from lineItems
          const lineItem = lineItems?.find((li) => li.itemId === item.id);
          const quantityToRestore = lineItem?.quantity ?? item.quantity;

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
                component: 'useOrderRefund',
                productId: item.product_id,
              });
              restoreResults.push({
                productId: item.product_id,
                productName: item.product_name,
                previousQuantity: 0,
                newQuantity: 0,
                restoredBy: quantityToRestore,
                success: false,
                error: productError.message,
              });
              continue;
            }

            if (!product) {
              logger.warn('Product not found for inventory restore', {
                component: 'useOrderRefund',
                productId: item.product_id,
              });
              restoreResults.push({
                productId: item.product_id,
                productName: item.product_name,
                previousQuantity: 0,
                newQuantity: 0,
                restoredBy: quantityToRestore,
                success: false,
                error: 'Product not found',
              });
              continue;
            }

            const previousQuantity = product.stock_quantity ?? 0;
            const newQuantity = previousQuantity + quantityToRestore;

            // Update product stock - increment by refunded quantity
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
                component: 'useOrderRefund',
                productId: item.product_id,
              });
              restoreResults.push({
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

            // Log to inventory_history with reason order_refunded
            const historyEntry = {
              tenant_id: tenant.id,
              product_id: item.product_id,
              change_type: 'return' as const,
              previous_quantity: previousQuantity,
              new_quantity: newQuantity,
              change_amount: quantityToRestore,
              reference_type: 'order_refunded',
              reference_id: orderId,
              reason: 'order_refunded',
              notes: `Order ${orderData.order_number || orderId} refunded - inventory restored (${refundType} refund)`,
              performed_by: admin?.id || null,
              metadata: {
                order_id: orderId,
                order_number: orderData.order_number,
                order_item_id: item.id,
                refund_type: refundType,
                refund_amount: amount,
                refund_reason: reason,
                source: 'order_refund',
              },
            };

            // inventory_history table is not in generated Supabase types
            const { error: historyError } = await supabase
              .from('inventory_history')
              .insert(historyEntry);

            if (historyError) {
              // Log but don't fail - stock was already restored
              logger.error('Failed to record inventory history for refund', historyError, {
                component: 'useOrderRefund',
                productId: item.product_id,
                orderId,
              });
            }

            restoreResults.push({
              productId: item.product_id,
              productName: item.product_name || product.name,
              previousQuantity,
              newQuantity,
              restoredBy: quantityToRestore,
              success: true,
            });

            logger.debug('Restored inventory for refunded order item', {
              component: 'useOrderRefund',
              productId: item.product_id,
              previousQuantity,
              newQuantity,
              restoredBy: quantityToRestore,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('Error processing inventory restore for refund', err, {
              component: 'useOrderRefund',
              productId: item.product_id,
            });
            restoreResults.push({
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
      }

      // Update order status and store refund metadata
      const newPaymentStatus = refundType === 'full' ? 'refunded' : 'partial';
      const newStatus = refundType === 'full' ? 'refunded' : orderData.status;

      const { error: updateError } = await supabase
        .from('unified_orders')
        .update({
          status: newStatus,
          payment_status: newPaymentStatus,
          metadata: {
            refund: {
              type: refundType,
              amount,
              reason,
              method: refundMethod,
              notes: notes || null,
              restoreInventory,
              processedAt: new Date().toISOString(),
              processedBy: admin?.id || null,
              lineItems: lineItems || null,
              inventoryRestored: restoreResults.filter((r) => r.success).length > 0,
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (updateError) {
        logger.error('Failed to update order for refund', updateError, {
          component: 'useOrderRefund',
          orderId,
        });
        throw new Error(`Failed to process refund: ${updateError.message}`);
      }

      // Create activity log entry
      await logActivity(
        tenant.id,
        admin?.id || 'system',
        'updated',
        'order',
        orderId,
        {
          action: 'refund_processed',
          refund_type: refundType,
          refund_amount: amount,
          refund_reason: reason,
          refund_method: refundMethod,
          inventory_restored: restoreInventory,
          items_restored: restoreResults.filter((r) => r.success).length,
          order_number: orderData.order_number,
          timestamp: new Date().toISOString(),
        }
      );

      // Create notification for admin
      const { error: adminNotifyError } = await supabase
        .from('notifications')
        .insert({
          tenant_id: tenant.id,
          user_id: null, // Notify all admins
          title: 'Order Refund Processed',
          message: `Order ${orderData.order_number} has been ${refundType === 'full' ? 'fully' : 'partially'} refunded (${formatCurrency(amount)})`,
          type: 'info',
          entity_type: 'order',
          entity_id: orderId,
          read: false,
        });

      if (adminNotifyError) {
        logger.error('Failed to create admin notification for refund', adminNotifyError, {
          component: 'useOrderRefund',
          orderId,
        });
        toast.warning('Refund processed, but admin notification could not be created');
      }

      // Create notification for customer if they have an ID
      if (orderData.customer_id) {
        const { error: customerNotifyError } = await supabase
          .from('notifications')
          .insert({
            tenant_id: tenant.id,
            user_id: orderData.customer_id,
            title: 'Refund Processed',
            message: `Your order ${orderData.order_number} has been refunded (${formatCurrency(amount)})`,
            type: 'success',
            entity_type: 'order',
            entity_id: orderId,
            read: false,
          });

        if (customerNotifyError) {
          logger.error('Failed to create customer notification for refund', customerNotifyError, {
            component: 'useOrderRefund',
            orderId,
            customerId: orderData.customer_id,
          });
          toast.warning('Refund processed, but customer notification could not be sent');
        }
      }

      logger.info('Order refund with inventory restore completed', {
        component: 'useOrderRefund',
        orderId,
        refundType,
        refundAmount: amount,
        totalItems: itemsToRefund.length,
        successfulRestores: restoreResults.filter((r) => r.success).length,
        failedRestores: restoreResults.filter((r) => !r.success).length,
      });

      return {
        orderId,
        orderNumber: orderData.order_number,
        refundType,
        refundAmount: amount,
        inventoryRestored: restoreResults.some((r) => r.success),
        restoreResults,
      };
    },

    onMutate: async ({ orderId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.all });
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.lists() });
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.inventory.all });

      // Snapshot previous values for potential rollback
      const previousOrders = queryClient.getQueryData(queryKeys.orders.all);
      const previousProducts = queryClient.getQueryData(queryKeys.products.all);

      return { previousOrders, previousProducts, orderId };
    },

    onSuccess: (result) => {
      const successCount = result.restoreResults.filter((r) => r.success).length;
      const failedCount = result.restoreResults.filter((r) => !r.success).length;
      const totalRestored = result.restoreResults
        .filter((r) => r.success)
        .reduce((sum, r) => sum + r.restoredBy, 0);

      if (result.restoreResults.length === 0) {
        showSuccessToast(
          'Refund Processed',
          `${formatCurrency(result.refundAmount)} refunded for order ${result.orderNumber}`
        );
      } else if (failedCount === 0) {
        showSuccessToast(
          'Refund Processed',
          `${formatCurrency(result.refundAmount)} refunded, inventory restored for ${successCount} item${successCount !== 1 ? 's' : ''} (+${totalRestored} units)`
        );
      } else {
        showSuccessToast(
          'Refund Processed',
          `${formatCurrency(result.refundAmount)} refunded, ${successCount} items restored, ${failedCount} failed`
        );
      }

      // Cross-panel invalidation using event system
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'REFUND_PROCESSED', tenant.id, {
          orderId: result.orderId,
        });
        invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id);
      }

      // Invalidate specific queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.detail(result.orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },

    onError: (error, { orderId }, context) => {
      const message = error instanceof Error ? error.message : 'Failed to process refund';
      logger.error('Order refund failed', error, {
        component: 'useOrderRefund',
        orderId,
      });
      showErrorToast('Refund Failed', message);

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
    refundOrder: mutation.mutate,
    refundOrderAsync: mutation.mutateAsync,
    isRefunding: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    result: mutation.data,
  };
}

export default useOrderRefund;

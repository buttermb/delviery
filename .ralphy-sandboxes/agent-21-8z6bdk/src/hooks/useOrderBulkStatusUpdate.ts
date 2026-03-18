import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { triggerHaptic } from '@/lib/utils/mobile';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';
import { logActivities, ActivityAction, EntityType, createActivityMetadata } from '@/lib/activityLog';

interface FailedItem {
  id: string;
  name: string;
  error: string;
}

interface BulkStatusUpdateState {
  isRunning: boolean;
  isComplete: boolean;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  failedItems: FailedItem[];
}

interface OrderInfo {
  id: string;
  order_number: string | null;
}

interface UseOrderBulkStatusUpdateOptions {
  tenantId: string | undefined;
  userId?: string | undefined;
  onSuccess?: () => void;
}

const BATCH_SIZE = 10;

/**
 * Creates a notification for bulk status update
 */
async function createBulkStatusNotification(
  tenantId: string,
  count: number,
  targetStatus: string,
  failedCount: number
): Promise<void> {
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };

  const statusLabel = statusLabels[targetStatus] || targetStatus;
  const successCount = count - failedCount;

  const title = failedCount === 0
    ? `Bulk Update Complete`
    : `Bulk Update Partial`;

  const message = failedCount === 0
    ? `${successCount} order${successCount !== 1 ? 's' : ''} updated to "${statusLabel}"`
    : `${successCount} order${successCount !== 1 ? 's' : ''} updated, ${failedCount} failed`;

  const { error } = await supabase.from('notifications').insert({
    tenant_id: tenantId,
    user_id: null, // Notify all admins
    title,
    message,
    type: failedCount === 0 ? 'success' : 'warning',
    entity_type: 'order',
    entity_id: null,
    read: false,
    metadata: {
      action: 'bulk_status_update',
      target_status: targetStatus,
      total_count: count,
      success_count: successCount,
      failed_count: failedCount,
    },
  });

  if (error) {
    logger.error('Failed to create bulk status notification', error, {
      component: 'useOrderBulkStatusUpdate',
      tenantId,
    });
  }
}

/**
 * Restores inventory for cancelled orders
 * Similar to useOrderCancellation but handles multiple orders
 */
async function restoreInventoryForCancelledOrders(
  tenantId: string,
  orderIds: string[],
  performedBy: string | null
): Promise<{ success: number; failed: number }> {
  let successCount = 0;
  let failedCount = 0;

  for (const orderId of orderIds) {
    try {
      // Fetch order items — try order_items first, then unified_order_items
      let orderItems: { id: string; product_id: string; quantity: number }[] | null = null;

      const { data: legacyItems, error: legacyError } = await supabase
        .from('order_items')
        .select('id, product_id, quantity')
        .eq('order_id', orderId);

      if (legacyError) {
        logger.warn('order_items query failed, trying unified_order_items', {
          component: 'useOrderBulkStatusUpdate',
          orderId,
          error: legacyError,
        });
      }

      if (!legacyError && legacyItems && legacyItems.length > 0) {
        orderItems = legacyItems;
      } else {
        // Fallback to unified_order_items
        const { data: unifiedItems, error: unifiedError } = await supabase
          .from('unified_order_items')
          .select('id, product_id, quantity')
          .eq('order_id', orderId);

        if (unifiedError) {
          logger.error('Failed to fetch order items for inventory restore', unifiedError, {
            component: 'useOrderBulkStatusUpdate',
            orderId,
          });
          failedCount++;
          continue;
        }
        orderItems = unifiedItems;
      }

      if (!orderItems || orderItems.length === 0) {
        // No items to restore, count as success
        successCount++;
        continue;
      }

      // Restore inventory for each item
      for (const item of orderItems) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .eq('id', item.product_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (productError || !product) {
          logger.warn('Product not found for inventory restore', {
            component: 'useOrderBulkStatusUpdate',
            productId: item.product_id,
          });
          continue;
        }

        const previousQuantity = product.stock_quantity ?? 0;
        const newQuantity = previousQuantity + item.quantity;

        // Update product stock
        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock_quantity: newQuantity,
            available_quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.product_id)
          .eq('tenant_id', tenantId);

        if (updateError) {
          logger.error('Failed to restore inventory', updateError, {
            component: 'useOrderBulkStatusUpdate',
            productId: item.product_id,
          });
          continue;
        }

        // Log to inventory_history
        const historyEntry = {
          tenant_id: tenantId,
          product_id: item.product_id,
          change_type: 'return' as const,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          change_amount: item.quantity,
          reference_type: 'order_cancelled',
          reference_id: orderId,
          reason: 'bulk_order_cancelled',
          notes: `Bulk cancellation - inventory restored`,
          performed_by: performedBy,
          metadata: {
            order_id: orderId,
            order_item_id: item.id,
            source: 'bulk_status_update',
          },
        };

        // inventory_history table is not in generated Supabase types
        await supabase
          .from('inventory_history')
          .insert(historyEntry);
      }

      successCount++;
    } catch (err) {
      logger.error('Error restoring inventory for order', err, {
        component: 'useOrderBulkStatusUpdate',
        orderId,
      });
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount };
}

/**
 * Decrements inventory for delivered orders
 * When an order is delivered, reduce stock_quantity for each line item.
 * Prevents double-decrement by checking inventory_history for prior deductions.
 */
async function decrementInventoryForDeliveredOrders(
  tenantId: string,
  orderIds: string[],
  performedBy: string | null
): Promise<{ success: number; failed: number }> {
  let successCount = 0;
  let failedCount = 0;

  for (const orderId of orderIds) {
    try {
      // Check if inventory was already decremented for this order (e.g., at confirmation)
      const { data: existingHistory } = await supabase
        .from('inventory_history')
        .select('id')
        .eq('reference_id', orderId)
        .in('reference_type', ['order_confirmed', 'order_delivered', 'unified_order_confirmed_inventory_deducted'])
        .limit(1);

      if (existingHistory && existingHistory.length > 0) {
        // Stock was already decremented — skip to prevent double-decrement
        successCount++;
        continue;
      }

      // Fetch order items — try order_items first, then unified_order_items
      let orderItems: { id: string; product_id: string; quantity: number }[] | null = null;

      const { data: legacyItems, error: legacyError } = await supabase
        .from('order_items')
        .select('id, product_id, quantity')
        .eq('order_id', orderId);

      if (legacyError) {
        logger.warn('order_items query failed for inventory decrement, trying unified_order_items', {
          component: 'useOrderBulkStatusUpdate',
          orderId,
          error: legacyError,
        });
      }

      if (!legacyError && legacyItems && legacyItems.length > 0) {
        orderItems = legacyItems;
      } else {
        const { data: unifiedItems, error: unifiedError } = await supabase
          .from('unified_order_items')
          .select('id, product_id, quantity')
          .eq('order_id', orderId);

        if (unifiedError) {
          logger.error('Failed to fetch order items for inventory decrement', unifiedError, {
            component: 'useOrderBulkStatusUpdate',
            orderId,
          });
          failedCount++;
          continue;
        }
        orderItems = unifiedItems;
      }

      if (!orderItems || orderItems.length === 0) {
        successCount++;
        continue;
      }

      // Decrement inventory for each item
      for (const item of orderItems) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .eq('id', item.product_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (productError || !product) {
          logger.warn('Product not found for inventory decrement', {
            component: 'useOrderBulkStatusUpdate',
            productId: item.product_id,
          });
          continue;
        }

        const previousQuantity = product.stock_quantity ?? 0;
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
          .eq('tenant_id', tenantId);

        if (updateError) {
          logger.error('Failed to decrement inventory', updateError, {
            component: 'useOrderBulkStatusUpdate',
            productId: item.product_id,
          });
          continue;
        }

        // Log to inventory_history
        const historyEntry = {
          tenant_id: tenantId,
          product_id: item.product_id,
          change_type: 'sale' as const,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          change_amount: -item.quantity,
          reference_type: 'order_delivered',
          reference_id: orderId,
          reason: 'order_delivered',
          notes: `Bulk delivery - inventory decremented`,
          performed_by: performedBy,
          metadata: {
            order_id: orderId,
            order_item_id: item.id,
            source: 'bulk_status_update',
          },
        };

        // inventory_history table is not in generated Supabase types
        await supabase
          .from('inventory_history')
          .insert(historyEntry);
      }

      successCount++;
    } catch (err) {
      logger.error('Error decrementing inventory for order', err, {
        component: 'useOrderBulkStatusUpdate',
        orderId,
      });
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount };
}

export function useOrderBulkStatusUpdate({ tenantId, userId, onSuccess }: UseOrderBulkStatusUpdateOptions) {
  const queryClient = useQueryClient();
  const abortRef = useRef(false);

  const [state, setState] = useState<BulkStatusUpdateState>({
    isRunning: false,
    isComplete: false,
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    failedItems: [],
  });

  const [showProgress, setShowProgress] = useState(false);

  const reset = useCallback(() => {
    setState({
      isRunning: false,
      isComplete: false,
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      failedItems: [],
    });
    abortRef.current = false;
  }, []);

  const executeBulkUpdate = useCallback(async (
    orders: OrderInfo[],
    targetStatus: string
  ) => {
    if (!tenantId) {
      toast.error('No tenant context available');
      return;
    }

    reset();
    setShowProgress(true);
    abortRef.current = false;

    const total = orders.length;
    setState(prev => ({ ...prev, isRunning: true, total }));

    const now = new Date().toISOString();
    const statusTimestamps: Record<string, Record<string, string>> = {
      delivered: { delivered_at: now },
      in_transit: { courier_assigned_at: now },
      confirmed: { accepted_at: now },
    };

    const updatePayload = {
      status: targetStatus,
      updated_at: now,
      ...statusTimestamps[targetStatus],
    };

    let succeededCount = 0;
    let failedCount = 0;
    const failedItems: FailedItem[] = [];

    // Process in batches for progress visibility
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      if (abortRef.current) break;

      const batch = orders.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map(o => o.id);

      try {
        const { error } = await supabase
          .from('orders')
          .update(updatePayload)
          .in('id', batchIds)
          .eq('tenant_id', tenantId);

        if (error) {
          // If the batch fails, mark all items in the batch as failed
          for (const order of batch) {
            failedCount++;
            failedItems.push({
              id: order.id,
              name: `#${order.order_number || order.id.slice(0, 8)}`,
              error: error.message,
            });
          }
        } else {
          succeededCount += batch.length;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        for (const order of batch) {
          failedCount++;
          failedItems.push({
            id: order.id,
            name: `#${order.order_number || order.id.slice(0, 8)}`,
            error: errorMessage,
          });
        }
      }

      const completed = Math.min(i + BATCH_SIZE, orders.length);
      setState(prev => ({
        ...prev,
        completed,
        succeeded: succeededCount,
        failed: failedCount,
        failedItems: [...failedItems],
      }));
    }

    setState(prev => ({
      ...prev,
      isRunning: false,
      isComplete: true,
    }));

    // Get successfully updated order IDs (those not in failedItems)
    const failedIds = new Set(failedItems.map(f => f.id));
    const succeededOrders = orders.filter(o => !failedIds.has(o.id));

    // Handle results
    if (succeededCount > 0) {
      // 1. Log activity for each successfully updated order
      if (userId) {
        const activityEntries = succeededOrders.map(order => ({
          tenantId,
          userId,
          action: ActivityAction.UPDATED,
          entityType: EntityType.ORDER,
          entityId: order.id,
          metadata: createActivityMetadata(
            { status: targetStatus },
            undefined,
            {
              order_number: order.order_number,
              bulk_operation: true,
              total_in_batch: total,
            }
          ),
        }));

        // Log activities in batch (non-blocking)
        logActivities(activityEntries).catch(err => {
          logger.error('Failed to log bulk status update activities', err, {
            component: 'useOrderBulkStatusUpdate',
            tenantId,
            count: activityEntries.length,
          });
          toast.warning('Status updated, but activity log could not be saved');
        });
      }

      // 2. Dispatch notification for bulk status update
      createBulkStatusNotification(tenantId, total, targetStatus, failedCount).catch(err => {
        logger.error('Failed to dispatch bulk status notification', err, {
          component: 'useOrderBulkStatusUpdate',
          tenantId,
        });
        toast.warning('Status updated, but notification could not be sent');
      });

      // 3. Restore inventory for cancelled orders
      if (targetStatus === 'cancelled' && succeededOrders.length > 0) {
        const succeededIds = succeededOrders.map(o => o.id);
        restoreInventoryForCancelledOrders(tenantId, succeededIds, userId || null).then(result => {
          if (result.failed > 0) {
            logger.warn('Some inventory restores failed during bulk cancellation', {
              component: 'useOrderBulkStatusUpdate',
              success: result.success,
              failed: result.failed,
            });
            toast.warning(`${result.failed} inventory restore(s) failed during cancellation`);
          }
        }).catch(err => {
          logger.error('Failed to restore inventory for cancelled orders', err, {
            component: 'useOrderBulkStatusUpdate',
            tenantId,
          });
          toast.error('Failed to restore inventory for cancelled orders', { description: humanizeError(err) });
        });
      }

      // 4. Decrement inventory for delivered orders
      if (targetStatus === 'delivered' && succeededOrders.length > 0) {
        const succeededIds = succeededOrders.map(o => o.id);
        decrementInventoryForDeliveredOrders(tenantId, succeededIds, userId || null).then(result => {
          if (result.failed > 0) {
            logger.warn('Some inventory decrements failed during bulk delivery', {
              component: 'useOrderBulkStatusUpdate',
              success: result.success,
              failed: result.failed,
            });
            toast.warning(`${result.failed} inventory decrement(s) failed during delivery`);
          }
        }).catch(err => {
          logger.error('Failed to decrement inventory for delivered orders', err, {
            component: 'useOrderBulkStatusUpdate',
            tenantId,
          });
          toast.error('Failed to update inventory for delivered orders', { description: humanizeError(err) });
        });
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

      // Cross-panel invalidation for bulk status change
      if (tenantId) {
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenantId);

        // Status-specific invalidation
        if (targetStatus === 'cancelled') {
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
        }
        if (targetStatus === 'delivered' || targetStatus === 'completed') {
          queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
        }
        if (targetStatus === 'confirmed') {
          queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.queue(tenantId) });
        }
      }

      // Invalidate activity queries
      queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });

      if (failedCount === 0) {
        toast.success(`Updated ${succeededCount} order${succeededCount !== 1 ? 's' : ''} to ${targetStatus}`);
        triggerHaptic('light');
      } else {
        toast.warning(`Updated ${succeededCount} orders, ${failedCount} failed`);
        triggerHaptic('medium');
      }
    } else {
      toast.error(`Failed to update orders`);
      triggerHaptic('heavy');
      logger.error('Bulk order status update failed completely', new Error('All batch updates failed'), {
        component: 'useOrderBulkStatusUpdate',
        tenantId,
        targetStatus,
        orderCount: total,
      });
    }

    onSuccess?.();
  }, [tenantId, userId, queryClient, reset, onSuccess]);

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const closeProgress = useCallback(() => {
    setShowProgress(false);
    reset();
  }, [reset]);

  return {
    ...state,
    showProgress,
    executeBulkUpdate,
    cancel,
    closeProgress,
    reset,
  };
}

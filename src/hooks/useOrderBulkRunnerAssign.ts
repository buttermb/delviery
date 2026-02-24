import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { triggerHaptic } from '@/lib/utils/mobile';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';
import { logActivities, ActivityAction, EntityType, createActivityMetadata } from '@/lib/activityLog';

interface FailedItem {
  id: string;
  name: string;
  error: string;
}

interface BulkRunnerAssignState {
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

interface UseOrderBulkRunnerAssignOptions {
  tenantId: string | undefined;
  userId?: string | undefined;
  onSuccess?: () => void;
}

const BATCH_SIZE = 5;

/**
 * Creates a notification for bulk runner assignment
 */
async function createBulkAssignNotification(
  tenantId: string,
  count: number,
  runnerName: string,
  failedCount: number
): Promise<void> {
  const successCount = count - failedCount;

  const title = failedCount === 0
    ? `Bulk Assignment Complete`
    : `Bulk Assignment Partial`;

  const message = failedCount === 0
    ? `${successCount} order${successCount !== 1 ? 's' : ''} assigned to ${runnerName}`
    : `${successCount} order${successCount !== 1 ? 's' : ''} assigned, ${failedCount} failed`;

  const { error } = await (supabase as any).from('notifications').insert({
    tenant_id: tenantId,
    user_id: null, // Notify all admins
    title,
    message,
    type: failedCount === 0 ? 'success' : 'warning',
    entity_type: 'delivery',
    entity_id: null,
    read: false,
    metadata: {
      action: 'bulk_runner_assign',
      runner_name: runnerName,
      total_count: count,
      success_count: successCount,
      failed_count: failedCount,
    },
  });

  if (error) {
    logger.error('Failed to create bulk assignment notification', error, {
      component: 'useOrderBulkRunnerAssign',
      tenantId,
    });
  }
}

/**
 * Creates a notification for the assigned runner
 */
async function notifyRunner(
  tenantId: string,
  runnerId: string,
  orderCount: number,
  runnerName: string
): Promise<void> {
  const { error } = await (supabase as any).from('notifications').insert({
    tenant_id: tenantId,
    user_id: runnerId,
    title: 'New Deliveries Assigned',
    message: `You have been assigned ${orderCount} new order${orderCount !== 1 ? 's' : ''} for delivery`,
    type: 'info',
    entity_type: 'delivery',
    entity_id: null,
    read: false,
    metadata: {
      action: 'delivery_assigned',
      order_count: orderCount,
      runner_name: runnerName,
    },
  });

  if (error) {
    logger.error('Failed to notify runner about assignment', error, {
      component: 'useOrderBulkRunnerAssign',
      tenantId,
      runnerId,
    });
  }
}

/**
 * Hook for bulk assigning orders to a delivery runner
 * Creates delivery records, updates order status to 'assigned',
 * notifies the runner, and logs activity.
 */
export function useOrderBulkRunnerAssign({ tenantId, userId, onSuccess }: UseOrderBulkRunnerAssignOptions) {
  const queryClient = useQueryClient();
  const abortRef = useRef(false);

  const [state, setState] = useState<BulkRunnerAssignState>({
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

  const executeBulkAssign = useCallback(async (
    orders: OrderInfo[],
    runnerId: string,
    runnerName: string
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

    let succeededCount = 0;
    let failedCount = 0;
    const failedItems: FailedItem[] = [];
    const succeededOrders: OrderInfo[] = [];

    // Process orders one at a time or in small batches
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      if (abortRef.current) break;

      const batch = orders.slice(i, i + BATCH_SIZE);

      for (const order of batch) {
        if (abortRef.current) break;

        try {
          // 1. Create delivery record
          const { data: delivery, error: deliveryError } = await supabase
            .from('wholesale_deliveries')
            .insert({
              tenant_id: tenantId,
              order_id: order.id,
              runner_id: runnerId,
              status: 'pending',
              assigned_at: now,
              created_at: now,
              updated_at: now,
            })
            .select('id')
            .maybeSingle();

          if (deliveryError) {
            throw new Error(deliveryError.message);
          }

          // 2. Update order status to 'assigned'
          const { error: orderError } = await supabase
            .from('orders')
            .update({
              status: 'assigned',
              courier_id: runnerId,
              courier_assigned_at: now,
              updated_at: now,
            })
            .eq('id', order.id)
            .eq('tenant_id', tenantId);

          if (orderError) {
            // Rollback delivery if order update fails
            await supabase
              .from('wholesale_deliveries')
              .delete()
              .eq('id', delivery.id);
            throw new Error(orderError.message);
          }

          succeededCount++;
          succeededOrders.push(order);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          failedCount++;
          failedItems.push({
            id: order.id,
            name: `#${order.order_number || order.id.slice(0, 8)}`,
            error: errorMessage,
          });
          logger.error('Failed to assign order to runner', err instanceof Error ? err : new Error(errorMessage), {
            component: 'useOrderBulkRunnerAssign',
            orderId: order.id,
            runnerId,
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

    // Handle results
    if (succeededCount > 0) {
      // 1. Log activity for each successfully assigned order
      if (userId) {
        const activityEntries = succeededOrders.map(order => ({
          tenantId,
          userId,
          action: ActivityAction.UPDATED,
          entityType: EntityType.ORDER,
          entityId: order.id,
          metadata: createActivityMetadata(
            { status: 'assigned', runner_id: runnerId },
            undefined,
            {
              order_number: order.order_number,
              runner_name: runnerName,
              bulk_operation: true,
              total_in_batch: total,
              action_type: 'bulk_runner_assign',
            }
          ),
        }));

        // Log activities in batch (non-blocking)
        logActivities(activityEntries).catch(err => {
          logger.error('Failed to log bulk runner assignment activities', err, {
            component: 'useOrderBulkRunnerAssign',
            tenantId,
            count: activityEntries.length,
          });
        });
      }

      // 2. Dispatch notification for bulk assignment
      createBulkAssignNotification(tenantId, total, runnerName, failedCount).catch(err => {
        logger.error('Failed to dispatch bulk assignment notification', err, {
          component: 'useOrderBulkRunnerAssign',
          tenantId,
        });
      });

      // 3. Notify the runner
      notifyRunner(tenantId, runnerId, succeededCount, runnerName).catch(err => {
        logger.error('Failed to notify runner', err, {
          component: 'useOrderBulkRunnerAssign',
          tenantId,
          runnerId,
        });
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.runners.all });
      queryClient.invalidateQueries({ queryKey: ['wholesale-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.fulfillment.all });

      // Cross-panel invalidation
      if (tenantId) {
        invalidateOnEvent(queryClient, 'DRIVER_ASSIGNED', tenantId, {
          courierId: runnerId,
        });
      }

      // Invalidate activity queries
      queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });

      if (failedCount === 0) {
        toast.success(`Assigned ${succeededCount} order${succeededCount !== 1 ? 's' : ''} to ${runnerName}`);
        triggerHaptic('light');
      } else {
        toast.warning(`Assigned ${succeededCount} orders, ${failedCount} failed`);
        triggerHaptic('medium');
      }
    } else {
      toast.error(`Failed to assign orders to runner`);
      triggerHaptic('heavy');
      logger.error('Bulk runner assignment failed completely', new Error('All assignments failed'), {
        component: 'useOrderBulkRunnerAssign',
        tenantId,
        runnerId,
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
    executeBulkAssign,
    cancel,
    closeProgress,
    reset,
  };
}

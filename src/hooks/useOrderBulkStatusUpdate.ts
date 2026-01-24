import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { triggerHaptic } from '@/lib/utils/mobile';

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
  onSuccess?: () => void;
}

const BATCH_SIZE = 10;

export function useOrderBulkStatusUpdate({ tenantId, onSuccess }: UseOrderBulkStatusUpdateOptions) {
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

    // Handle results
    if (succeededCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });

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
  }, [tenantId, queryClient, reset, onSuccess]);

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

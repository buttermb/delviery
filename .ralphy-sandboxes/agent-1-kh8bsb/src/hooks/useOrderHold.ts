import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

interface HoldOrderParams {
  orderId: string;
  reason: string;
  tenantId: string;
  previousStatus: string;
}

interface ResumeOrderParams {
  orderId: string;
  tenantId: string;
  targetStatus?: string;
}

interface OrderHoldMetadata {
  hold_reason?: string;
  held_at?: string;
  held_by?: string;
  previous_status?: string;
  resumed_at?: string;
  resumed_by?: string;
}

/**
 * Hook for placing an order on hold with a reason
 */
export function useHoldOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, reason, tenantId, previousStatus }: HoldOrderParams) => {
      const now = new Date().toISOString();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // First, get the current metadata to preserve existing data
      const { data: currentOrder, error: fetchError } = await supabase
        .from('unified_orders')
        .select('metadata')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to fetch order: ${fetchError.message}`);
      }

      if (!currentOrder) {
        throw new Error('Order not found');
      }

      const existingMetadata = (currentOrder.metadata || {}) as Record<string, unknown>;
      const holdMetadata: OrderHoldMetadata = {
        hold_reason: reason,
        held_at: now,
        held_by: user?.id,
        previous_status: previousStatus,
      };

      const updatedMetadata = {
        ...existingMetadata,
        ...holdMetadata,
      };

      const { error: updateError } = await supabase
        .from('unified_orders')
        .update({
          status: 'on_hold',
          metadata: updatedMetadata,
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        throw new Error(`Failed to hold order: ${updateError.message}`);
      }

      return { orderId, reason };
    },
    onSuccess: (data) => {
      toast.success('Order placed on hold', {
        description: `Reason: ${data.reason}`,
      });

      // Invalidate order-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      queryClient.invalidateQueries({ queryKey: ['orders-live'] });
      queryClient.invalidateQueries({ queryKey: ['unified-orders'] });
    },
    onError: (error: Error) => {
      logger.error('Failed to hold order', error, { component: 'useHoldOrder' });
      toast.error('Failed to place order on hold', {
        description: humanizeError(error),
      });
    },
  });
}

/**
 * Hook for resuming an order that was on hold
 */
export function useResumeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, tenantId, targetStatus }: ResumeOrderParams) => {
      const now = new Date().toISOString();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Get the current order to retrieve the previous status
      const { data: currentOrder, error: fetchError } = await supabase
        .from('unified_orders')
        .select('metadata, status')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to fetch order: ${fetchError.message}`);
      }

      if (!currentOrder) {
        throw new Error('Order not found');
      }

      if (currentOrder.status !== 'on_hold') {
        throw new Error('Order is not on hold');
      }

      const existingMetadata = (currentOrder.metadata || {}) as Record<string, unknown>;

      // Determine the status to resume to
      const previousStatus = existingMetadata.previous_status as string | undefined;
      const newStatus = targetStatus || previousStatus || 'pending';

      const updatedMetadata = {
        ...existingMetadata,
        resumed_at: now,
        resumed_by: user?.id,
      };

      const { error: updateError } = await supabase
        .from('unified_orders')
        .update({
          status: newStatus,
          metadata: updatedMetadata,
          updated_at: now,
        })
        .eq('id', orderId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        throw new Error(`Failed to resume order: ${updateError.message}`);
      }

      return { orderId, newStatus };
    },
    onSuccess: (data) => {
      toast.success('Order resumed', {
        description: `Status changed to ${data.newStatus}`,
      });

      // Invalidate order-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      queryClient.invalidateQueries({ queryKey: ['orders-live'] });
      queryClient.invalidateQueries({ queryKey: ['unified-orders'] });
    },
    onError: (error: Error) => {
      logger.error('Failed to resume order', error, { component: 'useResumeOrder' });
      toast.error('Failed to resume order', {
        description: humanizeError(error),
      });
    },
  });
}

/**
 * Combined hook for order hold operations
 */
export function useOrderHold() {
  const holdMutation = useHoldOrder();
  const resumeMutation = useResumeOrder();

  return {
    holdOrder: holdMutation.mutate,
    holdOrderAsync: holdMutation.mutateAsync,
    isHolding: holdMutation.isPending,

    resumeOrder: resumeMutation.mutate,
    resumeOrderAsync: resumeMutation.mutateAsync,
    isResuming: resumeMutation.isPending,

    isProcessing: holdMutation.isPending || resumeMutation.isPending,
  };
}

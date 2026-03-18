/**
 * useOrderRush - Hook to mark orders as rush (expedited to front of queue)
 *
 * Provides mutation to toggle rush status on orders with:
 * - Optimistic updates for instant UI feedback
 * - Automatic query invalidation
 * - Error handling with toast notifications
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { triggerHaptic } from '@/lib/utils/mobile';

interface RushOrderParams {
  orderId: string;
  isRush: boolean;
  orderNumber?: string | null;
}

interface RushOrderResult {
  orderId: string;
  isRush: boolean;
  rushedAt: string | null;
}

export function useOrderRush() {
  const queryClient = useQueryClient();
  const { tenant, admin } = useTenantAdminAuth();

  const rushMutation = useMutation<RushOrderResult, Error, RushOrderParams>({
    mutationFn: async ({ orderId, isRush }) => {
      if (!tenant?.id) {
        throw new Error('No tenant context available');
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('orders')
        .update(isRush
          ? { is_rush: true, rushed_at: now, rushed_by: admin?.id }
          : { is_rush: false, rushed_at: null, rushed_by: null }
        )
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (error) {
        throw error;
      }

      return {
        orderId,
        isRush,
        rushedAt: isRush ? now : null,
      };
    },
    onSuccess: ({ isRush }, { orderNumber }) => {
      // Invalidate order queries to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

      const displayId = orderNumber ? `#${orderNumber}` : `Order`;

      if (isRush) {
        toast.success(`${displayId} marked as rush - moved to front of queue`);
        triggerHaptic('light');
      } else {
        toast.success(`${displayId} removed from rush queue`);
        triggerHaptic('light');
      }
    },
    onError: (error, { orderId, isRush }) => {
      logger.error('Failed to update order rush status', error, {
        component: 'useOrderRush',
        orderId,
        isRush,
        tenantId: tenant?.id,
      });

      toast.error(
        isRush
          ? 'Failed to mark order as rush'
          : 'Failed to remove rush status'
      );
      triggerHaptic('heavy');
    },
  });

  const toggleRush = (params: RushOrderParams) => {
    rushMutation.mutate(params);
  };

  const markAsRush = (orderId: string, orderNumber?: string | null) => {
    rushMutation.mutate({ orderId, isRush: true, orderNumber });
  };

  const removeRush = (orderId: string, orderNumber?: string | null) => {
    rushMutation.mutate({ orderId, isRush: false, orderNumber });
  };

  return {
    toggleRush,
    markAsRush,
    removeRush,
    isPending: rushMutation.isPending,
    isSuccess: rushMutation.isSuccess,
    isError: rushMutation.isError,
    error: rushMutation.error,
  };
}

/**
 * useOrderBulkRush - Hook to mark multiple orders as rush at once
 */
export function useOrderBulkRush() {
  const queryClient = useQueryClient();
  const { tenant, admin } = useTenantAdminAuth();

  const bulkRushMutation = useMutation<
    { succeeded: number; failed: number },
    Error,
    { orderIds: string[]; isRush: boolean }
  >({
    mutationFn: async ({ orderIds, isRush }) => {
      if (!tenant?.id) {
        throw new Error('No tenant context available');
      }

      const now = new Date().toISOString();

      const { error, count } = await supabase
        .from('orders')
        .update(isRush
          ? { is_rush: true, rushed_at: now, rushed_by: admin?.id }
          : { is_rush: false, rushed_at: null, rushed_by: null }
        )
        .in('id', orderIds)
        .eq('tenant_id', tenant.id);

      if (error) {
        throw error;
      }

      return {
        succeeded: count ?? orderIds.length,
        failed: 0,
      };
    },
    onSuccess: ({ succeeded }, { isRush }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

      if (isRush) {
        toast.success(`${succeeded} order${succeeded !== 1 ? 's' : ''} marked as rush`);
      } else {
        toast.success(`${succeeded} order${succeeded !== 1 ? 's' : ''} removed from rush`);
      }
      triggerHaptic('light');
    },
    onError: (error, { isRush }) => {
      logger.error('Failed to bulk update order rush status', error, {
        component: 'useOrderBulkRush',
        isRush,
        tenantId: tenant?.id,
      });

      toast.error('Failed to update rush status', { description: humanizeError(error) });
      triggerHaptic('heavy');
    },
  });

  return {
    bulkMarkAsRush: (orderIds: string[]) =>
      bulkRushMutation.mutate({ orderIds, isRush: true }),
    bulkRemoveRush: (orderIds: string[]) =>
      bulkRushMutation.mutate({ orderIds, isRush: false }),
    isPending: bulkRushMutation.isPending,
    isSuccess: bulkRushMutation.isSuccess,
    isError: bulkRushMutation.isError,
  };
}

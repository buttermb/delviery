/**
 * useOrderDuplicate - Hook for duplicating orders
 * Creates a new order based on an existing one, copying customer info,
 * items, and other relevant fields. Resets status to 'pending' and
 * generates a new order number.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';

interface OrderItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  price: number;
}

interface OrderToDuplicate {
  id: string;
  order_number?: string | null;
  user_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string;
  delivery_borough?: string;
  delivery_notes?: string | null;
  delivery_fee?: number;
  payment_method?: string;
  subtotal?: number;
  total_amount?: number;
  tip_amount?: number | null;
  discount_amount?: number | null;
  discount_reason?: string | null;
  special_instructions?: string | null;
  order_type?: string | null;
  requires_id_check?: boolean | null;
  order_items?: OrderItem[];
}

interface DuplicateOrderResult {
  id: string;
  order_number: string;
}

interface UseOrderDuplicateOptions {
  onSuccess?: (result: DuplicateOrderResult) => void;
  onError?: (error: Error) => void;
  navigateToNew?: boolean;
}

export function useOrderDuplicate(options: UseOrderDuplicateOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const navigate = useTenantNavigate();

  const mutation = useMutation({
    mutationFn: async (order: OrderToDuplicate): Promise<DuplicateOrderResult> => {
      if (!tenant?.id) {
        throw new Error('No tenant context available');
      }

      // First, fetch the full order details including items if not provided
      let orderItems = order.order_items;

      if (!orderItems || orderItems.length === 0) {
        const { data: fetchedItems, error: itemsError } = await supabase
          .from('order_items')
          .select('id, product_id, product_name, quantity, price')
          .eq('order_id', order.id);

        if (itemsError) {
          logger.warn('Failed to fetch order items for duplication', {
            error: itemsError.message,
            orderId: order.id,
            component: 'useOrderDuplicate'
          });
        }

        orderItems = fetchedItems ?? [];
      }

      // Create the duplicated order with fresh timestamps and pending status
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: tenant.id,
          user_id: order.user_id || null,
          customer_id: order.customer_id || null,
          customer_name: order.customer_name || null,
          customer_phone: order.customer_phone || null,
          delivery_address: order.delivery_address ?? '',
          delivery_borough: order.delivery_borough ?? '',
          delivery_notes: order.delivery_notes
            ? `[Duplicated from #${order.order_number || order.id.slice(0, 8)}] ${order.delivery_notes}`
            : `[Duplicated from #${order.order_number || order.id.slice(0, 8)}]`,
          delivery_fee: order.delivery_fee ?? 0,
          payment_method: order.payment_method || 'cash',
          subtotal: order.subtotal ?? 0,
          total_amount: order.total_amount ?? 0,
          tip_amount: order.tip_amount || null,
          discount_amount: order.discount_amount || null,
          discount_reason: order.discount_reason || null,
          special_instructions: order.special_instructions || null,
          order_type: order.order_type || 'retail',
          requires_id_check: order.requires_id_check || false,
          status: 'pending',
        })
        .select('id, order_number')
        .maybeSingle();

      if (orderError) {
        logger.error('Failed to create duplicated order', orderError, {
          component: 'useOrderDuplicate',
          originalOrderId: order.id,
        });
        throw new Error(orderError.message);
      }

      if (!newOrder) {
        throw new Error('Failed to create order - no data returned');
      }

      // Duplicate order items if any exist
      if (orderItems && orderItems.length > 0) {
        const newOrderItems = orderItems.map((item) => ({
          order_id: newOrder.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
        }));

        const { error: newItemsError } = await supabase
          .from('order_items')
          .insert(newOrderItems);

        if (newItemsError) {
          logger.warn('Failed to duplicate order items', {
            error: newItemsError.message,
            newOrderId: newOrder.id,
            component: 'useOrderDuplicate',
          });
          // Don't throw - the order was created, just items failed
        }
      }

      return {
        id: newOrder.id,
        order_number: newOrder.order_number || newOrder.id.slice(0, 8),
      };
    },
    onSuccess: (result) => {
      // Invalidate orders queries to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

      toast.success(`Order duplicated successfully`, {
        description: `New order #${result.order_number} created`,
        action: options.navigateToNew !== false ? {
          label: 'View',
          onClick: () => navigate(`orders/${result.id}`),
        } : undefined,
      });

      options.onSuccess?.(result);

      // Optionally navigate to the new order
      if (options.navigateToNew) {
        navigate(`orders/${result.id}`);
      }
    },
    onError: (error: Error) => {
      logger.error('Order duplication failed', error, { component: 'useOrderDuplicate' });
      toast.error('Failed to duplicate order', {
        description: humanizeError(error),
      });
      options.onError?.(error);
    },
  });

  return {
    duplicateOrder: mutation.mutate,
    duplicateOrderAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}

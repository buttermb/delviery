import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { formatCurrency } from '@/lib/formatters';
import { sanitizeTextareaInput } from '@/lib/utils/sanitize';
import type { UnifiedOrder, UnifiedOrderItem } from '@/hooks/useUnifiedOrders';

type OrderWithItems = Pick<
  UnifiedOrder,
  'id' | 'order_number' | 'order_type' | 'status' | 'total_amount' |
  'payment_method' | 'payment_status' | 'subtotal' | 'tax_amount' |
  'discount_amount' | 'tenant_id' | 'created_at'
> & { unified_order_items: UnifiedOrderItem[] };

export interface RefundCompletionData {
  refundAmount: number;
  refundMethod: string;
  originalOrderNumber: string;
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  notes?: string;
}

interface ProcessRefundParams {
  order: OrderWithItems;
  selectedItems: Set<string>;
  refundAmount: number;
  refundMethod: 'cash' | 'original_method';
  notes?: string;
  shiftId?: string;
}

export function useProcessRefund() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      order,
      selectedItems,
      refundAmount,
      refundMethod,
      notes,
      shiftId,
    }: ProcessRefundParams): Promise<RefundCompletionData> => {
      if (!tenantId) throw new Error('Missing tenant ID');

      const orderItems = order.unified_order_items ?? [];
      const refundedItemIds = orderItems
        .filter((item) => selectedItems.has(item.id))
        .map((item) => item.id);

      // Create a negative transaction record (refund) in pos_transactions
      const refundClient = supabase as unknown as {
        from: (table: string) => ReturnType<typeof supabase.from>;
      };

      const resolvedMethod = refundMethod === 'original_method'
        ? (order.payment_method || 'cash')
        : 'cash';

      const { error: refundError } = await refundClient
        .from('pos_transactions')
        .insert({
          tenant_id: tenantId,
          order_id: order.id,
          transaction_type: 'refund',
          amount: -refundAmount,
          payment_method: resolvedMethod,
          shift_id: shiftId || null,
          notes: notes ? sanitizeTextareaInput(notes, 500) : null,
          refunded_items: refundedItemIds,
          created_at: new Date().toISOString(),
        });

      if (refundError) {
        logger.error('POS refund creation failed', refundError, { component: 'useProcessRefund' });
        throw refundError;
      }

      // Restore stock for returned items (increment stock_quantity)
      const itemsToRestore = orderItems.filter((item) => selectedItems.has(item.id));
      for (const item of itemsToRestore) {
        if (!item.product_id) continue;
        try {
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (product) {
            await supabase
              .from('products')
              .update({
                stock_quantity: (product.stock_quantity ?? 0) + item.quantity,
              })
              .eq('id', item.product_id)
              .eq('tenant_id', tenantId);
          }
        } catch (stockErr) {
          logger.error('Stock restore failed for item', stockErr, {
            component: 'useProcessRefund',
            productId: item.product_id,
          });
          // Don't block refund for stock restore failure
        }
      }

      // Update order status if full refund
      if (refundAmount >= order.total_amount) {
        await supabase
          .from('unified_orders')
          .update({ status: 'refunded', payment_status: 'refunded' })
          .eq('id', order.id)
          .eq('tenant_id', tenantId);
      }

      // Return data for onSuccess callback (receipt printing)
      return {
        refundAmount,
        refundMethod: resolvedMethod,
        originalOrderNumber: order.order_number,
        items: itemsToRestore.map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          price: item.unit_price,
          subtotal: item.total_price,
        })),
        notes: notes || undefined,
      };
    },
    onSuccess: (data) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.transactions(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      toast.success('Refund processed', {
        description: `${formatCurrency(data.refundAmount)} refunded for order ${data.originalOrderNumber}`,
      });
    },
    onError: (err) => {
      logger.error('POS refund failed', err, { component: 'useProcessRefund' });
      toast.error('Refund failed', { description: humanizeError(err) });
    },
  });
}

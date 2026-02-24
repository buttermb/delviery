/**
 * useProcessRefund Hook
 *
 * Handles the complete refund lifecycle:
 * 1. Updates payment status to 'refunded'
 * 2. Returns inventory (increments stock) for refunded items
 * 3. Updates order status to 'refunded'
 * 4. Updates customer balance/credit if applicable
 * 5. Fires invalidateOnEvent('REFUND_PROCESSED') to cascade to all panels
 *
 * Wire into: Order detail page, Returns management page, Finance page
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { formatCurrency } from '@/lib/formatters';

// ============================================================================
// TYPES
// ============================================================================

export interface RefundItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface ProcessRefundInput {
  /** The order being refunded */
  order_id: string;
  /** Items to return to inventory (can be partial refund) */
  items: RefundItem[];
  /** Total refund amount */
  refund_amount: number;
  /** Reason for the refund */
  reason: string;
  /** Original payment method for the refund path */
  payment_method?: string;
  /** Customer ID if attached */
  customer_id?: string;
  /** Whether to return items to inventory (default: true) */
  return_to_inventory?: boolean;
  /** Whether this is a full or partial refund */
  refund_type?: 'full' | 'partial';
  /** Optional return authorization ID */
  return_authorization_id?: string;
}

export interface RefundResult {
  success: boolean;
  refund_id?: string;
  order_id: string;
  refund_amount: number;
  items_returned: number;
  error?: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useProcessRefund() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const mutation = useMutation<RefundResult, Error, ProcessRefundInput>({
    mutationFn: async (input: ProcessRefundInput): Promise<RefundResult> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      if (input.refund_amount <= 0) {
        throw new Error('Refund amount must be greater than zero');
      }

      const now = new Date().toISOString();
      const returnToInventory = input.return_to_inventory !== false;

      // Step 1: Update order status to 'refunded'
      const orderStatus = input.refund_type === 'partial' ? 'partial_refund' : 'refunded';
      const paymentStatus = input.refund_type === 'partial' ? 'partial' : 'refunded';

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: orderStatus,
          payment_status: paymentStatus,
          updated_at: now,
        } as Record<string, unknown>)
        .eq('id', input.order_id)
        .eq('tenant_id', tenantId);

      if (orderError) {
        // Try unified_orders table as fallback
        const { error: unifiedError } = await supabase
          .from('unified_orders')
          .update({
            status: orderStatus,
            payment_status: paymentStatus,
            updated_at: now,
          } as Record<string, unknown>)
          .eq('id', input.order_id)
          .eq('tenant_id', tenantId);

        if (unifiedError) {
          logger.error('Failed to update order status for refund', unifiedError, {
            orderId: input.order_id,
            component: 'useProcessRefund',
          });
          throw new Error(`Failed to update order: ${unifiedError.message}`);
        }
      }

      // Step 2: Return inventory if requested
      let itemsReturned = 0;
      if (returnToInventory && input.items.length > 0) {
        for (const item of input.items) {
          // Use increment_stock RPC if available
          const rpcClient = supabase as any;

          const { error: stockError } = await rpcClient.rpc('increment_stock', {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
          });

          if (stockError) {
            logger.warn('Failed to restore stock via RPC, trying direct update', {
              productId: item.product_id,
              error: stockError,
              component: 'useProcessRefund',
            });

            // Fallback: direct stock update
            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .eq('tenant_id', tenantId)
              .maybeSingle();

            if (product) {
              const newStock = (product.stock_quantity ?? 0) + item.quantity;
              await supabase
                .from('products')
                .update({ stock_quantity: newStock, updated_at: now })
                .eq('id', item.product_id)
                .eq('tenant_id', tenantId);
            }
          }

          itemsReturned += item.quantity;
        }
      }

      // Step 3: Create refund/payment record
      // Try inserting into payments table
      const refundRecord = {
        tenant_id: tenantId,
        order_id: input.order_id,
        amount: -input.refund_amount,
        payment_method: input.payment_method || 'store_credit',
        status: 'completed',
        notes: `Refund: ${input.reason}`,
        created_at: now,
      };

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(refundRecord as Record<string, unknown>);

      if (paymentError && paymentError.code !== '42P01') {
        // Not a missing table error - log but don't fail
        logger.warn('Could not create refund payment record', {
          error: paymentError,
          component: 'useProcessRefund',
        });
      }

      // Step 4: Update customer balance/credit if customer is attached
      if (input.customer_id) {
        const rpcClient = supabase as any;

        // Add credit to customer if refund method is store credit
        if (input.payment_method === 'store_credit') {
          const { error: creditError } = await rpcClient.rpc('adjust_customer_balance', {
            p_customer_id: input.customer_id,
            p_amount: input.refund_amount,
            p_operation: 'add',
          });

          if (creditError) {
            logger.warn('Could not adjust customer balance for refund', {
              customerId: input.customer_id,
              error: creditError,
              component: 'useProcessRefund',
            });
          }
        }
      }

      // Step 5: Update return authorization status if linked
      if (input.return_authorization_id) {
        await supabase
          .from('returns')
          .update({
            status: 'refunded',
            processed_at: now,
            refund_amount: input.refund_amount,
            updated_at: now,
          } as Record<string, unknown>)
          .eq('id', input.return_authorization_id)
          .eq('tenant_id', tenantId);
      }

      return {
        success: true,
        order_id: input.order_id,
        refund_amount: input.refund_amount,
        items_returned: itemsReturned,
      };
    },

    onSuccess: (result, input) => {
      logger.info('Refund processed successfully', {
        orderId: result.order_id,
        refundAmount: result.refund_amount,
        itemsReturned: result.items_returned,
        component: 'useProcessRefund',
      });

      toast.success('Refund processed', {
        description: `${formatCurrency(result.refund_amount)} refunded${result.items_returned > 0 ? `, ${result.items_returned} items returned to inventory` : ''}`,
      });

      // Fire REFUND_PROCESSED event for full cross-panel cascade
      // This invalidates: finance, payments, orders, returns, inventory, products,
      // stock alerts, customers, dashboard, analytics
      if (tenantId) {
        invalidateOnEvent(queryClient, 'REFUND_PROCESSED', tenantId, {
          orderId: input.order_id,
          customerId: input.customer_id || undefined,
        });

        // Also fire ORDER_STATUS_CHANGED since the order status was updated
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenantId, {
          orderId: input.order_id,
          customerId: input.customer_id || undefined,
        });

        // And INVENTORY_ADJUSTED if items were returned
        if (input.return_to_inventory !== false && input.items.length > 0) {
          invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenantId);
        }
      }

      // Customer-specific invalidation
      if (input.customer_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.details(),
        });
      }

      // Return authorization invalidation
      if (input.return_authorization_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.returns.all });
      }

      // Activity feed
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });
    },

    onError: (error: Error, input) => {
      logger.error('Refund processing failed', error, {
        orderId: input.order_id,
        refundAmount: input.refund_amount,
        component: 'useProcessRefund',
      });

      toast.error('Refund failed', {
        description: humanizeError(error),
      });
    },
  });

  return {
    processRefund: mutation.mutateAsync,
    processRefundSync: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    lastResult: mutation.data,
    reset: mutation.reset,
  };
}

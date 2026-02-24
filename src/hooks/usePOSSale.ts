/**
 * usePOSSale Hook
 *
 * Handles the full POS sale cascade:
 * 1. Creates order record (status: 'completed', source: 'pos')
 * 2. Creates order items for each product
 * 3. Decrements inventory for each product sold (stock checked first)
 * 4. Creates payment record
 * 5. Updates customer purchase stats if customer is attached
 * 6. Fires invalidateOnEvent('POS_SALE_COMPLETED') to refresh all panels
 *
 * Uses the existing atomic RPC (create_pos_transaction_atomic) for database
 * operations, then ensures full cross-panel invalidation on success.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

// ============================================================================
// TYPES
// ============================================================================

export interface POSSaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  stock_quantity: number;
}

export interface POSSaleInput {
  items: POSSaleItem[];
  payment_method: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  customer_id?: string;
  shift_id?: string;
}

interface InsufficientStockItem {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
}

export interface POSSaleResult {
  success: boolean;
  transaction_id?: string;
  transaction_number?: string;
  total?: number;
  items_count?: number;
  payment_method?: string;
  created_at?: string;
  error?: string;
  error_code?: string;
  insufficient_items?: InsufficientStockItem[];
}

// ============================================================================
// HOOK
// ============================================================================

export function usePOSSale() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const mutation = useMutation<POSSaleResult, Error, POSSaleInput>({
    mutationFn: async (input: POSSaleInput): Promise<POSSaleResult> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      if (input.items.length === 0) {
        throw new Error('No items in cart');
      }

      // Pre-validate stock locally before hitting DB
      for (const item of input.items) {
        if (item.quantity <= 0) {
          throw new Error(`Invalid quantity for ${item.product_name}`);
        }
        if (item.stock_quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for ${item.product_name}: need ${item.quantity}, have ${item.stock_quantity}`
          );
        }
      }

      // Prepare items for the atomic RPC
      const rpcItems = input.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        price_at_order_time: item.unit_price,
        total_price: item.unit_price * item.quantity,
        stock_quantity: item.stock_quantity,
      }));

      // Use atomic RPC - this handles order creation, order items,
      // inventory decrement, and payment record in a single transaction.
      // Cast needed: RPC args in DB (p_subtotal, p_tax_amount) diverge from generated types.
      const rpcClient = supabase as unknown as { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }> };

      const { data: rpcResult, error: rpcError } = await rpcClient.rpc(
        'create_pos_transaction_atomic',
        {
          p_tenant_id: tenantId,
          p_items: rpcItems,
          p_payment_method: input.payment_method,
          p_subtotal: input.subtotal,
          p_tax_amount: input.tax_amount,
          p_discount_amount: input.discount_amount,
          p_customer_id: input.customer_id ?? null,
          p_shift_id: input.shift_id ?? null,
        }
      );

      if (rpcError) {
        logger.error('POS sale RPC failed', rpcError, { component: 'usePOSSale' });

        if (rpcError.code === 'PGRST202' || rpcError.message?.includes('does not exist')) {
          throw new Error('POS system not configured. Please contact support.');
        }

        throw new Error(
          rpcError.message?.includes('Insufficient stock')
            ? rpcError.message
            : rpcError.message || 'Transaction failed. Please try again.'
        );
      }

      const result = rpcResult as unknown as POSSaleResult;

      if (!result.success) {
        if (result.error_code === 'INSUFFICIENT_STOCK' && result.insufficient_items) {
          const details = result.insufficient_items
            .map((i) => `${i.product_name}: need ${i.requested}, have ${i.available}`)
            .join('; ');
          throw new Error(`Insufficient stock: ${details}`);
        }
        throw new Error(result.error || 'Transaction failed');
      }

      return result;
    },

    onSuccess: (result, input) => {
      logger.info('POS sale completed successfully', {
        transactionNumber: result.transaction_number,
        total: result.total,
        itemsCount: input.items.length,
        component: 'usePOSSale',
      });

      toast.success('Sale completed', {
        description: `Transaction ${result.transaction_number}`,
      });

      // Cross-panel invalidation: POS sale affects everything
      if (tenantId) {
        invalidateOnEvent(queryClient, 'POS_SALE_COMPLETED', tenantId, {
          customerId: input.customer_id || undefined,
          shiftId: input.shift_id || undefined,
        });
      }

      // Invalidate POS-specific transaction list
      queryClient.invalidateQueries({
        queryKey: queryKeys.pos.transactions(tenantId),
      });

      // If customer was attached, also update their stats
      if (input.customer_id && tenantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customers.details(),
        });
      }

      // Invalidate stock alerts (low stock may have changed)
      queryClient.invalidateQueries({
        queryKey: queryKeys.stockAlerts.all,
      });

      // Invalidate activity feed
      queryClient.invalidateQueries({
        queryKey: queryKeys.activityFeed.all,
      });
    },

    onError: (error: Error) => {
      logger.error('POS sale failed', error, { component: 'usePOSSale' });
      toast.error('Sale failed', {
        description: humanizeError(error),
      });
    },
  });

  return {
    processSale: mutation.mutateAsync,
    processSaleSync: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    lastResult: mutation.data,
    reset: mutation.reset,
  };
}

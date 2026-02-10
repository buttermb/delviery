import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface InventoryCheckResult {
    available: boolean;
    currentStock: number;
    requestedQuantity: number;
    productId: string;
}

export const availabilityService = {
    /**
     * Check if a product has enough stock for the requested quantity
     */
    async checkProductAvailability(
        productId: string,
        requestedQty: number
    ): Promise<InventoryCheckResult> {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', productId)
                .single();

            if (error) throw error;

            const currentStock = data?.stock_quantity || 0;

            return {
                available: currentStock >= requestedQty,
                currentStock,
                requestedQuantity: requestedQty,
                productId,
            };
        } catch (error) {
            logger.error('Error checking product availability', error);
            throw error;
        }
    },

    /**
     * Reserve inventory for a disposable menu order
     * This decrements the stock immediately to prevent overselling
     */
    async reserveInventory(
        orderId: string,
        items: Array<{ product_id: string; quantity: number }>
    ): Promise<void> {
        try {
            // We'll use a stored procedure or a series of updates
            // For now, we'll iterate and update (optimistic locking would be better in a real high-concurrency scenario)

            for (const item of items) {
                // @ts-expect-error - RPC function not in types
                const { error } = await supabase.rpc('decrement_stock', {
                    p_product_id: item.product_id,
                    p_quantity: item.quantity
                });

                if (error) throw error;

                // Log the sync
                // @ts-expect-error - Table not in types
                await supabase.from('inventory_sync_log').insert({
                    product_id: item.product_id,
                    change_amount: -item.quantity,
                    change_source: 'disposable_order',
                    // tenant_id will be handled by RLS or trigger if possible, but better to pass it if we have context
                    // For now assuming the RPC or trigger handles it or we add it if we have context
                });
            }
        } catch (error) {
            logger.error('Error reserving inventory', error);
            throw error;
        }
    },

    /**
     * Release inventory (e.g. if an order is cancelled)
     */
    async releaseInventory(
        orderId: string,
        items: Array<{ product_id: string; quantity: number }>
    ): Promise<void> {
        try {
            for (const item of items) {
                // @ts-expect-error - RPC function not in types
                const { error } = await supabase.rpc('increment_stock', {
                    p_product_id: item.product_id,
                    p_quantity: item.quantity
                });

                if (error) throw error;

                // @ts-expect-error - Table not in types
                await supabase.from('inventory_sync_log').insert({
                    product_id: item.product_id,
                    change_amount: item.quantity,
                    change_source: 'system_sync', // or 'cancellation'
                });
            }
        } catch (error) {
            logger.error('Error releasing inventory', error);
            throw error;
        }
    }
};

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
        requestedQty: number,
        tenantId?: string
    ): Promise<InventoryCheckResult> {
        try {
            let query = supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', productId);

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            const { data, error } = await query.maybeSingle();

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
        items: Array<{ product_id: string; quantity: number }>,
        tenantId?: string
    ): Promise<void> {
        try {
            for (const item of items) {
                const { error } = await supabase.rpc('decrement_stock', {
                    p_product_id: item.product_id,
                    p_quantity: item.quantity
                });

                if (error) throw error;

                // Log the sync
                const insertData: Record<string, unknown> = {
                    product_id: item.product_id,
                    change_amount: -item.quantity,
                    change_source: 'disposable_order',
                };
                if (tenantId) {
                    insertData.tenant_id = tenantId;
                }
                await supabase.from('inventory_sync_log').insert(insertData);
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
        items: Array<{ product_id: string; quantity: number }>,
        tenantId?: string
    ): Promise<void> {
        try {
            for (const item of items) {
                const { error } = await supabase.rpc('increment_stock', {
                    p_product_id: item.product_id,
                    p_quantity: item.quantity
                });

                if (error) throw error;

                const insertData: Record<string, unknown> = {
                    product_id: item.product_id,
                    change_amount: item.quantity,
                    change_source: 'system_sync',
                };
                if (tenantId) {
                    insertData.tenant_id = tenantId;
                }
                await supabase.from('inventory_sync_log').insert(insertData);
            }
        } catch (error) {
            logger.error('Error releasing inventory', error);
            throw error;
        }
    }
};

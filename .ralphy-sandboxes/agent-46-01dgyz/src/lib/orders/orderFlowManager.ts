import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type OrderStatus = 'pending' | 'ready_for_pickup' | 'in_pos' | 'completed' | 'cancelled';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    'pending': ['ready_for_pickup', 'cancelled'],
    'ready_for_pickup': ['in_pos', 'cancelled'],
    'in_pos': ['completed', 'ready_for_pickup', 'cancelled'], // ready_for_pickup allowed if removed from POS cart
    'completed': [],
    'cancelled': []
};

export const orderFlowManager = {
    /**
     * Check if a status transition is valid
     */
    canTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
        return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
    },

    /**
     * Transition an order to a new status
     */
    async transitionOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
        try {
            // Fetch current status
            // @ts-expect-error - Outdated Supabase types
            const { data: order, error: fetchError } = await supabase
                // @ts-expect-error - Table not in types
                .from('disposable_menu_orders')
                .select('status')
                .eq('id', orderId)
                .single();

            if (fetchError) throw fetchError;
            // @ts-expect-error - Outdated types
            const currentStatus = order.status as OrderStatus;

            if (!this.canTransition(currentStatus, newStatus)) {
                throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
            }

            // Update status
            // @ts-expect-error - Outdated Supabase types
            const { error: updateError } = await supabase
                // @ts-expect-error - Table not in types
                .from('disposable_menu_orders')
                .update({
                    status: newStatus,
                    completed_at: newStatus === 'completed' ? new Date().toISOString() : null
                })
                .eq('id', orderId);

            if (updateError) throw updateError;

            logger.info(`Order ${orderId} transitioned to ${newStatus}`);
        } catch (error) {
            logger.error('Error transitioning order status', error);
            throw error;
        }
    }
};

import { logger } from '@/lib/logger';

export interface DisposableMenuOrder {
    id: string;
    items: Array<{
        product_id: string;
        quantity: number;
        price: number;
        name: string;
    }>;
    customer_id?: string;
    subtotal: number;
    tax: number;
    total_amount: number;
}

export interface POSCartItem {
    id: string; // product_id
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
}

export const orderConverter = {
    /**
     * Convert a disposable menu order to POS cart items
     */
    convertDisposableMenuToPOS(order: DisposableMenuOrder): POSCartItem[] {
        try {
            return order.items.map(item => ({
                id: item.product_id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.price * item.quantity
            }));
        } catch (error) {
            logger.error('Error converting order to POS cart', error);
            return [];
        }
    },

    /**
     * Calculate totals for validation
     */
    calculateTotals(items: POSCartItem[]) {
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        // Tax calculation would go here, simplified for now
        const tax = subtotal * 0.0;
        const total = subtotal + tax;

        return { subtotal, tax, total };
    }
};

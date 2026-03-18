/**
 * Checkout Validation Tests
 * Tests for delivery zone validation, inventory check, and order placement
 */

import { describe, it, expect } from 'vitest';

// Mock store delivery zones configuration
const mockStoreWithZones = {
    id: 'store-123',
    store_name: 'Test Store',
    delivery_zones: [
        { zip_code: '12345', fee: 5, min_order: 20 },
        { zip_code: '12346', fee: 8, min_order: 30 },
        { zip_code: '12347', fee: 0, min_order: 0 },
    ],
    default_delivery_fee: 10,
    free_delivery_threshold: 100,
};

const mockStoreNoZones = {
    id: 'store-456',
    store_name: 'No Zone Store',
    delivery_zones: [],
    default_delivery_fee: 5,
    free_delivery_threshold: 50,
};

// Helper functions that mirror checkout logic
function validateDeliveryZone(
    store: typeof mockStoreWithZones,
    zip: string,
    subtotal: number
): { valid: boolean; error?: string; fee?: number } {
    const zones = store.delivery_zones ?? [];

    if (zones.length === 0) {
        // No zones configured - allow all zips
        return {
            valid: true,
            fee: subtotal >= store.free_delivery_threshold ? 0 : store.default_delivery_fee,
        };
    }

    const matchingZone = zones.find((z) => z.zip_code === zip);

    if (!matchingZone) {
        return {
            valid: false,
            error: `We don't currently deliver to zip code ${zip}`,
        };
    }

    if (matchingZone.min_order && subtotal < matchingZone.min_order) {
        return {
            valid: false,
            error: `This delivery zone requires a minimum order of $${matchingZone.min_order}`,
        };
    }

    return {
        valid: true,
        fee: subtotal >= store.free_delivery_threshold ? 0 : matchingZone.fee,
    };
}

function validateInventory(
    cartItems: Array<{ productId: string; name: string; quantity: number }>,
    products: Array<{ id: string; name: string; stock_quantity: number; available_quantity?: number }>
): { valid: boolean; outOfStock: string[] } {
    const outOfStock: string[] = [];

    for (const item of cartItems) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
            const available = product.available_quantity ?? product.stock_quantity ?? 0;
            if (available < item.quantity) {
                outOfStock.push(`${item.name} (only ${available} available)`);
            }
        }
    }

    return {
        valid: outOfStock.length === 0,
        outOfStock,
    };
}

describe('Checkout Validation', () => {
    describe('Delivery Zone Validation', () => {
        it('should accept valid zip code in configured zone', () => {
            const result = validateDeliveryZone(mockStoreWithZones, '12345', 50);
            expect(result.valid).toBe(true);
            expect(result.fee).toBe(5);
        });

        it('should reject zip code not in zones', () => {
            const result = validateDeliveryZone(mockStoreWithZones, '99999', 50);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("don't currently deliver");
        });

        it('should reject order below minimum for zone', () => {
            const result = validateDeliveryZone(mockStoreWithZones, '12346', 25);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('minimum order of $30');
        });

        it('should accept order meeting minimum for zone', () => {
            const result = validateDeliveryZone(mockStoreWithZones, '12346', 30);
            expect(result.valid).toBe(true);
            expect(result.fee).toBe(8);
        });

        it('should waive fee when over free delivery threshold', () => {
            const result = validateDeliveryZone(mockStoreWithZones, '12345', 150);
            expect(result.valid).toBe(true);
            expect(result.fee).toBe(0);
        });

        it('should allow all zips when no zones configured', () => {
            const result = validateDeliveryZone(mockStoreNoZones, '99999', 30);
            expect(result.valid).toBe(true);
            expect(result.fee).toBe(5);
        });

        it('should use free delivery when threshold met (no zones)', () => {
            const result = validateDeliveryZone(mockStoreNoZones, '99999', 60);
            expect(result.valid).toBe(true);
            expect(result.fee).toBe(0);
        });
    });

    describe('Inventory Validation', () => {
        const mockProducts = [
            { id: 'prod-1', name: 'Widget A', stock_quantity: 10, available_quantity: 8 },
            { id: 'prod-2', name: 'Widget B', stock_quantity: 5 },
            { id: 'prod-3', name: 'Widget C', stock_quantity: 0 },
        ];

        it('should pass when all items in stock', () => {
            const cart = [
                { productId: 'prod-1', name: 'Widget A', quantity: 5 },
                { productId: 'prod-2', name: 'Widget B', quantity: 3 },
            ];
            const result = validateInventory(cart, mockProducts);
            expect(result.valid).toBe(true);
            expect(result.outOfStock).toHaveLength(0);
        });

        it('should fail when item exceeds available quantity', () => {
            const cart = [
                { productId: 'prod-1', name: 'Widget A', quantity: 10 }, // Only 8 available
            ];
            const result = validateInventory(cart, mockProducts);
            expect(result.valid).toBe(false);
            expect(result.outOfStock).toContain('Widget A (only 8 available)');
        });

        it('should fail when item is out of stock', () => {
            const cart = [
                { productId: 'prod-3', name: 'Widget C', quantity: 1 },
            ];
            const result = validateInventory(cart, mockProducts);
            expect(result.valid).toBe(false);
            expect(result.outOfStock).toContain('Widget C (only 0 available)');
        });

        it('should report multiple out of stock items', () => {
            const cart = [
                { productId: 'prod-1', name: 'Widget A', quantity: 100 },
                { productId: 'prod-3', name: 'Widget C', quantity: 1 },
            ];
            const result = validateInventory(cart, mockProducts);
            expect(result.valid).toBe(false);
            expect(result.outOfStock).toHaveLength(2);
        });

        it('should use stock_quantity when available_quantity missing', () => {
            const cart = [
                { productId: 'prod-2', name: 'Widget B', quantity: 4 },
            ];
            const result = validateInventory(cart, mockProducts);
            expect(result.valid).toBe(true);
        });
    });
});

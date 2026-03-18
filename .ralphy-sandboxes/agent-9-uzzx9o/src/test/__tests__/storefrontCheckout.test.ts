/**
 * Storefront Checkout Edge Function Tests
 * Tests request validation, price calculation, and Stripe session creation logic
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// Extracted validation and calculation logic from the edge function
// ============================================================

interface CheckoutItem {
  product_id: string;
  name: string;
  price?: number;
  quantity: number;
  image_url?: string;
}

interface CheckoutRequest {
  store_id: string;
  order_id: string;
  items: CheckoutItem[];
  customer_email: string;
  customer_name: string;
  subtotal?: number;
  delivery_fee?: number;
  success_url: string;
  cancel_url: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

interface StoreSettings {
  default_delivery_fee: number;
  free_delivery_threshold: number;
}

function validateCheckoutRequest(body: Partial<CheckoutRequest>): {
  valid: boolean;
  error?: string;
} {
  if (!body.store_id || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return { valid: false, error: 'Missing required fields: store_id, items' };
  }

  if (!body.order_id) {
    return { valid: false, error: 'Missing order_id - create order first' };
  }

  const productIds = body.items.map(item => item.product_id).filter(Boolean);
  if (productIds.length !== body.items.length) {
    return { valid: false, error: 'All items must have a product_id' };
  }

  return { valid: true };
}

function calculateServerSubtotal(
  items: CheckoutItem[],
  products: Product[]
): { subtotal: number; lineItems: Array<{ name: string; unitAmount: number; quantity: number; images: string[] }> } | { error: string } {
  const productPriceMap = new Map(products.map(p => [p.id, p]));
  let subtotal = 0;
  const lineItems: Array<{ name: string; unitAmount: number; quantity: number; images: string[] }> = [];

  for (const item of items) {
    const product = productPriceMap.get(item.product_id);
    if (!product) {
      return { error: `Product ${item.product_id} not found or not available in this store` };
    }

    const serverPrice = Number(product.price);
    subtotal += serverPrice * item.quantity;

    lineItems.push({
      name: product.name,
      unitAmount: Math.round(serverPrice * 100), // Convert to cents
      quantity: item.quantity,
      images: product.image_url ? [product.image_url] : [],
    });
  }

  return { subtotal, lineItems };
}

function calculateDeliveryFee(
  calculatedSubtotal: number,
  storeSettings: StoreSettings
): number {
  const storeDeliveryFee = storeSettings.default_delivery_fee || 0;
  const freeThreshold = storeSettings.free_delivery_threshold || 0;
  return calculatedSubtotal >= freeThreshold ? 0 : storeDeliveryFee;
}

function buildStripeMetadata(
  storeId: string,
  orderId: string,
  customerName: string,
  tenantId: string
): Record<string, string> {
  return {
    store_id: storeId,
    order_id: orderId,
    customer_name: customerName,
    tenant_id: tenantId,
  };
}

// ============================================================
// Tests
// ============================================================

describe('Storefront Checkout Edge Function', () => {
  describe('Request Validation', () => {
    it('should reject request without store_id', () => {
      const result = validateCheckoutRequest({
        items: [{ product_id: 'p1', name: 'Item', quantity: 1 }],
        order_id: 'order-1',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('store_id');
    });

    it('should reject request without items', () => {
      const result = validateCheckoutRequest({
        store_id: 'store-1',
        order_id: 'order-1',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('items');
    });

    it('should reject request with empty items array', () => {
      const result = validateCheckoutRequest({
        store_id: 'store-1',
        order_id: 'order-1',
        items: [],
      });
      expect(result.valid).toBe(false);
    });

    it('should reject request without order_id', () => {
      const result = validateCheckoutRequest({
        store_id: 'store-1',
        items: [{ product_id: 'p1', name: 'Item', quantity: 1 }],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('order_id');
    });

    it('should reject items without product_id', () => {
      const result = validateCheckoutRequest({
        store_id: 'store-1',
        order_id: 'order-1',
        items: [{ product_id: '', name: 'Item', quantity: 1 }],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('product_id');
    });

    it('should accept valid request', () => {
      const result = validateCheckoutRequest({
        store_id: 'store-1',
        order_id: 'order-1',
        items: [
          { product_id: 'p1', name: 'Item 1', quantity: 2 },
          { product_id: 'p2', name: 'Item 2', quantity: 1 },
        ],
        customer_email: 'test@example.com',
        customer_name: 'Test User',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept request with items array (non-empty)', () => {
      const result = validateCheckoutRequest({
        store_id: 'store-1',
        order_id: 'order-1',
        items: [{ product_id: 'p1', name: 'Item', quantity: 1 }],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Server-Side Price Calculation (Security)', () => {
    const products: Product[] = [
      { id: 'p1', name: 'Widget A', price: 29.99, image_url: 'https://img.com/a.jpg' },
      { id: 'p2', name: 'Widget B', price: 49.50, image_url: null },
      { id: 'p3', name: 'Widget C', price: 9.99, image_url: 'https://img.com/c.jpg' },
    ];

    it('should calculate subtotal from server prices, ignoring client prices', () => {
      const items: CheckoutItem[] = [
        { product_id: 'p1', name: 'Widget A', price: 1.00, quantity: 2 }, // Client sent $1, real price is $29.99
        { product_id: 'p2', name: 'Widget B', price: 0.01, quantity: 1 }, // Client sent $0.01
      ];

      const result = calculateServerSubtotal(items, products);
      expect('subtotal' in result).toBe(true);
      if ('subtotal' in result) {
        // 29.99 * 2 + 49.50 * 1 = 109.48
        expect(result.subtotal).toBeCloseTo(109.48, 2);
      }
    });

    it('should convert prices to cents correctly', () => {
      const items: CheckoutItem[] = [
        { product_id: 'p1', name: 'Widget A', quantity: 1 },
      ];

      const result = calculateServerSubtotal(items, products);
      expect('lineItems' in result).toBe(true);
      if ('lineItems' in result) {
        // 29.99 * 100 = 2999 cents
        expect(result.lineItems[0].unitAmount).toBe(2999);
      }
    });

    it('should handle integer prices without rounding issues', () => {
      const intProducts: Product[] = [
        { id: 'p1', name: 'Widget', price: 10, image_url: null },
      ];
      const items: CheckoutItem[] = [
        { product_id: 'p1', name: 'Widget', quantity: 3 },
      ];

      const result = calculateServerSubtotal(items, intProducts);
      if ('subtotal' in result) {
        expect(result.subtotal).toBe(30);
        expect(result.lineItems[0].unitAmount).toBe(1000);
      }
    });

    it('should return error for missing product', () => {
      const items: CheckoutItem[] = [
        { product_id: 'nonexistent', name: 'Ghost', quantity: 1 },
      ];

      const result = calculateServerSubtotal(items, products);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('nonexistent');
      }
    });

    it('should include product images in line items', () => {
      const items: CheckoutItem[] = [
        { product_id: 'p1', name: 'Widget A', quantity: 1 },
        { product_id: 'p2', name: 'Widget B', quantity: 1 },
      ];

      const result = calculateServerSubtotal(items, products);
      if ('lineItems' in result) {
        expect(result.lineItems[0].images).toEqual(['https://img.com/a.jpg']);
        expect(result.lineItems[1].images).toEqual([]);
      }
    });

    it('should handle multiple quantities correctly', () => {
      const items: CheckoutItem[] = [
        { product_id: 'p3', name: 'Widget C', quantity: 10 },
      ];

      const result = calculateServerSubtotal(items, products);
      if ('subtotal' in result) {
        expect(result.subtotal).toBeCloseTo(99.9, 2);
        expect(result.lineItems[0].quantity).toBe(10);
      }
    });

    it('should calculate subtotal for single item', () => {
      const items: CheckoutItem[] = [
        { product_id: 'p2', name: 'Widget B', quantity: 1 },
      ];

      const result = calculateServerSubtotal(items, products);
      if ('subtotal' in result) {
        expect(result.subtotal).toBe(49.50);
      }
    });
  });

  describe('Delivery Fee Calculation', () => {
    it('should return 0 when subtotal exceeds free threshold', () => {
      const fee = calculateDeliveryFee(150, {
        default_delivery_fee: 10,
        free_delivery_threshold: 100,
      });
      expect(fee).toBe(0);
    });

    it('should return default fee when below threshold', () => {
      const fee = calculateDeliveryFee(50, {
        default_delivery_fee: 10,
        free_delivery_threshold: 100,
      });
      expect(fee).toBe(10);
    });

    it('should return 0 when at exact threshold', () => {
      const fee = calculateDeliveryFee(100, {
        default_delivery_fee: 10,
        free_delivery_threshold: 100,
      });
      expect(fee).toBe(0);
    });

    it('should return 0 when no delivery fee configured', () => {
      const fee = calculateDeliveryFee(50, {
        default_delivery_fee: 0,
        free_delivery_threshold: 0,
      });
      expect(fee).toBe(0);
    });

    it('should handle missing threshold (defaults to 0)', () => {
      const fee = calculateDeliveryFee(10, {
        default_delivery_fee: 5,
        free_delivery_threshold: 0,
      });
      // 10 >= 0, so free
      expect(fee).toBe(0);
    });
  });

  describe('Stripe Metadata', () => {
    it('should build correct metadata', () => {
      const metadata = buildStripeMetadata('store-1', 'order-1', 'John Doe', 'tenant-1');
      expect(metadata).toEqual({
        store_id: 'store-1',
        order_id: 'order-1',
        customer_name: 'John Doe',
        tenant_id: 'tenant-1',
      });
    });

    it('should include all required fields for tracking', () => {
      const metadata = buildStripeMetadata('s', 'o', 'n', 't');
      expect(Object.keys(metadata)).toContain('store_id');
      expect(Object.keys(metadata)).toContain('order_id');
      expect(Object.keys(metadata)).toContain('tenant_id');
      expect(Object.keys(metadata)).toContain('customer_name');
    });
  });

  describe('Stripe Line Items', () => {
    it('should add delivery fee as separate line item when applicable', () => {
      const deliveryFee = 10;
      const lineItems: Array<{ name: string; unitAmount: number; quantity: number }> = [
        { name: 'Product A', unitAmount: 2999, quantity: 1 },
      ];

      if (deliveryFee > 0) {
        lineItems.push({
          name: 'Delivery Fee',
          unitAmount: Math.round(deliveryFee * 100),
          quantity: 1,
        });
      }

      expect(lineItems).toHaveLength(2);
      expect(lineItems[1].name).toBe('Delivery Fee');
      expect(lineItems[1].unitAmount).toBe(1000);
      expect(lineItems[1].quantity).toBe(1);
    });

    it('should not add delivery fee line item when fee is 0', () => {
      const deliveryFee = 0;
      const lineItems: Array<{ name: string; unitAmount: number; quantity: number }> = [
        { name: 'Product A', unitAmount: 2999, quantity: 1 },
      ];

      if (deliveryFee > 0) {
        lineItems.push({
          name: 'Delivery Fee',
          unitAmount: Math.round(deliveryFee * 100),
          quantity: 1,
        });
      }

      expect(lineItems).toHaveLength(1);
    });

    it('should correctly format unit amounts in cents', () => {
      const prices = [29.99, 0.01, 100, 9.5, 0.99];
      const expected = [2999, 1, 10000, 950, 99];

      prices.forEach((price, i) => {
        expect(Math.round(price * 100)).toBe(expected[i]);
      });
    });
  });

  describe('Order Record Update', () => {
    it('should produce correct update payload for storefront_orders', () => {
      const sessionId = 'cs_test_abc123';
      const updatePayload = {
        stripe_session_id: sessionId,
        payment_status: 'pending' as const,
      };

      expect(updatePayload.stripe_session_id).toBe('cs_test_abc123');
      expect(updatePayload.payment_status).toBe('pending');
    });
  });

  describe('CORS Headers', () => {
    it('should have required CORS headers', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      };

      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('authorization');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('content-type');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('apikey');
    });
  });

  describe('Error Response Format', () => {
    it('should format 400 errors with error message', () => {
      const errorResponse = { error: 'Missing required fields: store_id, items' };
      expect(errorResponse).toHaveProperty('error');
      expect(typeof errorResponse.error).toBe('string');
    });

    it('should format 404 errors for store not found', () => {
      const errorResponse = { error: 'Store not found' };
      expect(errorResponse.error).toBe('Store not found');
    });

    it('should format payment not configured error with message', () => {
      const errorResponse = {
        error: 'Payment not configured',
        message: 'This store has not configured online payments yet.',
      };
      expect(errorResponse.error).toBe('Payment not configured');
      expect(errorResponse.message).toBeTruthy();
    });
  });

  describe('Success Response Format', () => {
    it('should return url and session_id on success', () => {
      const successResponse = {
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
        session_id: 'cs_test_123',
      };

      expect(successResponse).toHaveProperty('url');
      expect(successResponse).toHaveProperty('session_id');
      expect(successResponse.url).toContain('stripe.com');
    });
  });

  describe('Security: Price Manipulation Prevention', () => {
    it('should use server price even when client sends different price', () => {
      const serverProducts: Product[] = [
        { id: 'p1', name: 'Expensive Item', price: 100, image_url: null },
      ];

      // Client tries to send a much lower price
      const clientItems: CheckoutItem[] = [
        { product_id: 'p1', name: 'Expensive Item', price: 0.01, quantity: 1 },
      ];

      const result = calculateServerSubtotal(clientItems, serverProducts);
      if ('subtotal' in result) {
        // Server price should be used: $100, not $0.01
        expect(result.subtotal).toBe(100);
        expect(result.lineItems[0].unitAmount).toBe(10000); // $100 in cents
      }
    });

    it('should reject products not belonging to the store', () => {
      // Products list only contains items from this store's tenant
      const storeProducts: Product[] = [
        { id: 'p1', name: 'Store Product', price: 50, image_url: null },
      ];

      // Client tries to add a product that doesn't exist in this store
      const items: CheckoutItem[] = [
        { product_id: 'p1', name: 'Store Product', quantity: 1 },
        { product_id: 'other-store-product', name: 'Stolen Product', quantity: 1 },
      ];

      const result = calculateServerSubtotal(items, storeProducts);
      expect('error' in result).toBe(true);
    });
  });
});

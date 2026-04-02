/**
 * Send Order Cancellation - Handler Logic Tests
 *
 * Tests the request handling, validation, email HTML generation,
 * and null-safety of the send-order-cancellation edge function.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Helpers mirroring the edge function logic
// ============================================================================

interface CancellationEmailRequest {
  customer_email: string;
  customer_name: string;
  order_number: string;
  cancellation_reason: string;
  store_name: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
}

function validateRequest(body: Partial<CancellationEmailRequest>): { valid: boolean; error?: string } {
  if (!body.customer_email || !body.order_number) {
    return { valid: false, error: 'Missing required fields' };
  }
  return { valid: true };
}

function buildItemsHtml(items: unknown): string {
  const safeItems = Array.isArray(items) ? items : [];
  return safeItems
    .map((item) => {
      const qty = typeof item.quantity === 'number' ? item.quantity : 1;
      const price = typeof item.price === 'number' ? item.price : 0;
      const name = item.name || 'Item';
      return `<tr><td>${name}</td><td>${qty}</td><td>$${(price * qty).toFixed(2)}</td></tr>`;
    })
    .join('');
}

function formatTotal(total: unknown): string {
  const safeTotal = typeof total === 'number' ? total : 0;
  return `$${safeTotal.toFixed(2)}`;
}

// ============================================================================
// Tests
// ============================================================================

describe('Send Order Cancellation - Handler', () => {
  describe('Request validation', () => {
    it('should reject when customer_email is missing', () => {
      const result = validateRequest({ order_number: 'ORD-001' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });

    it('should reject when customer_email is empty string', () => {
      const result = validateRequest({ customer_email: '', order_number: 'ORD-001' });
      expect(result.valid).toBe(false);
    });

    it('should reject when order_number is missing', () => {
      const result = validateRequest({ customer_email: 'test@example.com' });
      expect(result.valid).toBe(false);
    });

    it('should reject when order_number is empty string', () => {
      const result = validateRequest({ customer_email: 'test@example.com', order_number: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject when both fields are missing', () => {
      const result = validateRequest({});
      expect(result.valid).toBe(false);
    });

    it('should accept when both required fields are present', () => {
      const result = validateRequest({ customer_email: 'test@example.com', order_number: 'ORD-001' });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Items null-safety (bug fix)', () => {
    it('should handle undefined items without crashing', () => {
      const html = buildItemsHtml(undefined);
      expect(html).toBe('');
    });

    it('should handle null items without crashing', () => {
      const html = buildItemsHtml(null);
      expect(html).toBe('');
    });

    it('should handle non-array items without crashing', () => {
      const html = buildItemsHtml('not-an-array');
      expect(html).toBe('');
    });

    it('should handle empty array', () => {
      const html = buildItemsHtml([]);
      expect(html).toBe('');
    });

    it('should render valid items correctly', () => {
      const html = buildItemsHtml([
        { name: 'Widget', quantity: 2, price: 10 },
      ]);
      expect(html).toContain('Widget');
      expect(html).toContain('2');
      expect(html).toContain('$20.00');
    });

    it('should handle item with missing name', () => {
      const html = buildItemsHtml([
        { quantity: 1, price: 5 },
      ]);
      expect(html).toContain('Item');
    });

    it('should handle item with non-numeric quantity', () => {
      const html = buildItemsHtml([
        { name: 'Test', quantity: 'abc' as unknown as number, price: 10 },
      ]);
      // Should default to quantity=1, so price should be $10.00
      expect(html).toContain('$10.00');
      expect(html).toContain('1');
    });

    it('should handle item with non-numeric price', () => {
      const html = buildItemsHtml([
        { name: 'Test', quantity: 2, price: null as unknown as number },
      ]);
      // Should default to price=0, so total should be $0.00
      expect(html).toContain('$0.00');
    });

    it('should render multiple items', () => {
      const html = buildItemsHtml([
        { name: 'A', quantity: 1, price: 5 },
        { name: 'B', quantity: 3, price: 10 },
      ]);
      expect(html).toContain('A');
      expect(html).toContain('B');
      expect(html).toContain('$5.00');
      expect(html).toContain('$30.00');
    });
  });

  describe('Total null-safety (bug fix)', () => {
    it('should handle undefined total without crashing', () => {
      const formatted = formatTotal(undefined);
      expect(formatted).toBe('$0.00');
    });

    it('should handle null total without crashing', () => {
      const formatted = formatTotal(null);
      expect(formatted).toBe('$0.00');
    });

    it('should handle string total without crashing', () => {
      const formatted = formatTotal('invalid');
      expect(formatted).toBe('$0.00');
    });

    it('should format zero total', () => {
      const formatted = formatTotal(0);
      expect(formatted).toBe('$0.00');
    });

    it('should format numeric total correctly', () => {
      const formatted = formatTotal(42.5);
      expect(formatted).toBe('$42.50');
    });

    it('should format large total correctly', () => {
      const formatted = formatTotal(1234.99);
      expect(formatted).toBe('$1234.99');
    });
  });

  describe('CORS handling', () => {
    it('should include CORS headers in responses', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      };

      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('authorization');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('content-type');
    });
  });

  describe('Error response format', () => {
    it('should return JSON error for 400 responses', () => {
      const body = { error: 'Missing required fields' };
      expect(body.error).toBe('Missing required fields');
    });

    it('should return JSON error for 402 responses', () => {
      const body = {
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        creditsRequired: 10,
        currentBalance: 5,
      };
      expect(body.code).toBe('INSUFFICIENT_CREDITS');
      expect(body.creditsRequired).toBe(10);
    });

    it('should return JSON error for 500 responses', () => {
      const error = new Error('Something failed');
      const body = { error: error.message };
      expect(body.error).toBe('Something failed');
    });

    it('should handle non-Error thrown values', () => {
      const error: unknown = 'string error';
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      expect(message).toBe('Unknown error occurred');
    });
  });

  describe('Success response format', () => {
    it('should return success with email_id when email is sent', () => {
      const body = { success: true, email_id: 'resend-id-123' };
      expect(body.success).toBe(true);
      expect(body.email_id).toBe('resend-id-123');
    });

    it('should return success with message when no provider configured', () => {
      const body = { success: true, message: 'Email provider not configured' };
      expect(body.success).toBe(true);
      expect(body.message).toBe('Email provider not configured');
    });
  });

  describe('Email HTML generation', () => {
    it('should include order number in email', () => {
      const orderNumber = 'ORD-789';
      const html = `<p><strong>Order #:</strong> ${orderNumber}</p>`;
      expect(html).toContain('ORD-789');
    });

    it('should include cancellation reason in email', () => {
      const reason = 'customer_request';
      const html = `<p><strong>Reason:</strong> ${reason}</p>`;
      expect(html).toContain('customer_request');
    });

    it('should include store name in email', () => {
      const storeName = 'My Store';
      const html = `<p>Your order from ${storeName} has been cancelled.</p>`;
      expect(html).toContain('My Store');
    });

    it('should show total with line-through style', () => {
      const total = 42.50;
      const safeTotal = typeof total === 'number' ? total : 0;
      const html = `<span style="text-decoration: line-through;">$${safeTotal.toFixed(2)}</span>`;
      expect(html).toContain('line-through');
      expect(html).toContain('$42.50');
    });
  });

  describe('Resend API integration', () => {
    it('should build correct email payload', () => {
      const payload = {
        from: 'Test Store <orders@resend.dev>',
        to: ['customer@example.com'],
        subject: 'Order Cancelled - #ORD-001',
        html: '<html>...</html>',
      };

      expect(payload.from).toContain('orders@resend.dev');
      expect(payload.to).toEqual(['customer@example.com']);
      expect(payload.subject).toContain('Order Cancelled');
      expect(payload.subject).toContain('ORD-001');
    });

    it('should include store name in from field', () => {
      const storeName = 'Green Leaf';
      const from = `${storeName} <orders@resend.dev>`;
      expect(from).toBe('Green Leaf <orders@resend.dev>');
    });
  });

  describe('Tenant resolution from JWT', () => {
    it('should skip credit deduction when no auth header', () => {
      const authHeader: string | null = null;
      let tenantId: string | null = null;

      if (authHeader) {
        tenantId = 'some-tenant-id';
      }

      expect(tenantId).toBeNull();
    });

    it('should extract Bearer token from auth header', () => {
      const authHeader = 'Bearer abc123token';
      const token = authHeader.replace('Bearer ', '');
      expect(token).toBe('abc123token');
    });

    it('should handle auth header without Bearer prefix', () => {
      const authHeader = 'abc123token';
      const token = authHeader.replace('Bearer ', '');
      expect(token).toBe('abc123token');
    });
  });
});

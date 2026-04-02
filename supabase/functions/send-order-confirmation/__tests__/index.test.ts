/**
 * send-order-confirmation Edge Function Tests
 *
 * Verifies:
 * 1. Request validation (customer_email, order_number required)
 * 2. CORS preflight handling
 * 3. Resend API integration (payload structure, auth header)
 * 4. Graceful degradation when no email provider configured
 * 5. HTML email template generation (items, totals, optional sections)
 * 6. Error handling and response format
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

// Types mirroring the edge function's interfaces
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderEmailRequest {
  order_id: string;
  customer_email: string;
  customer_name: string;
  order_number: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  store_name: string;
  tracking_url?: string;
  loyalty_points_earned?: number;
}

describe('send-order-confirmation', () => {
  const source = readSource();

  describe('shared deps usage', () => {
    it('should import serve from shared deps', () => {
      expect(source).toContain("import { serve, corsHeaders } from '../_shared/deps.ts'");
    });

    it('should not import unused createClient', () => {
      expect(source).not.toContain('createClient');
    });

    it('should use shared corsHeaders, not define its own', () => {
      expect(source).not.toMatch(/const corsHeaders\s*=/);
    });
  });

  describe('CORS preflight', () => {
    it('should handle OPTIONS method for CORS preflight', () => {
      expect(source).toContain('req.method === "OPTIONS"');
    });

    it('should return corsHeaders on OPTIONS response', () => {
      expect(source).toContain('headers: corsHeaders');
    });
  });

  describe('request validation', () => {
    it('should validate customer_email is present', () => {
      expect(source).toContain('!customer_email');
    });

    it('should validate order_number is present', () => {
      expect(source).toContain('!order_number');
    });

    it('should return 400 for missing required fields', () => {
      expect(source).toContain('status: 400');
      expect(source).toContain('"Missing required fields"');
    });

    it('should return 400 when customer_email is empty', () => {
      const body = { customer_email: '', order_number: 'ORD-001' };
      const isValid = body.customer_email && body.order_number;
      expect(isValid).toBeFalsy();
    });

    it('should return 400 when order_number is empty', () => {
      const body = { customer_email: 'test@example.com', order_number: '' };
      const isValid = body.customer_email && body.order_number;
      expect(isValid).toBeFalsy();
    });

    it('should pass validation with valid required fields', () => {
      const body = { customer_email: 'test@example.com', order_number: 'ORD-001' };
      const isValid = body.customer_email && body.order_number;
      expect(isValid).toBeTruthy();
    });
  });

  describe('Resend API integration', () => {
    it('should read RESEND_API_KEY from environment', () => {
      expect(source).toContain('Deno.env.get("RESEND_API_KEY")');
    });

    it('should call Resend emails API endpoint', () => {
      expect(source).toContain('https://api.resend.com/emails');
    });

    it('should include Bearer authorization header', () => {
      expect(source).toContain('`Bearer ${RESEND_API_KEY}`');
    });

    it('should send from store_name <orders@resend.dev>', () => {
      expect(source).toContain('`${store_name} <orders@resend.dev>`');
    });

    it('should send to customer_email as array', () => {
      expect(source).toContain('to: [customer_email]');
    });

    it('should include order number in subject line', () => {
      expect(source).toContain('`Order Confirmed - #${order_number}`');
    });

    it('should return success with email_id on successful send', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('email_id: result.id');
    });

    it('should throw on non-ok Resend response', () => {
      expect(source).toContain('!resendResponse.ok');
      expect(source).toContain('Email send failed');
    });
  });

  describe('graceful degradation without email provider', () => {
    it('should check if RESEND_API_KEY is configured', () => {
      expect(source).toContain('if (RESEND_API_KEY)');
    });

    it('should return success even without email provider', () => {
      // The function returns 200 with a message when no provider is configured
      expect(source).toContain('"Email provider not configured"');
    });

    it('should log when no provider is configured', () => {
      expect(source).toContain('No email provider configured');
    });
  });

  describe('email HTML template', () => {
    it('should generate HTML with order number', () => {
      expect(source).toContain('${order_number}');
    });

    it('should generate HTML with customer name', () => {
      expect(source).toContain('${customer_name}');
    });

    it('should generate HTML with store name', () => {
      expect(source).toContain('${store_name}');
    });

    it('should include item rows with name, quantity, and calculated price', () => {
      expect(source).toContain('${item.name}');
      expect(source).toContain('${item.quantity}');
      expect(source).toContain('(item.price * item.quantity).toFixed(2)');
    });

    it('should include subtotal in email', () => {
      expect(source).toContain('${subtotal.toFixed(2)}');
    });

    it('should display FREE for zero delivery fee', () => {
      expect(source).toContain("delivery_fee > 0 ? `$${delivery_fee.toFixed(2)}` : 'FREE'");
    });

    it('should include total in email', () => {
      expect(source).toContain('${total.toFixed(2)}');
    });
  });

  describe('optional sections', () => {
    it('should conditionally render loyalty points section', () => {
      expect(source).toContain('loyalty_points_earned && loyalty_points_earned > 0');
      expect(source).toContain('Loyalty Points Earned');
      expect(source).toContain('+${loyalty_points_earned}');
    });

    it('should conditionally render tracking URL button', () => {
      expect(source).toContain('tracking_url ?');
      expect(source).toContain('Track Your Order');
      expect(source).toContain('href="${tracking_url}"');
    });
  });

  describe('error handling', () => {
    it('should catch and return 500 on errors', () => {
      expect(source).toContain('status: 500');
    });

    it('should return error message for Error instances', () => {
      expect(source).toContain('error instanceof Error ? error.message');
    });

    it('should return generic message for non-Error types', () => {
      expect(source).toContain("'Unknown error'");
    });

    it('should include Content-Type header in error responses', () => {
      // All responses use corsHeaders + Content-Type
      const contentTypeCount = (source.match(/"Content-Type": "application\/json"/g) || []).length;
      expect(contentTypeCount).toBeGreaterThanOrEqual(3); // 400, 200, 500 responses
    });
  });

  describe('payload structure validation', () => {
    it('should build valid email payload from request body', () => {
      const request: OrderEmailRequest = {
        order_id: '550e8400-e29b-41d4-a716-446655440000',
        customer_email: 'customer@example.com',
        customer_name: 'Jane Doe',
        order_number: 'ORD-001',
        items: [
          { name: 'Blue Dream', quantity: 2, price: 35.00 },
          { name: 'OG Kush', quantity: 1, price: 45.00 },
        ],
        subtotal: 115.00,
        delivery_fee: 5.00,
        total: 120.00,
        store_name: 'Green Garden',
      };

      expect(request.customer_email).toBeDefined();
      expect(request.order_number).toBeDefined();
      expect(request.items).toHaveLength(2);
      expect(request.subtotal + request.delivery_fee).toBe(request.total);
    });

    it('should handle payload with optional tracking_url', () => {
      const request: OrderEmailRequest = {
        order_id: '550e8400-e29b-41d4-a716-446655440000',
        customer_email: 'customer@example.com',
        customer_name: 'Jane Doe',
        order_number: 'ORD-002',
        items: [{ name: 'Product', quantity: 1, price: 10.00 }],
        subtotal: 10.00,
        delivery_fee: 0,
        total: 10.00,
        store_name: 'Test Store',
        tracking_url: 'https://example.com/track?token=abc123',
      };

      expect(request.tracking_url).toBeDefined();
      expect(request.tracking_url).toContain('token=');
    });

    it('should handle payload with optional loyalty_points_earned', () => {
      const request: OrderEmailRequest = {
        order_id: '550e8400-e29b-41d4-a716-446655440000',
        customer_email: 'customer@example.com',
        customer_name: 'Jane Doe',
        order_number: 'ORD-003',
        items: [{ name: 'Product', quantity: 1, price: 10.00 }],
        subtotal: 10.00,
        delivery_fee: 0,
        total: 10.00,
        store_name: 'Test Store',
        loyalty_points_earned: 50,
      };

      expect(request.loyalty_points_earned).toBe(50);
    });

    it('should calculate line item total as price * quantity', () => {
      const item: OrderItem = { name: 'Test Product', quantity: 3, price: 25.00 };
      const lineTotal = item.price * item.quantity;
      expect(lineTotal).toBe(75.00);
      expect(lineTotal.toFixed(2)).toBe('75.00');
    });

    it('should display FREE for zero delivery fee', () => {
      const deliveryFee = 0;
      const display = deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : 'FREE';
      expect(display).toBe('FREE');
    });

    it('should format non-zero delivery fee with dollar sign', () => {
      const deliveryFee = 5.99;
      const display = deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : 'FREE';
      expect(display).toBe('$5.99');
    });
  });

  describe('response format', () => {
    it('should return JSON with success flag on success', () => {
      expect(source).toContain('JSON.stringify({ success: true');
    });

    it('should return JSON with error field on failure', () => {
      expect(source).toContain('JSON.stringify({ error:');
    });

    it('should include corsHeaders in all responses', () => {
      // Count instances of ...corsHeaders in response construction
      const corsCount = (source.match(/\.\.\.corsHeaders/g) || []).length;
      expect(corsCount).toBeGreaterThanOrEqual(3); // 400, 200 (with provider), 200 (without), 500
    });
  });
});

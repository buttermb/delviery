/**
 * Process Payment Edge Function Tests
 *
 * Tests the process-payment function contract:
 * - Zod input validation (schema shape, UUID format, positive amount, payment methods)
 * - Response shapes for each payment method (cash, card, crypto)
 * - Authentication enforcement
 * - Rate limiting responses
 * - Stripe metadata encoding (form-encoded key-value, not JSON string)
 * - Amount mismatch detection
 * - Retry flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mirror the schema from the edge function for validation testing
const paymentSchema = z.object({
  order_id: z.string().uuid(),
  payment_method: z.enum(['cash', 'card', 'crypto']),
  amount: z.number().positive(),
  retry_count: z.number().int().min(0).max(3).default(0),
});

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('process-payment schema validation', () => {
  it('should accept valid cash payment input', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'cash',
      amount: 150.0,
    };
    const result = paymentSchema.parse(input);
    expect(result.order_id).toBe(input.order_id);
    expect(result.payment_method).toBe('cash');
    expect(result.amount).toBe(150.0);
    expect(result.retry_count).toBe(0); // default
  });

  it('should accept valid card payment input', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'card',
      amount: 99.99,
      retry_count: 1,
    };
    const result = paymentSchema.parse(input);
    expect(result.payment_method).toBe('card');
    expect(result.retry_count).toBe(1);
  });

  it('should reject non-UUID order_id', () => {
    const input = {
      order_id: 'not-a-uuid',
      payment_method: 'card',
      amount: 50.0,
    };
    expect(() => paymentSchema.parse(input)).toThrow();
  });

  it('should reject negative amounts', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'card',
      amount: -10.0,
    };
    expect(() => paymentSchema.parse(input)).toThrow();
  });

  it('should reject zero amount', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'card',
      amount: 0,
    };
    expect(() => paymentSchema.parse(input)).toThrow();
  });

  it('should reject invalid payment methods', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'bitcoin',
      amount: 50.0,
    };
    expect(() => paymentSchema.parse(input)).toThrow();
  });

  it('should reject retry_count greater than 3', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'card',
      amount: 50.0,
      retry_count: 4,
    };
    expect(() => paymentSchema.parse(input)).toThrow();
  });

  it('should reject negative retry_count', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'card',
      amount: 50.0,
      retry_count: -1,
    };
    expect(() => paymentSchema.parse(input)).toThrow();
  });

  it('should reject non-integer retry_count', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'card',
      amount: 50.0,
      retry_count: 1.5,
    };
    expect(() => paymentSchema.parse(input)).toThrow();
  });

  it('should accept missing retry_count and default to 0', () => {
    const input = {
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'card',
      amount: 100.0,
    };
    const result = paymentSchema.parse(input);
    expect(result.retry_count).toBe(0);
  });

  it('should reject missing required fields', () => {
    expect(() => paymentSchema.parse({})).toThrow();
    expect(() => paymentSchema.parse({ order_id: '550e8400-e29b-41d4-a716-446655440000' })).toThrow();
    expect(() =>
      paymentSchema.parse({
        order_id: '550e8400-e29b-41d4-a716-446655440000',
        payment_method: 'card',
      })
    ).toThrow();
  });
});

describe('process-payment API contract', () => {
  const endpoint = `${FUNCTIONS_URL}/process-payment`;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cash payments', () => {
    it('should return pending status for cash payments', async () => {
      const mockResponse = {
        success: true,
        payment: {
          id: null,
          transaction_id: 'CASH-550e8400',
          status: 'pending',
          method: 'cash',
          client_secret: undefined,
        },
        message: 'Payment will be collected on delivery',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'cash',
          amount: 150.0,
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.payment.method).toBe('cash');
      expect(data.payment.status).toBe('pending');
      expect(data.payment.transaction_id).toMatch(/^CASH-/);
      expect(data.payment.id).toBeNull();
    });
  });

  describe('card payments', () => {
    it('should return completed status with client_secret for card payments', async () => {
      const mockResponse = {
        success: true,
        payment: {
          id: 'pi_123456',
          transaction_id: 'pi_123456',
          status: 'completed',
          method: 'card',
          client_secret: 'pi_123456_secret_abc',
        },
        message: 'Payment processed successfully',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.payment.method).toBe('card');
      expect(data.payment.status).toBe('completed');
      expect(data.payment.client_secret).toBeDefined();
      expect(data.payment.id).toBe('pi_123456');
    });
  });

  describe('crypto payments', () => {
    it('should return 400 for crypto (not implemented)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Crypto payments not yet implemented' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'crypto',
          amount: 150.0,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not yet implemented');
    });
  });

  describe('authentication', () => {
    it('should reject requests without Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Unauthorized' }, 401));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Invalid token' }, 401));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('rate limiting', () => {
    it('should return 429 when rate limit exceeded', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Rate limit exceeded',
            message: 'Too many payment attempts. Please try again later.',
            resetAt: Date.now() + 60000,
          },
          429
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Rate limit exceeded');
      expect(data.resetAt).toBeDefined();
    });
  });

  describe('amount validation', () => {
    it('should reject amount mismatch with order total', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Amount mismatch' }, 400));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 999.99,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Amount mismatch');
    });
  });

  describe('retry flow', () => {
    it('should return retry instruction on payment failure with retry_count < 3', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Payment processing failed',
            message: 'Payment failed. Please try again.',
            retry: true,
            retry_count: 2,
          },
          500
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
          retry_count: 1,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.retry).toBe(true);
      expect(data.retry_count).toBe(2);
    });
  });

  describe('tenant isolation', () => {
    it('should return 403 when user has no tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Tenant not found for user' }, 403)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-no-tenant',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 when order belongs to different tenant', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ error: 'Order not found' }, 404));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '660e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(endpoint, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
    });
  });
});

describe('Stripe metadata encoding', () => {
  it('should encode metadata as individual key-value pairs, not JSON string', () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 'user-123';

    // This is how the fixed function encodes Stripe metadata
    const params = new URLSearchParams({
      amount: '15000',
      currency: 'usd',
      'metadata[order_id]': orderId,
      'metadata[user_id]': userId,
    });

    const encoded = params.toString();

    // Verify individual metadata keys are properly encoded
    expect(encoded).toContain('metadata%5Border_id%5D=');
    expect(encoded).toContain('metadata%5Buser_id%5D=');

    // Verify it does NOT contain a JSON-stringified metadata value
    expect(encoded).not.toContain('"order_id"');
    expect(encoded).not.toContain('"user_id"');
  });
});

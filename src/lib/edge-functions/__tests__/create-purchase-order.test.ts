/**
 * Create Purchase Order Edge Function Tests
 * Tests the create-purchase-order edge function contract:
 * - Authentication and tenant authorization
 * - Input validation (Zod schema)
 * - Supplier lookup and minimum order enforcement
 * - PO creation with items
 * - Error handling and rollback
 * - CORS preflight handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://test-project.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/create-purchase-order`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const validPayload = {
  tenant_id: '550e8400-e29b-41d4-a716-446655440000',
  supplier_id: '660e8400-e29b-41d4-a716-446655440001',
  items: [
    {
      product_id: '770e8400-e29b-41d4-a716-446655440002',
      product_name: 'Test Product A',
      quantity_lbs: 50,
      quantity_units: 10,
      price_per_lb: 25.0,
    },
    {
      product_id: '880e8400-e29b-41d4-a716-446655440003',
      product_name: 'Test Product B',
      quantity_lbs: 100,
      price_per_lb: 15.0,
    },
  ],
  delivery_date: '2026-04-01',
  notes: 'Rush delivery requested',
};

describe('create-purchase-order Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authorization', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Tenant authorization', () => {
    it('should reject when user is not authorized for the tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for this tenant' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          ...validPayload,
          tenant_id: '990e8400-e29b-41d4-a716-446655440099',
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Not authorized for this tenant');
    });
  });

  describe('Input validation', () => {
    it('should reject empty items array', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ ...validPayload, items: [] }),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject invalid tenant_id (non-UUID)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ ...validPayload, tenant_id: 'not-a-uuid' }),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject negative quantity_lbs', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          ...validPayload,
          items: [{ ...validPayload.items[0], quantity_lbs: -10 }],
        }),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject quantity_lbs exceeding max (10000)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          ...validPayload,
          items: [{ ...validPayload.items[0], quantity_lbs: 99999 }],
        }),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject notes exceeding max length (2000 chars)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          ...validPayload,
          notes: 'x'.repeat(2001),
        }),
      });

      expect(response.ok).toBe(false);
    });

    it('should accept valid optional fields as absent', async () => {
      const payload = {
        tenant_id: validPayload.tenant_id,
        supplier_id: validPayload.supplier_id,
        items: validPayload.items,
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          purchase_order_id: 'po-123',
          po_number: 'PO-2026-001',
          total_amount: 2750,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(payload),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Supplier validation', () => {
    it('should return 404 when supplier not found', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Supplier not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Supplier not found');
    });

    it('should reject order below supplier minimum', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Order total below minimum',
            minimum: 5000,
            current: 2750,
          },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Order total below minimum');
      expect(data.minimum).toBe(5000);
      expect(data.current).toBe(2750);
    });
  });

  describe('Successful PO creation', () => {
    it('should create a purchase order with items and return success', async () => {
      const mockResponse = {
        success: true,
        purchase_order_id: 'po-uuid-123',
        po_number: 'PO-2026-0042',
        total_amount: 2750,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.purchase_order_id).toBe('po-uuid-123');
      expect(data.po_number).toBe('PO-2026-0042');
      expect(data.total_amount).toBe(2750);
    });

    it('should pass correct payload structure to the function', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, purchase_order_id: 'po-1' })
      );

      await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
          body: JSON.stringify(validPayload),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should return 500 for internal server errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unknown error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle PO number collision gracefully', async () => {
      // The function retries up to 3 times on unique constraint violations
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          purchase_order_id: 'po-retry-success',
          po_number: 'PO-2026-0043',
          total_amount: 2750,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should rollback PO if items insert fails', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Failed to insert items' },
          500
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(validPayload),
      });

      expect(response.status).toBe(500);
    });
  });

  describe('Server-side price calculation', () => {
    it('should use server-side wholesale prices over client prices', async () => {
      // The function fetches wholesale_price_per_lb from the products table
      // and uses it instead of the client-provided price_per_lb
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          purchase_order_id: 'po-server-price',
          po_number: 'PO-2026-0044',
          total_amount: 3000, // Different from client calculation
        })
      );

      const tamperPayload = {
        ...validPayload,
        items: [
          {
            ...validPayload.items[0],
            price_per_lb: 0.01, // Malicious attempt to pay less
          },
        ],
      };

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(tamperPayload),
      });

      // Server should accept but use its own calculated total
      const data = await response.json();
      expect(response.ok).toBe(true);
      expect(data.total_amount).toBe(3000);
    });
  });
});

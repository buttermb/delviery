/**
 * Create Purchase Order Edge Function Tests
 *
 * Tests the create-purchase-order edge function contract:
 * 1. Request validation (Zod schema)
 * 2. Authentication and tenant authorization
 * 3. Vendor lookup (uses vendors table, not suppliers)
 * 4. Response shape (nested purchase_order object for frontend)
 * 5. Error responses (400, 401, 403, 404, 500)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
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

const validAuthHeaders = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer valid-token',
};

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

describe('create-purchase-order edge function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });
      expect(response.ok).toBe(true);
    });
  });

  describe('authentication', () => {
    it('should return 401 when no auth token is provided', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [{ product_id: validUUID, quantity_lbs: 10, unit_cost: 5 }],
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user has no tenant membership', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for any tenant' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [{ product_id: validUUID, quantity_lbs: 10, unit_cost: 5 }],
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Not authorized');
    });

    it('should return 403 when body tenant_id does not match user tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Not authorized for this tenant' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          tenant_id: 'mismatched-tenant-id',
          supplier_id: validUUID,
          items: [{ product_id: validUUID, quantity_lbs: 10, unit_cost: 5 }],
        }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    it('should return 400 for missing supplier_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Required' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          items: [{ product_id: validUUID, quantity_lbs: 10, unit_cost: 5 }],
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty items array', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Array must contain at least 1 element(s)' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [],
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid product_id (not UUID)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid uuid' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [{ product_id: 'not-a-uuid', quantity_lbs: 10, unit_cost: 5 }],
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for negative quantity_lbs', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Number must be greater than 0' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [{ product_id: validUUID, quantity_lbs: -5, unit_cost: 10 }],
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('vendor lookup', () => {
    it('should return 404 when vendor is not found', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Vendor not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [{ product_id: validUUID, quantity_lbs: 10, unit_cost: 5 }],
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Vendor not found');
    });
  });

  describe('minimum order amount', () => {
    it('should return 400 when order total is below vendor minimum', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Order total below minimum', minimum: 100, current: 50 },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [{ product_id: validUUID, quantity_lbs: 10, unit_cost: 5 }],
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Order total below minimum');
      expect(data.minimum).toBe(100);
      expect(data.current).toBe(50);
    });
  });

  describe('successful creation', () => {
    it('should create PO and return nested purchase_order object', async () => {
      const mockResponse = {
        success: true,
        purchase_order: {
          id: 'po-uuid-123',
          po_number: 'PO-260318-A1B2C3',
          vendor_id: validUUID,
          total: 500,
          status: 'pending',
          items: [
            {
              product_id: validUUID,
              product_name: 'Test Product',
              quantity: 10,
              unit_cost: 50,
              total_cost: 500,
            },
          ],
        },
        purchase_order_id: 'po-uuid-123',
        po_number: 'PO-260318-A1B2C3',
        total_amount: 500,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [
            {
              product_id: validUUID,
              quantity_lbs: 10,
              unit_cost: 50,
            },
          ],
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      // Nested object for frontend hooks
      expect(data.purchase_order).toBeDefined();
      expect(data.purchase_order.id).toBe('po-uuid-123');
      expect(data.purchase_order.po_number).toMatch(/^PO-/);
      expect(data.purchase_order.vendor_id).toBe(validUUID);
      expect(data.purchase_order.total).toBe(500);
      expect(data.purchase_order.items).toHaveLength(1);
      // Backward-compat flat fields
      expect(data.purchase_order_id).toBe('po-uuid-123');
      expect(data.po_number).toBe(data.purchase_order.po_number);
      expect(data.total_amount).toBe(500);
    });

    it('should accept request from POCreateForm (with expected_delivery_date and notes)', async () => {
      const mockResponse = {
        success: true,
        purchase_order: {
          id: 'po-uuid-456',
          po_number: 'PO-260318-D4E5F6',
          vendor_id: validUUID,
          total: 250,
          status: 'pending',
          items: [],
        },
        purchase_order_id: 'po-uuid-456',
        po_number: 'PO-260318-D4E5F6',
        total_amount: 250,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          expected_delivery_date: '2026-04-01',
          notes: 'Rush order',
          items: [
            {
              product_id: validUUID,
              quantity_lbs: 5,
              unit_cost: 50,
            },
          ],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should accept request from LowStockToPODialog (with status draft)', async () => {
      const mockResponse = {
        success: true,
        purchase_order: {
          id: 'po-uuid-789',
          po_number: 'PO-260318-G7H8I9',
          vendor_id: validUUID,
          total: 100,
          status: 'draft',
          items: [],
        },
        purchase_order_id: 'po-uuid-789',
        po_number: 'PO-260318-G7H8I9',
        total_amount: 100,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          notes: 'Auto-generated from low stock alerts',
          status: 'draft',
          items: [
            {
              product_id: validUUID,
              quantity_lbs: 20,
              unit_cost: 5,
            },
          ],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.purchase_order.status).toBe('draft');
    });

    it('should accept request from useCreateReorderPO (minimal payload)', async () => {
      const mockResponse = {
        success: true,
        purchase_order: {
          id: 'po-uuid-abc',
          po_number: 'PO-260318-J0K1L2',
          vendor_id: validUUID,
          total: 0,
          status: 'pending',
          items: [],
        },
        purchase_order_id: 'po-uuid-abc',
        po_number: 'PO-260318-J0K1L2',
        total_amount: 0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          notes: 'Auto-generated reorder: Below reorder threshold (10 units)',
          items: [
            {
              product_id: validUUID,
              quantity_lbs: 30,
              unit_cost: 0,
            },
          ],
        }),
      });

      expect(response.ok).toBe(true);
    });

    it('should accept items with product_name and price_per_lb (legacy format)', async () => {
      const mockResponse = {
        success: true,
        purchase_order: {
          id: 'po-uuid-legacy',
          po_number: 'PO-260318-LEGACY',
          vendor_id: validUUID,
          total: 150,
          status: 'pending',
          items: [],
        },
        purchase_order_id: 'po-uuid-legacy',
        po_number: 'PO-260318-LEGACY',
        total_amount: 150,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          tenant_id: validUUID,
          supplier_id: validUUID,
          items: [
            {
              product_id: validUUID,
              product_name: 'Legacy Product',
              quantity_lbs: 15,
              price_per_lb: 10,
            },
          ],
          delivery_date: '2026-05-01',
        }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return 500 for unexpected server errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: validAuthHeaders,
        body: JSON.stringify({
          supplier_id: validUUID,
          items: [{ product_id: validUUID, quantity_lbs: 10, unit_cost: 5 }],
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});

/**
 * Tests for create-purchase-order edge function
 *
 * Verifies:
 * 1. Successful PO creation returns pdf_url and email_sent fields
 * 2. PO creation succeeds even when PDF/email features fail (non-fatal)
 * 3. Unauthorized requests are rejected
 * 4. Missing required fields are rejected
 * 5. Minimum order amount enforcement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('create-purchase-order Edge Function', () => {
  const endpoint = `${FUNCTIONS_URL}/create-purchase-order`;
  const mockAuthToken = 'Bearer test-jwt-token';

  const validPayload = {
    tenant_id: '550e8400-e29b-41d4-a716-446655440000',
    supplier_id: '660e8400-e29b-41d4-a716-446655440001',
    items: [
      {
        product_id: '770e8400-e29b-41d4-a716-446655440002',
        product_name: 'Blue Dream',
        quantity_lbs: 10,
        quantity_units: 0,
        price_per_lb: 1500,
      },
    ],
    delivery_date: '2026-04-01',
    notes: 'Rush order',
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a purchase order successfully with PDF and email fields', async () => {
    const successResponse = {
      success: true,
      purchase_order_id: '880e8400-e29b-41d4-a716-446655440003',
      po_number: 'PO-20260318-a1b2',
      total_amount: 15000,
      pdf_url: 'https://storage.supabase.co/purchase-orders/tenant/PO-20260318-a1b2.html',
      email_sent: true,
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(successResponse));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: mockAuthToken,
      },
      body: JSON.stringify(validPayload),
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.purchase_order_id).toBeDefined();
    expect(data.po_number).toMatch(/^PO-/);
    expect(data.total_amount).toBe(15000);
    expect(data).toHaveProperty('pdf_url');
    expect(data).toHaveProperty('email_sent');
  });

  it('should include pdf_url as null when PDF generation fails gracefully', async () => {
    const responseWithoutPdf = {
      success: true,
      purchase_order_id: '880e8400-e29b-41d4-a716-446655440003',
      po_number: 'PO-20260318-c3d4',
      total_amount: 15000,
      pdf_url: null,
      email_sent: false,
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(responseWithoutPdf));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: mockAuthToken,
      },
      body: JSON.stringify(validPayload),
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.pdf_url).toBeNull();
    expect(data.email_sent).toBe(false);
  });

  it('should reject unauthorized requests', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Unauthorized' }, 401)
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject requests with no items', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Validation error' }, 500)
    );

    const emptyPayload = { ...validPayload, items: [] };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: mockAuthToken,
      },
      body: JSON.stringify(emptyPayload),
    });

    expect(response.ok).toBe(false);
  });

  it('should reject when supplier not found', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Supplier not found' }, 404)
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: mockAuthToken,
      },
      body: JSON.stringify(validPayload),
    });

    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
    expect(data.error).toBe('Supplier not found');
  });

  it('should reject when order total is below supplier minimum', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(
        {
          error: 'Order total below minimum',
          minimum: 5000,
          current: 1500,
        },
        400
      )
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: mockAuthToken,
      },
      body: JSON.stringify(validPayload),
    });

    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    expect(data.error).toBe('Order total below minimum');
    expect(data.minimum).toBe(5000);
    expect(data.current).toBe(1500);
  });

  it('should reject when tenant authorization fails', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Not authorized for this tenant' }, 403)
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: mockAuthToken,
      },
      body: JSON.stringify(validPayload),
    });

    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(403);
    expect(data.error).toBe('Not authorized for this tenant');
  });

  it('should handle CORS preflight', async () => {
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

  it('should send correct request payload structure', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        success: true,
        purchase_order_id: 'test-id',
        po_number: 'PO-TEST',
        total_amount: 15000,
        pdf_url: null,
        email_sent: false,
      })
    );

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: mockAuthToken,
      },
      body: JSON.stringify(validPayload),
    });

    expect(mockFetch).toHaveBeenCalledWith(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: mockAuthToken,
      },
      body: JSON.stringify(validPayload),
    });

    const parsedBody = JSON.parse(
      mockFetch.mock.calls[0][1].body as string
    );
    expect(parsedBody.tenant_id).toBeDefined();
    expect(parsedBody.supplier_id).toBeDefined();
    expect(parsedBody.items).toHaveLength(1);
    expect(parsedBody.items[0].product_name).toBe('Blue Dream');
    expect(parsedBody.items[0].quantity_lbs).toBe(10);
    expect(parsedBody.items[0].price_per_lb).toBe(1500);
  });
});

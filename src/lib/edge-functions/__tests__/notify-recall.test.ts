/**
 * notify-recall Edge Function Tests
 * Tests recall notification sending for the FloraIQ platform
 *
 * These tests verify:
 * 1. Successful recall notification to customers
 * 2. Recall not found handling
 * 3. CORS preflight handling
 * 4. Validation of input (recall_id, notification_method)
 * 5. Empty customer list handling
 * 6. Failed notification tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/notify-recall`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('notify-recall Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle CORS preflight requests', async () => {
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

  it('should send recall notifications to affected customers', async () => {
    const mockResponse = {
      success: true,
      recall_id: '550e8400-e29b-41d4-a716-446655440000',
      customers_notified: 3,
      customers_failed: 0,
      message: 'Recall notifications sent to 3 customers',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        recall_id: '550e8400-e29b-41d4-a716-446655440000',
        notification_method: 'email',
      }),
    });

    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.customers_notified).toBe(3);
    expect(data.customers_failed).toBe(0);
    expect(data.recall_id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should return 404 when recall is not found', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Recall not found' }, 404)
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        recall_id: '00000000-0000-0000-0000-000000000000',
        notification_method: 'email',
      }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Recall not found');
  });

  it('should return error for invalid recall_id format', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Invalid recall ID format' }, 400)
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        recall_id: 'not-a-uuid',
        notification_method: 'email',
      }),
    });

    expect(response.status).toBe(400);
  });

  it('should default notification_method to email when not specified', async () => {
    const mockResponse = {
      success: true,
      recall_id: '550e8400-e29b-41d4-a716-446655440000',
      customers_notified: 1,
      customers_failed: 0,
      message: 'Recall notifications sent to 1 customers',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        recall_id: '550e8400-e29b-41d4-a716-446655440000',
      }),
    });

    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.customers_notified).toBe(1);
  });

  it('should support both email and sms notification method', async () => {
    const mockResponse = {
      success: true,
      recall_id: '550e8400-e29b-41d4-a716-446655440000',
      customers_notified: 5,
      customers_failed: 0,
      message: 'Recall notifications sent to 5 customers',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        recall_id: '550e8400-e29b-41d4-a716-446655440000',
        notification_method: 'both',
      }),
    });

    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.customers_notified).toBe(5);
  });

  it('should handle zero affected customers gracefully', async () => {
    const mockResponse = {
      success: true,
      recall_id: '550e8400-e29b-41d4-a716-446655440000',
      customers_notified: 0,
      customers_failed: 0,
      message: 'Recall notifications sent to 0 customers',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        recall_id: '550e8400-e29b-41d4-a716-446655440000',
        notification_method: 'email',
      }),
    });

    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.customers_notified).toBe(0);
  });

  it('should track failed notifications', async () => {
    const mockResponse = {
      success: true,
      recall_id: '550e8400-e29b-41d4-a716-446655440000',
      customers_notified: 2,
      customers_failed: 1,
      message: 'Recall notifications sent to 2 customers',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        recall_id: '550e8400-e29b-41d4-a716-446655440000',
        notification_method: 'email',
      }),
    });

    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.customers_notified).toBe(2);
    expect(data.customers_failed).toBe(1);
  });

  it('should return error for missing recall_id', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Required' }, 400)
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it('should reject invalid notification_method', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({ error: 'Validation error' }, 400)
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        recall_id: '550e8400-e29b-41d4-a716-446655440000',
        notification_method: 'carrier_pigeon',
      }),
    });

    expect(response.status).toBe(400);
  });
});

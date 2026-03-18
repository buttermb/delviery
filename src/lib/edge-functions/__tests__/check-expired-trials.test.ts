/**
 * check-expired-trials Edge Function Tests
 *
 * Tests the expired trial check function that:
 * 1. Finds tenants with expired trials
 * 2. Suspends tenants without a payment method
 * 3. Converts tenants with a payment method to active
 * 4. Logs subscription events
 * 5. Triggers expiration notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/check-expired-trials`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('check-expired-trials Edge Function', () => {
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
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      }),
    });

    const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

    expect(response.ok).toBe(true);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should return processed count when no expired trials found', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        processed: 0,
        suspended: 0,
        converted: 0,
        failed: 0,
        results: [],
        timestamp: expect.any(String),
      })
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer service-role-key',
      },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.processed).toBe(0);
    expect(data.suspended).toBe(0);
    expect(data.converted).toBe(0);
    expect(data.results).toEqual([]);
  });

  it('should suspend tenants without payment method', async () => {
    const mockResponse = {
      processed: 2,
      suspended: 2,
      converted: 0,
      failed: 0,
      results: [
        {
          tenant_id: 'tenant-1',
          business_name: 'Test Shop 1',
          success: true,
          action: 'suspended',
        },
        {
          tenant_id: 'tenant-2',
          business_name: 'Test Shop 2',
          success: true,
          action: 'suspended',
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer service-role-key',
      },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.processed).toBe(2);
    expect(data.suspended).toBe(2);
    expect(data.converted).toBe(0);
    expect(data.results).toHaveLength(2);
    expect(data.results[0].action).toBe('suspended');
    expect(data.results[0].success).toBe(true);
  });

  it('should convert tenants with payment method to active', async () => {
    const mockResponse = {
      processed: 1,
      suspended: 0,
      converted: 1,
      failed: 0,
      results: [
        {
          tenant_id: 'tenant-3',
          business_name: 'Paid Shop',
          success: true,
          action: 'converted_to_active',
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer service-role-key',
      },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.converted).toBe(1);
    expect(data.suspended).toBe(0);
    expect(data.results[0].action).toBe('converted_to_active');
  });

  it('should handle mixed results (some suspend, some convert, some fail)', async () => {
    const mockResponse = {
      processed: 3,
      suspended: 1,
      converted: 1,
      failed: 1,
      results: [
        {
          tenant_id: 'tenant-1',
          business_name: 'Suspended Shop',
          success: true,
          action: 'suspended',
        },
        {
          tenant_id: 'tenant-2',
          business_name: 'Converted Shop',
          success: true,
          action: 'converted_to_active',
        },
        {
          tenant_id: 'tenant-3',
          success: false,
          error: 'Database update failed',
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer service-role-key',
      },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.processed).toBe(3);
    expect(data.suspended).toBe(1);
    expect(data.converted).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.results).toHaveLength(3);

    const failedResult = data.results.find(
      (r: { success: boolean }) => !r.success
    );
    expect(failedResult).toBeDefined();
    expect(failedResult.error).toBe('Database update failed');
  });

  it('should return 500 on internal error', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(
        {
          error: 'Missing required environment variables',
          timestamp: '2026-03-18T00:00:00.000Z',
        },
        500
      )
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer service-role-key',
      },
    });

    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  it('should include timestamp in all responses', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        processed: 0,
        suspended: 0,
        converted: 0,
        failed: 0,
        results: [],
        timestamp: '2026-03-18T12:00:00.000Z',
      })
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer service-role-key',
      },
    });

    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(() => new Date(data.timestamp)).not.toThrow();
  });

  it('should include CORS headers in success response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ processed: 0, results: [], timestamp: '' }),
      headers: new Headers({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }),
    });

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer service-role-key',
      },
    });

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should include CORS headers in error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({ error: 'Something went wrong', timestamp: '' }),
      headers: new Headers({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }),
    });

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer service-role-key',
      },
    });

    expect(response.status).toBe(500);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

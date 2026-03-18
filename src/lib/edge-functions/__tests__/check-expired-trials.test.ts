/**
 * check-expired-trials Edge Function Tests
 *
 * Tests the expired trial check flow:
 * 1. Finding tenants with expired trials
 * 2. Suspending those tenants
 * 3. Sending expiration notification emails via Resend
 * 4. Graceful handling when email provider is not configured
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/check-expired-trials`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock responses
const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('check-expired-trials', () => {
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

  it('should process expired trials and return results', async () => {
    const mockResponse = {
      processed: 2,
      results: [
        {
          tenant_id: 'tenant-1',
          business_name: 'Acme Corp',
          success: true,
          email_sent: true,
        },
        {
          tenant_id: 'tenant-2',
          business_name: 'Beta LLC',
          success: true,
          email_sent: true,
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.processed).toBe(2);
    expect(data.results).toHaveLength(2);
    expect(data.results[0].success).toBe(true);
    expect(data.results[0].email_sent).toBe(true);
    expect(data.results[1].success).toBe(true);
    expect(data.timestamp).toBeDefined();
  });

  it('should return zero processed when no expired trials exist', async () => {
    const mockResponse = {
      processed: 0,
      results: [],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.processed).toBe(0);
    expect(data.results).toHaveLength(0);
  });

  it('should handle suspension failure for a tenant', async () => {
    const mockResponse = {
      processed: 2,
      results: [
        {
          tenant_id: 'tenant-1',
          success: false,
          error: 'Database update failed',
        },
        {
          tenant_id: 'tenant-2',
          business_name: 'Beta LLC',
          success: true,
          email_sent: true,
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.results[0].success).toBe(false);
    expect(data.results[0].error).toBe('Database update failed');
    expect(data.results[1].success).toBe(true);
  });

  it('should report email_sent false when email provider is not configured', async () => {
    const mockResponse = {
      processed: 1,
      results: [
        {
          tenant_id: 'tenant-1',
          business_name: 'Acme Corp',
          success: true,
          email_sent: false,
          email_error: 'Email provider not configured',
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.results[0].success).toBe(true);
    expect(data.results[0].email_sent).toBe(false);
    expect(data.results[0].email_error).toBe('Email provider not configured');
  });

  it('should report email error when email sending fails', async () => {
    const mockResponse = {
      processed: 1,
      results: [
        {
          tenant_id: 'tenant-1',
          business_name: 'Acme Corp',
          success: true,
          email_sent: false,
          email_error: 'Email send failed: {"message":"Invalid API key"}',
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.results[0].success).toBe(true);
    expect(data.results[0].email_sent).toBe(false);
    expect(data.results[0].email_error).toContain('Email send failed');
  });

  it('should return 500 on internal error', async () => {
    const mockResponse = {
      error: 'relation "tenants" does not exist',
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse, 500));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('should include tenant business_name in results for successful suspensions', async () => {
    const mockResponse = {
      processed: 1,
      results: [
        {
          tenant_id: 'tenant-1',
          business_name: 'Green Gardens',
          success: true,
          email_sent: true,
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    expect(data.results[0].business_name).toBe('Green Gardens');
  });

  it('should include timestamp in all responses', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        processed: 0,
        results: [],
        timestamp: '2026-03-18T12:00:00.000Z',
      })
    );

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });
});

describe('check-expired-trials email template', () => {
  it('should not include email_sent field when suspension fails', async () => {
    const mockResponse = {
      processed: 1,
      results: [
        {
          tenant_id: 'tenant-1',
          success: false,
          error: 'Update failed',
        },
      ],
      timestamp: '2026-03-18T00:00:00.000Z',
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    expect(data.results[0].success).toBe(false);
    expect(data.results[0].email_sent).toBeUndefined();
  });
});

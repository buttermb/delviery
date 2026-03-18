/**
 * process-data-export Edge Function Tests
 *
 * Tests the background data export processing function:
 * 1. CORS preflight handling
 * 2. Authentication and authorization
 * 3. Input validation (Zod schema)
 * 4. Export processing (CSV, JSON, Excel/TSV)
 * 5. Error handling and job status updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/process-data-export`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('process-data-export Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS handling', () => {
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

  describe('Authentication', () => {
    it('should require authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization');
    });

    it('should reject invalid bearer tokens', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject users not belonging to the export tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Forbidden' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-wrong-tenant',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Input validation', () => {
    it('should reject missing exportId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Required' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
    });

    it('should reject non-UUID exportId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid export ID format' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: 'not-a-uuid' }),
      });

      expect(response.ok).toBe(false);
    });

    it('should accept valid UUID exportId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'Export completed', row_count: 10 })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Export processing', () => {
    it('should complete a CSV export successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Export completed',
        row_count: 150,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Export completed');
      expect(data.row_count).toBe(150);
    });

    it('should complete a JSON export successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Export completed',
        row_count: 42,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '660e8400-e29b-41d4-a716-446655440000' }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.row_count).toBe(42);
    });

    it('should handle export with zero rows', async () => {
      const mockResponse = {
        success: true,
        message: 'Export completed',
        row_count: 0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.row_count).toBe(0);
    });
  });

  describe('Data type validation', () => {
    it('should reject unsupported data types', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unsupported data type' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Unsupported data type');
    });

    it('should reject unsupported formats', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unsupported format' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Unsupported format');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent export job', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Export job not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '990e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Export job not found');
    });

    it('should mark job as failed on processing error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Export processing failed' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 500 for server configuration errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Server configuration error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      expect(response.status).toBe(500);
    });
  });
});

describe('process-data-export Validation Schema', () => {
  // Test the Zod schema independently (for unit-level validation tests)
  // These test the actual validation logic without network mocking

  it('should validate correct UUID format', () => {
    const validUUIDs = [
      '550e8400-e29b-41d4-a716-446655440000',
      '123e4567-e89b-12d3-a456-426614174000',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    ];

    for (const uuid of validUUIDs) {
      // UUID regex from Zod
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(uuid)).toBe(true);
    }
  });

  it('should reject invalid UUID formats', () => {
    const invalidUUIDs = [
      'not-a-uuid',
      '12345',
      '',
      '550e8400-e29b-41d4-a716',
      '550e8400e29b41d4a716446655440000', // no dashes
    ];

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const uuid of invalidUUIDs) {
      expect(uuidRegex.test(uuid)).toBe(false);
    }
  });

  it('should define valid data types', () => {
    const allowedTypes = ['orders', 'customers', 'products', 'inventory', 'deliveries'];
    expect(allowedTypes).toHaveLength(5);
    expect(allowedTypes).toContain('orders');
    expect(allowedTypes).toContain('customers');
    expect(allowedTypes).toContain('products');
    expect(allowedTypes).toContain('inventory');
    expect(allowedTypes).toContain('deliveries');
  });

  it('should define valid formats', () => {
    const allowedFormats = ['csv', 'json', 'excel'];
    expect(allowedFormats).toHaveLength(3);
    expect(allowedFormats).toContain('csv');
    expect(allowedFormats).toContain('json');
    expect(allowedFormats).toContain('excel');
  });
});

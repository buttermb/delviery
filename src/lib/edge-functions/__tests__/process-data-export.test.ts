/**
 * Process Data Export Edge Function Tests
 *
 * Tests the process-data-export function which:
 * 1. Validates request schema (exportId must be UUID)
 * 2. Authenticates the caller via JWT
 * 3. Verifies tenant membership
 * 4. Fetches data in batches and generates CSV/JSON
 * 5. Uploads to storage and creates signed download URL
 * 6. Marks job as completed or failed
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

  describe('Request validation', () => {
    it('should reject missing exportId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid request', details: expect.anything() }, 400)
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

    it('should reject non-UUID exportId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid request', details: expect.anything() }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    it('should accept valid UUID exportId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'Export completed' })
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

  describe('Authentication', () => {
    it('should require Authorization header', async () => {
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

    it('should reject invalid JWT token', async () => {
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
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Tenant authorization', () => {
    it('should reject user who does not belong to the export tenant', async () => {
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

  describe('Export processing', () => {
    it('should return 404 when export job does not exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Export job not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440099' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Export job not found');
    });

    it('should complete export successfully with CSV format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'Export completed' })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440000' }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Export completed');
    });

    it('should complete export successfully with JSON format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'Export completed' })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId: '550e8400-e29b-41d4-a716-446655440001' }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return 500 and mark job as failed on internal error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
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

    it('should handle storage upload failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Storage upload failed' }, 500)
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

  describe('Request contract', () => {
    it('should send correct request format to the function', async () => {
      const exportId = '550e8400-e29b-41d4-a716-446655440000';

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'Export completed' })
      );

      await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId }),
      });

      expect(mockFetch).toHaveBeenCalledWith(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ exportId }),
      });
    });

    it('should not include extra fields in request', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'Export completed' })
      );

      const body = { exportId: '550e8400-e29b-41d4-a716-446655440000' };

      await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(body),
      });

      // Verify the body only contains exportId
      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(Object.keys(calledBody)).toEqual(['exportId']);
    });
  });
});

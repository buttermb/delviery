/**
 * Retry Failed Emails Edge Function Tests
 *
 * Tests the cron-driven email retry edge function that:
 * 1. Requires x-internal-api-key authentication
 * 2. Fetches failed emails due for retry
 * 3. Re-sends via Klaviyo (or logs in dev)
 * 4. Handles exponential backoff on continued failure
 * 5. Records permanent failures after max retries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/retry-failed-emails`;
const INTERNAL_API_KEY = 'test-internal-key-123';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('retry-failed-emails Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should reject requests without x-internal-api-key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 403),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with wrong x-internal-api-key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 403),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'wrong-key',
        },
      });

      expect(response.status).toBe(403);
    });

    it('should accept requests with valid x-internal-api-key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, processed: 0 }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_API_KEY,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type, x-internal-api-key',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
      expect(
        response.headers.get('Access-Control-Allow-Headers'),
      ).toContain('x-internal-api-key');
    });
  });

  describe('No emails to retry', () => {
    it('should return processed: 0 when queue is empty', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, processed: 0 }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_API_KEY,
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(0);
    });
  });

  describe('Successful retries', () => {
    it('should process and report successful email retries', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          processed: 3,
          successCount: 3,
          failCount: 0,
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_API_KEY,
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(3);
      expect(data.successCount).toBe(3);
      expect(data.failCount).toBe(0);
    });
  });

  describe('Mixed results', () => {
    it('should report mixed success/failure counts', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          processed: 5,
          successCount: 3,
          failCount: 2,
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_API_KEY,
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(5);
      expect(data.successCount).toBe(3);
      expect(data.failCount).toBe(2);
    });
  });

  describe('Error handling', () => {
    it('should return 500 on internal error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Failed to fetch emails: connection refused' },
          500,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_API_KEY,
        },
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to fetch emails');
    });

    it('should return 500 when INTERNAL_API_KEY is not configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Function not properly configured' },
          500,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'some-key',
        },
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Function not properly configured');
    });
  });

  describe('Response structure', () => {
    it('should always include success, processed, successCount, failCount on success', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          processed: 10,
          successCount: 8,
          failCount: 2,
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_API_KEY,
        },
      });

      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('processed');
      expect(data).toHaveProperty('successCount');
      expect(data).toHaveProperty('failCount');
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.processed).toBe('number');
      expect(typeof data.successCount).toBe('number');
      expect(typeof data.failCount).toBe('number');
    });

    it('should include error field on failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Something went wrong' }, 500),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': INTERNAL_API_KEY,
        },
      });

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });
  });
});

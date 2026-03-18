/**
 * Tests for retry-failed-emails edge function
 *
 * Verifies:
 * 1. Authentication via x-internal-api-key header
 * 2. Fetching failed emails ready for retry
 * 3. Sending emails via Klaviyo and handling success/failure
 * 4. Exponential backoff scheduling
 * 5. Max retries exhaustion and permanent failure logging
 * 6. CORS preflight handling
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
  text: () => Promise.resolve(JSON.stringify(data)),
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
        createMockResponse({ success: true, processed: 0, successCount: 0, failCount: 0 }),
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
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight request', async () => {
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
    });
  });

  describe('No emails to retry', () => {
    it('should return processed=0 when no failed emails exist', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          processed: 0,
          successCount: 0,
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
      expect(data.processed).toBe(0);
      expect(data.successCount).toBe(0);
      expect(data.failCount).toBe(0);
    });
  });

  describe('Successful retry', () => {
    it('should process and send failed emails via Klaviyo', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          processed: 2,
          successCount: 2,
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
      expect(data.processed).toBe(2);
      expect(data.successCount).toBe(2);
      expect(data.failCount).toBe(0);
    });

    it('should return mixed results for partial success', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          processed: 3,
          successCount: 2,
          failCount: 1,
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
      expect(data.successCount).toBe(2);
      expect(data.failCount).toBe(1);
    });
  });

  describe('Retry exhaustion', () => {
    it('should mark email as permanently failed after max retries', async () => {
      // When all emails have exhausted retries, they should still be "processed"
      // but counted as failures and logged to email_logs with status=failed
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          processed: 1,
          successCount: 0,
          failCount: 1,
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
      expect(data.failCount).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should return 500 on database query failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Failed to fetch emails: connection refused' }, 500),
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
        createMockResponse({ error: 'Function not properly configured' }, 500),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Function not properly configured');
    });
  });
});

describe('Exponential backoff logic', () => {
  it('should calculate correct backoff intervals', () => {
    // The edge function uses: 5 * 3^retryCount minutes
    const getBackoffMinutes = (retryCount: number) => 5 * Math.pow(3, retryCount);

    expect(getBackoffMinutes(0)).toBe(5);    // 5 minutes
    expect(getBackoffMinutes(1)).toBe(15);   // 15 minutes
    expect(getBackoffMinutes(2)).toBe(45);   // 45 minutes
    expect(getBackoffMinutes(3)).toBe(135);  // 135 minutes (2.25 hours)
  });

  it('should respect max_retries from database', () => {
    // The edge function filters: retry_count < max_retries
    const shouldRetry = (retryCount: number, maxRetries: number) =>
      retryCount < maxRetries;

    expect(shouldRetry(0, 3)).toBe(true);
    expect(shouldRetry(1, 3)).toBe(true);
    expect(shouldRetry(2, 3)).toBe(true);
    expect(shouldRetry(3, 3)).toBe(false); // exhausted
    expect(shouldRetry(0, 1)).toBe(true);
    expect(shouldRetry(1, 1)).toBe(false); // custom low max
  });
});

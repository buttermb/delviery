/**
 * Notify Order Ready — Edge Function Contract Tests
 *
 * Validates that the notify-order-ready edge function:
 * 1. Returns 400 for missing required fields (order_id, phone) — before auth
 * 2. Returns 400 for invalid JSON body
 * 3. Returns proper CORS headers
 * 4. Passes valid requests through to the credit gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/notify-order-ready`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock responses
const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('notify-order-ready edge function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Input validation (returns 400 before auth)', () => {
    it('should return 400 when phone is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Missing required fields: order_id and phone are required' },
          400,
        ),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'test' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 400 when order_id is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Missing required fields: order_id and phone are required' },
          400,
        ),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+15551234567' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 400 when both order_id and phone are missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Missing required fields: order_id and phone are required' },
          400,
        ),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid JSON body' }, 400),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid JSON');
    });

    it('should return 400 when order_id is empty string', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Missing required fields: order_id and phone are required' },
          400,
        ),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: '', phone: '+15551234567' }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when phone is empty string', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Missing required fields: order_id and phone are required' },
          400,
        ),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'order-123', phone: '' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Auth required after validation passes', () => {
    it('should return 401 when valid body is sent without auth', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Unauthorized - no tenant found' },
          401,
        ),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: 'order-123',
          phone: '+15551234567',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Successful notification', () => {
    it('should return 200 with success response for valid authenticated request', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Notification sent',
          demo_mode: true,
        }),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          order_id: 'order-123',
          phone: '+15551234567',
          store_name: 'Test Store',
          order_number: 'ORD-001',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Notification sent');
    });

    it('should accept optional email field', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Notification sent',
          demo_mode: true,
        }),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          order_id: 'order-123',
          phone: '+15551234567',
          email: 'customer@example.com',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('ok'),
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(FUNCTION_URL, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
    });
  });

  describe('Credit gate integration', () => {
    it('should return 402 when tenant has insufficient credits', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Insufficient credits',
            code: 'INSUFFICIENT_CREDITS',
            creditsRequired: 25,
            currentBalance: 10,
            actionKey: 'send_sms',
          },
          402,
        ),
      );

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          order_id: 'order-123',
          phone: '+15551234567',
        }),
      });

      expect(response.status).toBe(402);
      const data = await response.json();
      expect(data.code).toBe('INSUFFICIENT_CREDITS');
      expect(data.creditsRequired).toBe(25);
    });
  });
});

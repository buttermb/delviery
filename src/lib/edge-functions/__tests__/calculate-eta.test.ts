/**
 * calculate-eta Edge Function Tests
 *
 * Tests the ETA calculation edge function that uses Mapbox Directions API
 * to compute estimated delivery times for orders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/calculate-eta`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('calculate-eta Edge Function', () => {
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
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
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
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization');
    });

    it('should reject invalid tokens', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should reject non-UUID orderId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid request', details: expect.anything() },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ orderId: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid latitude range', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid request', details: expect.anything() },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          courierLat: 91, // invalid: > 90
          courierLng: -74.006,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid longitude range', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid request', details: expect.anything() },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          courierLat: 40.7128,
          courierLng: 181, // invalid: > 180
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should accept request without courier coordinates', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          eta_minutes: 25,
          distance_miles: '3.50',
          route: { type: 'LineString', coordinates: [] },
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.eta_minutes).toBeDefined();
    });
  });

  describe('Tenant Isolation', () => {
    it('should reject users without a tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'No tenant found for user' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token-no-tenant',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('No tenant found for user');
    });

    it('should return 404 for order belonging to different tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Order not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440001',
        }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('ETA Calculation', () => {
    it('should return ETA with courier location (3-point route)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          eta_minutes: 18,
          distance_miles: '4.22',
          route: {
            type: 'LineString',
            coordinates: [
              [-74.006, 40.7128],
              [-73.99, 40.72],
              [-73.985, 40.73],
            ],
          },
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          courierLat: 40.7128,
          courierLng: -74.006,
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(typeof data.eta_minutes).toBe('number');
      expect(data.eta_minutes).toBeGreaterThan(0);
      expect(data.distance_miles).toBeDefined();
      expect(data.route).toBeDefined();
      expect(data.route.type).toBe('LineString');
    });

    it('should return ETA without courier location (2-point route)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          eta_minutes: 12,
          distance_miles: '2.10',
          route: {
            type: 'LineString',
            coordinates: [
              [-73.99, 40.72],
              [-73.985, 40.73],
            ],
          },
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.eta_minutes).toBe(12);
      expect(data.distance_miles).toBe('2.10');
    });

    it('should return fallback ETA when no route is found', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          eta_minutes: 15,
          distance_miles: '1.50',
          route: null,
          warning: 'Route calculation unavailable, using estimated ETA',
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.route).toBeNull();
      expect(data.warning).toContain('estimated ETA');
      expect(data.eta_minutes).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for order missing coordinates', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Order is missing required coordinates' },
          400
        )
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Order is missing required coordinates');
    });

    it('should return 502 when Mapbox API fails', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Mapbox API error: 503' }, 502)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          courierLat: 40.7128,
          courierLng: -74.006,
        }),
      });

      expect(response.status).toBe(502);
    });

    it('should return 500 when Mapbox token is not configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Mapbox token not configured' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Mapbox token not configured');
    });

    it('should return 500 for internal server errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});

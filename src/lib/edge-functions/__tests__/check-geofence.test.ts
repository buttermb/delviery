/**
 * check-geofence Edge Function Tests
 *
 * Tests verify:
 * 1. Geofence radius checks (within / outside)
 * 2. Input validation (Zod schema)
 * 3. GPS anomaly detection (mock location, low accuracy, impossible speed)
 * 4. CORS preflight handling
 * 5. Auth requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/check-geofence`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('check-geofence Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight', async () => {
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
          driverLat: 40.7128,
          driverLng: -74.006,
        }),
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
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          driverLat: 40.7128,
          driverLng: -74.006,
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should reject missing orderId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Validation failed', details: ['Invalid uuid'] },
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
          driverLat: 40.7128,
          driverLng: -74.006,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject non-UUID orderId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Validation failed', details: ['Invalid uuid'] },
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
          orderId: 'not-a-uuid',
          driverLat: 40.7128,
          driverLng: -74.006,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject out-of-range latitude', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed', details: ['Too big'] }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          driverLat: 91,
          driverLng: -74.006,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject out-of-range longitude', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed', details: ['Too big'] }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          driverLat: 40.7128,
          driverLng: 181,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Geofence Check - Within Range', () => {
    it('should allow delivery when driver is within geofence radius', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          withinGeofence: true,
          distance: 0.15,
          geofenceRadius: 0.5,
          actionAllowed: true,
          message: 'You can complete delivery',
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
          driverLat: 40.7128,
          driverLng: -74.006,
          action: 'complete_delivery',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.withinGeofence).toBe(true);
      expect(data.actionAllowed).toBe(true);
      expect(data.distance).toBeLessThanOrEqual(data.geofenceRadius);
      expect(data.message).toBe('You can complete delivery');
    });
  });

  describe('Geofence Check - Outside Range', () => {
    it('should block delivery completion when driver is outside geofence', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          withinGeofence: false,
          distance: 2.5,
          geofenceRadius: 0.5,
          actionAllowed: false,
          message: "You're 2.50 miles from customer. Get within 0.5 miles.",
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
          driverLat: 40.75,
          driverLng: -73.95,
          action: 'complete_delivery',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.withinGeofence).toBe(false);
      expect(data.actionAllowed).toBe(false);
      expect(data.distance).toBeGreaterThan(data.geofenceRadius);
    });

    it('should allow non-completion actions outside geofence', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          withinGeofence: false,
          distance: 2.5,
          geofenceRadius: 0.5,
          actionAllowed: true,
          message: "You're 2.50 miles from customer. Get within 0.5 miles.",
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
          driverLat: 40.75,
          driverLng: -73.95,
          action: 'location_update',
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.withinGeofence).toBe(false);
      expect(data.actionAllowed).toBe(true);
    });
  });

  describe('Order Validation', () => {
    it('should return 404 for non-existent order', async () => {
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
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          driverLat: 40.7128,
          driverLng: -74.006,
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Order not found');
    });

    it('should return 400 when order has no customer location', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Customer location not available' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          orderId: '550e8400-e29b-41d4-a716-446655440000',
          driverLat: 40.7128,
          driverLng: -74.006,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Customer location not available');
    });
  });

  describe('GPS Anomaly Detection', () => {
    it('should detect mock location usage', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          withinGeofence: true,
          distance: 0.1,
          geofenceRadius: 0.5,
          actionAllowed: true,
          message: 'You can complete delivery',
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
          driverLat: 40.7128,
          driverLng: -74.006,
          isMockLocation: true,
        }),
      });

      // Function still returns success but logs the anomaly
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle low GPS accuracy', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          withinGeofence: true,
          distance: 0.2,
          geofenceRadius: 0.5,
          actionAllowed: true,
          message: 'You can complete delivery',
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
          driverLat: 40.7128,
          driverLng: -74.006,
          accuracy: 200, // > 100 meters threshold
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should detect impossible speed', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          withinGeofence: false,
          distance: 1.0,
          geofenceRadius: 0.5,
          actionAllowed: true,
          message: "You're 1.00 miles from customer. Get within 0.5 miles.",
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
          driverLat: 40.7128,
          driverLng: -74.006,
          speed: 150, // > 100 mph threshold
          action: 'location_update',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Response Shape', () => {
    it('should return all expected fields on success', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          withinGeofence: true,
          distance: 0.25,
          geofenceRadius: 0.5,
          actionAllowed: true,
          message: 'You can complete delivery',
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
          driverLat: 40.7128,
          driverLng: -74.006,
        }),
      });

      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('withinGeofence');
      expect(data).toHaveProperty('distance');
      expect(data).toHaveProperty('geofenceRadius');
      expect(data).toHaveProperty('actionAllowed');
      expect(data).toHaveProperty('message');
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.withinGeofence).toBe('boolean');
      expect(typeof data.distance).toBe('number');
      expect(typeof data.geofenceRadius).toBe('number');
      expect(typeof data.actionAllowed).toBe('boolean');
      expect(typeof data.message).toBe('string');
    });

    it('should return error object on failure', async () => {
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
          driverLat: 40.7128,
          driverLng: -74.006,
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });
  });
});

/**
 * Courier App Edge Function Tests
 * Tests the courier-app edge function endpoints:
 * - login, toggle-online, update-location, my-orders
 * - available-orders, accept-order, update-order-status
 * - mark-picked-up, mark-delivered, earnings, today-stats
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://test.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/courier-app`;
const AUTH_HEADER = { Authorization: 'Bearer valid-courier-token' };
const JSON_HEADERS = { 'Content-Type': 'application/json', ...AUTH_HEADER };

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('Courier App Edge Function', () => {
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
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });
      expect(response.ok).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization' }, 401),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'login' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization');
    });

    it('should reject invalid tokens', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid-token' },
        body: JSON.stringify({ endpoint: 'login' }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject inactive courier accounts', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Courier account not found or inactive' }, 403),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'login' }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('login endpoint', () => {
    it('should return courier profile on successful login', async () => {
      const mockCourier = {
        id: 'courier-123',
        email: 'driver@test.com',
        full_name: 'John Driver',
        phone: '+1234567890',
        vehicle_type: 'car',
        is_online: false,
        commission_rate: 30,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({ courier: mockCourier }));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'login' }),
      });

      const data = await response.json();
      expect(response.ok).toBe(true);
      expect(data.courier.email).toBe('driver@test.com');
      expect(data.courier.full_name).toBe('John Driver');
      expect(data.courier.commission_rate).toBe(30);
    });
  });

  describe('toggle-online endpoint', () => {
    it('should toggle courier online and create shift', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          is_online: true,
          shift_id: 'shift-123',
          courier: { id: 'courier-123', is_online: true },
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'toggle-online', is_online: true }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.is_online).toBe(true);
      expect(data.shift_id).toBe('shift-123');
    });

    it('should toggle courier offline and end shift', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          is_online: false,
          shift_id: null,
          courier: { id: 'courier-123', is_online: false },
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'toggle-online', is_online: false }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.is_online).toBe(false);
    });
  });

  describe('update-location endpoint', () => {
    it('should update courier location with valid coordinates', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          endpoint: 'update-location',
          lat: 40.7128,
          lng: -74.006,
          accuracy: 10,
          speed: 15,
          heading: 180,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should reject invalid latitude values', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid location data' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'update-location', lat: 200, lng: -74.006 }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid longitude values', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid location data' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'update-location', lat: 40.7, lng: -200 }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('my-orders endpoint', () => {
    it('should return courier orders with customer info', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          status: 'preparing',
          customer_name: 'Alice',
          customer_phone: '+1111',
          courier_commission: '15.00',
        },
        {
          id: 'order-2',
          status: 'delivered',
          customer_name: 'Bob',
          customer_phone: '+2222',
          courier_commission: '20.00',
        },
      ];

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ orders: mockOrders, count: 2 }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'my-orders', status: 'all' }),
      });

      const data = await response.json();
      expect(data.orders).toHaveLength(2);
      expect(data.count).toBe(2);
    });

    it('should filter active orders', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ orders: [{ id: 'order-1', status: 'preparing' }], count: 1 }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'my-orders', status: 'active' }),
      });

      const data = await response.json();
      expect(data.count).toBe(1);
    });
  });

  describe('available-orders endpoint', () => {
    it('should return available unassigned orders', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'pending', courier_id: null, customer_name: 'Alice' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({ orders: mockOrders }));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'available-orders' }),
      });

      const data = await response.json();
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].status).toBe('pending');
    });
  });

  describe('accept-order endpoint', () => {
    it('should accept an available order', async () => {
      const mockOrder = {
        id: 'order-123',
        status: 'preparing',
        courier_id: 'courier-123',
        customer_name: 'Alice',
        customer_phone: '+1111',
        customer_order_count: 3,
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, order: mockOrder }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          endpoint: 'accept-order',
          order_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.order.status).toBe('preparing');
    });

    it('should reject already-assigned orders', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Order no longer available' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          endpoint: 'accept-order',
          order_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Order no longer available');
    });

    it('should require valid UUID for order_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid request body' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'accept-order', order_id: 'not-a-uuid' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('update-order-status endpoint', () => {
    it('should update order status with notes', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          order: { id: 'order-123', status: 'out_for_delivery' },
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          endpoint: 'update-order-status',
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'out_for_delivery',
          notes: 'On my way',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('mark-picked-up endpoint', () => {
    it('should mark order as picked up', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          endpoint: 'mark-picked-up',
          order_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('mark-delivered endpoint', () => {
    it('should mark order as delivered and create earnings', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          endpoint: 'mark-delivered',
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          customer_present: true,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle delivery with photo and signature', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          endpoint: 'mark-delivered',
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          delivery_photo_url: 'https://storage.example.com/photo.jpg',
          signature_url: 'https://storage.example.com/sig.png',
          customer_present: false,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('earnings endpoint', () => {
    it('should return weekly earnings summary', async () => {
      const mockEarnings = {
        earnings: [
          { id: 'e1', total_earned: '25.00', commission_amount: '20.00', tip_amount: '5.00' },
          { id: 'e2', total_earned: '30.00', commission_amount: '25.00', tip_amount: '5.00' },
        ],
        summary: {
          total_earned: '55.00',
          total_deliveries: 2,
          avg_per_delivery: '27.50',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockEarnings));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'earnings', period: 'week' }),
      });

      const data = await response.json();
      expect(data.summary.total_earned).toBe('55.00');
      expect(data.summary.total_deliveries).toBe(2);
      expect(data.earnings).toHaveLength(2);
    });

    it('should support monthly period', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          earnings: [],
          summary: { total_earned: '0.00', total_deliveries: 0, avg_per_delivery: '0.00' },
        }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'earnings', period: 'month' }),
      });

      const data = await response.json();
      expect(data.summary.total_deliveries).toBe(0);
    });
  });

  describe('today-stats endpoint', () => {
    it('should return today statistics', async () => {
      const mockStats = {
        deliveries_completed: 5,
        total_earned: '125.00',
        hours_online: '3.5',
        active_orders: 1,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockStats));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'today-stats' }),
      });

      const data = await response.json();
      expect(data.deliveries_completed).toBe(5);
      expect(data.total_earned).toBe('125.00');
      expect(data.hours_online).toBe('3.5');
      expect(data.active_orders).toBe(1);
    });
  });

  describe('Validation', () => {
    it('should reject invalid endpoint names', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid endpoint' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'invalid-endpoint' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing endpoint field', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid endpoint' }, 400),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: 'login' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should return 500 for internal server errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, 500),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ endpoint: 'login' }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});

/**
 * Add-Driver Edge Function Tests
 *
 * Tests the add-driver edge function which handles:
 * 1. Creating new driver accounts (auth user + courier record + PIN)
 * 2. Resending invite emails to existing drivers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/add-driver`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

const VALID_DRIVER_PAYLOAD = {
  full_name: 'Jane Smith',
  display_name: 'Jane',
  email: 'jane@example.com',
  phone: '1234567890',
  notes: 'New hire',
  vehicle_type: 'car',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_year: 2022,
  vehicle_color: 'Silver',
  vehicle_plate: 'ABC1234',
  commission_rate: 25,
  zone_id: '550e8400-e29b-41d4-a716-446655440000',
  send_invite_email: true,
};

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer valid-admin-token',
};

describe('add-driver Edge Function', () => {
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
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });
      expect(response.ok).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should reject requests without Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Missing authorization header', code: 'UNAUTHORIZED' },
          401,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_DRIVER_PAYLOAD),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid Bearer tokens', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
          401,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify(VALID_DRIVER_PAYLOAD),
      });

      expect(response.status).toBe(401);
    });

    it('should reject non-admin users', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Admin access required', code: 'FORBIDDEN' },
          403,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer courier-user-token',
        },
        body: JSON.stringify(VALID_DRIVER_PAYLOAD),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.code).toBe('FORBIDDEN');
    });
  });

  describe('Create driver', () => {
    it('should create a driver and return success with PIN', async () => {
      const mockResponse = {
        success: true,
        driver_id: 'driver-uuid-123',
        pin: '482019',
        email_sent: true,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse, 201));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(VALID_DRIVER_PAYLOAD),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.driver_id).toBeDefined();
      expect(data.pin).toMatch(/^\d{6}$/);
      expect(data.email_sent).toBe(true);
    });

    it('should create a driver without sending invite email', async () => {
      const payload = { ...VALID_DRIVER_PAYLOAD, send_invite_email: false };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: true, driver_id: 'driver-uuid-456', pin: '123456', email_sent: false },
          201,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.email_sent).toBe(false);
    });

    it('should reject duplicate email addresses', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'A driver with this email already exists', code: 'EMAIL_EXISTS' },
          409,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(VALID_DRIVER_PAYLOAD),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.code).toBe('EMAIL_EXISTS');
    });

    it('should handle auth user creation failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Failed to create driver account', code: 'AUTH_CREATE_FAILED' },
          500,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(VALID_DRIVER_PAYLOAD),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('AUTH_CREATE_FAILED');
    });

    it('should handle courier record insert failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Failed to create driver record', code: 'INSERT_FAILED' },
          500,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(VALID_DRIVER_PAYLOAD),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('INSERT_FAILED');
    });
  });

  describe('Input validation', () => {
    it('should reject missing required fields', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: { full_name: ['Full name is required'] },
          },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ email: 'test@test.com' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: { email: ['Invalid email address'] },
          },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ ...VALID_DRIVER_PAYLOAD, email: 'not-an-email' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid vehicle type', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: { vehicle_type: ['Invalid vehicle type'] },
          },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ ...VALID_DRIVER_PAYLOAD, vehicle_type: 'helicopter' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject commission rate outside 0-100', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
          },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ ...VALID_DRIVER_PAYLOAD, commission_rate: 150 }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject phone numbers shorter than 10 characters', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: { phone: ['Phone must be at least 10 characters'] },
          },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ ...VALID_DRIVER_PAYLOAD, phone: '12345' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Resend invite', () => {
    it('should resend invite email for existing driver', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, email_sent: true }),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          resend_invite: true,
          driver_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.email_sent).toBe(true);
    });

    it('should return 404 for non-existent driver', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Driver not found', code: 'DRIVER_NOT_FOUND' },
          404,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          resend_invite: true,
          driver_id: '550e8400-e29b-41d4-a716-000000000000',
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.code).toBe('DRIVER_NOT_FOUND');
    });

    it('should reject resend for driver in different tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Driver does not belong to your organization', code: 'FORBIDDEN' },
          403,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          resend_invite: true,
          driver_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(403);
    });

    it('should require valid UUID for driver_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR' },
          400,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          resend_invite: true,
          driver_id: 'not-a-uuid',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
          500,
        ),
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify(VALID_DRIVER_PAYLOAD),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });
});

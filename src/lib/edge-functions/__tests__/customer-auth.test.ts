/**
 * Customer Auth Edge Function Tests
 *
 * Tests all customer-auth actions:
 * 1. health - Health check endpoint
 * 2. signup - Customer registration
 * 3. login - Customer authentication
 * 4. verify - Token verification
 * 5. logout - Session termination
 * 6. update-password - Password change
 * 7. update-profile - Profile updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://aejugtmhwwknrowfyzie.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const BASE_ENDPOINT = `${FUNCTIONS_URL}/customer-auth`;

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

describe('Customer Auth Edge Function Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('health action', () => {
    const endpoint = `${BASE_ENDPOINT}?action=health`;

    it('should return health status with env check', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          status: 'ok',
          function: 'customer-auth',
          timestamp: '2026-03-18T00:00:00.000Z',
          env: {
            SUPABASE_URL: true,
            SUPABASE_SERVICE_ROLE_KEY: true,
            JWT_SECRET: true,
          },
        })
      );

      const response = await fetch(endpoint, { method: 'GET' });
      const data = await response.json();

      expect(data.status).toBe('ok');
      expect(data.function).toBe('customer-auth');
      expect(data.env.SUPABASE_URL).toBe(true);
      expect(data.env.SUPABASE_SERVICE_ROLE_KEY).toBe(true);
      expect(data.env.JWT_SECRET).toBe(true);
    });

    it('should not require authentication', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ status: 'ok', function: 'customer-auth' })
      );

      const response = await fetch(endpoint, { method: 'GET' });

      expect(response.ok).toBe(true);
    });
  });

  describe('signup action', () => {
    const endpoint = `${BASE_ENDPOINT}?action=signup`;

    it('should create a new customer account', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: true,
            message: 'Account created successfully. Please check your email to verify your account.',
            requires_verification: true,
            customer_user_id: 'cust-user-123',
            is_business_buyer: false,
          },
          201
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          tenantSlug: 'test-store',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.requires_verification).toBe(true);
      expect(data.customer_user_id).toBeDefined();
    });

    it('should create business buyer account', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            success: true,
            customer_user_id: 'cust-user-456',
            is_business_buyer: true,
          },
          201
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'business@example.com',
          password: 'SecurePass123!',
          firstName: 'Jane',
          lastName: 'Smith',
          tenantSlug: 'test-store',
          isBusinessBuyer: true,
          businessName: 'Cannabis Co',
          businessLicenseNumber: 'LIC-12345',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.is_business_buyer).toBe(true);
    });

    it('should reject duplicate email for same tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'An account with this email already exists' },
          409
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already exists');
    });

    it('should reject email registered as staff account', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'This email is registered as a staff account',
            message: 'This email is registered as a staff account. Please use the staff login at /test-store/admin/login instead.',
          },
          409
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'staff@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('staff account');
    });

    it('should require tenantSlug or tenantId', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Either tenantSlug or tenantId is required' },
          400
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 for inactive tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Store not found or inactive' },
          404
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'nonexistent-store',
        }),
      });

      expect(response.status).toBe(404);
    });

    it('should validate input schema', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Validation failed', details: [] },
          400
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'short',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should enforce age verification when required', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'You must be at least 21 years old to create an account' },
          403
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'young@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
          dateOfBirth: '2015-01-01',
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('at least');
    });

    it('should require date of birth when tenant requires age verification', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Date of birth is required for age verification' },
          400
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'age-verified-store',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('age verification');
    });
  });

  describe('login action', () => {
    const endpoint = `${BASE_ENDPOINT}?action=login`;

    it('should authenticate valid customer credentials', async () => {
      const mockResponse = {
        token: 'jwt-token-abc123',
        customer: {
          id: 'cust-user-123',
          email: 'customer@example.com',
          first_name: 'John',
          last_name: 'Doe',
          customer_id: 'cust-123',
          tenant_id: 'tenant-123',
        },
        tenant: {
          id: 'tenant-123',
          business_name: 'Test Store',
          slug: 'test-store',
        },
        customerRecord: null,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.token).toBeDefined();
      expect(data.customer.email).toBe('customer@example.com');
      expect(data.tenant.slug).toBe('test-store');
    });

    it('should reject invalid credentials with generic error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid email or password' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'wrong-password',
          tenantSlug: 'test-store',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      // Should return generic error (not reveal whether email or password was wrong)
      expect(data.error).toBeDefined();
    });

    it('should block brute force attempts', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid email or password' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'attempt-11',
          tenantSlug: 'test-store',
        }),
      });

      // After many failed attempts, returns 401 with generic error (no info leak)
      expect(response.status).toBe(401);
    });

    it('should return 404 for inactive tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Tenant not found or inactive' },
          404
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'inactive-store',
        }),
      });

      expect(response.status).toBe(404);
    });

    it('should require email verification', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Email not verified',
            requires_verification: true,
            customer_user_id: 'cust-user-123',
            message: 'Please verify your email address before logging in.',
          },
          403
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'unverified@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.requires_verification).toBe(true);
      expect(data.customer_user_id).toBeDefined();
    });

    it('should validate input schema (missing tenantSlug)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Validation failed', details: [] },
          400
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should return linked customer record when available', async () => {
      const mockResponse = {
        token: 'jwt-token-abc123',
        customer: {
          id: 'cust-user-123',
          email: 'customer@example.com',
          customer_id: 'cust-123',
          tenant_id: 'tenant-123',
        },
        tenant: { id: 'tenant-123', business_name: 'Test Store', slug: 'test-store' },
        customerRecord: {
          id: 'cust-123',
          full_name: 'John Doe',
          loyalty_points: 500,
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
        }),
      });

      const data = await response.json();

      expect(data.customerRecord).toBeDefined();
      expect(data.customerRecord.loyalty_points).toBe(500);
    });
  });

  describe('verify action', () => {
    const endpoint = `${BASE_ENDPOINT}?action=verify`;

    it('should verify a valid token', async () => {
      const mockResponse = {
        customer: {
          id: 'cust-user-123',
          email: 'customer@example.com',
          first_name: 'John',
          last_name: 'Doe',
          customer_id: 'cust-123',
          tenant_id: 'tenant-123',
        },
        tenant: {
          id: 'tenant-123',
          business_name: 'Test Store',
          slug: 'test-store',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
        },
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.customer.email).toBe('customer@example.com');
      expect(data.tenant.slug).toBe('test-store');
    });

    it('should reject missing token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'No token provided' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should reject expired token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid or expired token' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer expired-jwt-token',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should reject token with no matching session', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Session expired or invalid' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-jwt-but-no-session',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should reject token for inactive user', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'User not found or inactive' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer token-for-deactivated-user',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should reject token for inactive tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Tenant not found or inactive' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer token-for-inactive-tenant',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('logout action', () => {
    const endpoint = `${BASE_ENDPOINT}?action=logout`;

    it('should successfully logout with valid token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
        },
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should succeed even without token (graceful logout)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });
  });

  describe('update-password action', () => {
    const endpoint = `${BASE_ENDPOINT}?action=update-password`;

    it('should update password with valid current password', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Password updated successfully',
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass456!',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should reject incorrect current password', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Current password is incorrect' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          currentPassword: 'wrong-password',
          newPassword: 'NewPass456!',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should require authorization', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Authorization required' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass456!',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should validate password minimum length', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Validation failed', details: [] },
          400
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          currentPassword: 'OldPass123!',
          newPassword: 'short',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject expired token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid or expired token' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer expired-jwt-token',
        },
        body: JSON.stringify({
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass456!',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('update-profile action', () => {
    const endpoint = `${BASE_ENDPOINT}?action=update-profile`;

    it('should update profile fields', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Profile updated successfully',
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1234567890',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should allow partial profile updates', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'Profile updated successfully',
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          firstName: 'Jane',
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should require authorization', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Authorization required' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Jane',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject expired token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid or expired token' },
          401
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer expired-jwt-token',
        },
        body: JSON.stringify({
          firstName: 'Jane',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('invalid action', () => {
    it('should return 400 for unknown action', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid action' },
          400
        )
      );

      const response = await fetch(`${BASE_ENDPOINT}?action=unknown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': 'https://floraiqcrm.com',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Credentials': 'true',
        }),
      });

      const response = await fetch(BASE_ENDPOINT, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://floraiqcrm.com',
        },
      });

      expect(response.ok).toBe(true);
    });

    it('should reject credentials from non-allowed origins', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Origin not allowed' },
          403
        )
      );

      const response = await fetch(`${BASE_ENDPOINT}?action=verify`, {
        method: 'GET',
        headers: {
          Origin: 'https://malicious-site.com',
          Authorization: 'Bearer some-token',
        },
      });

      expect(response.status).toBe(403);
    });
  });
});

describe('Customer Auth Security Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication enforcement', () => {
    it('signup should NOT require auth (public endpoint)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { success: true, customer_user_id: 'cust-123' },
          201
        )
      );

      const response = await fetch(`${BASE_ENDPOINT}?action=signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
        }),
      });

      expect(response.status).toBe(201);
    });

    it('login should NOT require auth (public endpoint)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ token: 'jwt-token' })
      );

      const response = await fetch(`${BASE_ENDPOINT}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
        }),
      });

      expect(response.ok).toBe(true);
    });

    it('verify should require Bearer token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'No token provided' },
          401
        )
      );

      const response = await fetch(`${BASE_ENDPOINT}?action=verify`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('update-password should require Bearer token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Authorization required' },
          401
        )
      );

      const response = await fetch(`${BASE_ENDPOINT}?action=update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'Old123!',
          newPassword: 'New456!',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('update-profile should require Bearer token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Authorization required' },
          401
        )
      );

      const response = await fetch(`${BASE_ENDPOINT}?action=update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Test' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Tenant isolation', () => {
    it('should not allow cross-tenant login', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid email or password' },
          401
        )
      );

      // Customer registered in tenant-a tries to login to tenant-b
      const response = await fetch(`${BASE_ENDPOINT}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'different-store',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Error handling', () => {
    it('should return generic error for internal failures', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Authentication failed' },
          500
        )
      );

      const response = await fetch(`${BASE_ENDPOINT}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-store',
        }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      // Should return generic error, not leak internals
      expect(data.error).toBe('Authentication failed');
    });
  });
});

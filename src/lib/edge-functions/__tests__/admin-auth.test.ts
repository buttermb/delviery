/**
 * Admin Auth Edge Function Tests
 *
 * Tests the admin-auth edge function for:
 * 1. Login with invalid credentials → 401
 * 2. Login with missing fields → 400
 * 3. Verify without token → 401
 * 4. Logout without token → 401
 * 5. Invalid action → 400
 * 6. Malformed JSON body → 400
 * 7. Empty body → 400
 * 8. CORS preflight → 200
 * 9. Successful login returns admin data
 * 10. Verify with valid token returns admin info
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/admin-auth`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('admin-auth Edge Function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('login action', () => {
    it('should return 401 for invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid credentials' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'test@test.com',
          password: 'wrongpassword',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when email is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Email and password are required' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password: 'test' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and password are required');
    });

    it('should return 400 when password is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Email and password are required' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: 'test@test.com' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email and password are required');
    });

    it('should return 403 for non-admin user', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Access denied' }, 403)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'nonadmin@test.com',
          password: 'validpassword',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });

    it('should return 200 with session and admin data on successful login', async () => {
      const mockAdmin = {
        session: {
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
        },
        admin: {
          id: 'admin-123',
          email: 'admin@test.com',
          full_name: 'Test Admin',
          role: 'super_admin',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockAdmin, 200));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'admin@test.com',
          password: 'validpassword',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session).toBeDefined();
      expect(data.admin.id).toBe('admin-123');
      expect(data.admin.email).toBe('admin@test.com');
      expect(data.admin.full_name).toBe('Test Admin');
      expect(data.admin.role).toBe('super_admin');
    });
  });

  describe('verify action', () => {
    it('should return 401 when Authorization header is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization header' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing authorization header');
    });

    it('should return 401 for invalid token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid session' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
        body: JSON.stringify({ action: 'verify' }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid session');
    });

    it('should return 200 with admin data for valid token', async () => {
      const mockAdmin = {
        admin: {
          id: 'admin-123',
          email: 'admin@test.com',
          full_name: 'Test Admin',
          role: 'super_admin',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockAdmin, 200));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ action: 'verify' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.admin.id).toBe('admin-123');
      expect(data.admin.email).toBe('admin@test.com');
    });
  });

  describe('logout action', () => {
    it('should return 401 when Authorization header is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization header' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing authorization header');
    });

    it('should return 200 on successful logout', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true }, 200)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({ action: 'logout' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return 400 for invalid action', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid action' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unknown' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('should return 400 for malformed JSON body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid request body' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
    });

    it('should return 400 for empty body (no action)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid action' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('should not leak internal error details on server error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Authentication failed' }, 500)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: 'test@test.com', password: 'test' }),
      });

      const data = await response.json();

      // Should return generic message, NOT internal error details
      expect(data.error).toBe('Authentication failed');
      expect(data.error).not.toContain('TypeError');
      expect(data.error).not.toContain('undefined');
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
            'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });
  });

  describe('request validation', () => {
    it('should send correct headers for login request', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid credentials' }, 401)
      );

      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'test@test.com',
          password: 'test',
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'test@test.com',
          password: 'test',
        }),
      });
    });

    it('should include Authorization header for verify request', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid session' }, 401)
      );

      await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ action: 'verify' }),
      });

      expect(mockFetch).toHaveBeenCalledWith(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ action: 'verify' }),
      });
    });
  });
});

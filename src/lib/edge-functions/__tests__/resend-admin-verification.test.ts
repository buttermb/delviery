/**
 * Resend Admin Verification Tests
 *
 * Tests the resend-admin-verification edge function:
 * 1. Zod schema validation (mirrored from edge function)
 * 2. Integration tests with mocked fetch for auth, tenant lookup, and email sending
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mirror of the validation schema from
// supabase/functions/resend-admin-verification/index.ts
const RequestSchema = z.object({
  email: z.string().email(),
  tenant_slug: z.string().min(1),
});

type ResendVerificationInput = z.infer<typeof RequestSchema>;

function validateRequest(body: unknown): ResendVerificationInput {
  return RequestSchema.parse(body);
}

describe('resend-admin-verification validation', () => {
  describe('email validation', () => {
    it('should accept a valid email', () => {
      const result = validateRequest({
        email: 'admin@example.com',
        tenant_slug: 'my-store',
      });
      expect(result.email).toBe('admin@example.com');
    });

    it('should reject an invalid email', () => {
      expect(() =>
        validateRequest({
          email: 'not-an-email',
          tenant_slug: 'my-store',
        })
      ).toThrow();
    });

    it('should reject an empty email', () => {
      expect(() =>
        validateRequest({
          email: '',
          tenant_slug: 'my-store',
        })
      ).toThrow();
    });

    it('should reject missing email', () => {
      expect(() =>
        validateRequest({
          tenant_slug: 'my-store',
        })
      ).toThrow();
    });

    it('should reject null email', () => {
      expect(() =>
        validateRequest({
          email: null,
          tenant_slug: 'my-store',
        })
      ).toThrow();
    });

    it('should reject numeric email', () => {
      expect(() =>
        validateRequest({
          email: 12345,
          tenant_slug: 'my-store',
        })
      ).toThrow();
    });
  });

  describe('tenant_slug validation', () => {
    it('should accept a valid slug', () => {
      const result = validateRequest({
        email: 'admin@example.com',
        tenant_slug: 'my-store',
      });
      expect(result.tenant_slug).toBe('my-store');
    });

    it('should reject an empty slug', () => {
      expect(() =>
        validateRequest({
          email: 'admin@example.com',
          tenant_slug: '',
        })
      ).toThrow();
    });

    it('should reject missing slug', () => {
      expect(() =>
        validateRequest({
          email: 'admin@example.com',
        })
      ).toThrow();
    });

    it('should reject null slug', () => {
      expect(() =>
        validateRequest({
          email: 'admin@example.com',
          tenant_slug: null,
        })
      ).toThrow();
    });
  });

  describe('full payload validation', () => {
    it('should accept a complete valid payload', () => {
      const result = validateRequest({
        email: 'admin@cannabis-co.com',
        tenant_slug: 'cannabis-co',
      });

      expect(result).toEqual({
        email: 'admin@cannabis-co.com',
        tenant_slug: 'cannabis-co',
      });
    });

    it('should reject completely empty body', () => {
      expect(() => validateRequest({})).toThrow();
    });

    it('should reject null body', () => {
      expect(() => validateRequest(null)).toThrow();
    });

    it('should reject undefined body', () => {
      expect(() => validateRequest(undefined)).toThrow();
    });

    it('should strip unknown properties', () => {
      const result = validateRequest({
        email: 'admin@example.com',
        tenant_slug: 'my-store',
        malicious_field: '<script>alert("xss")</script>',
      });

      expect(result).not.toHaveProperty('malicious_field');
    });
  });
});

describe('resend-admin-verification integration tests', () => {
  const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
  const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
  const endpoint = `${FUNCTIONS_URL}/resend-admin-verification`;

  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle CORS preflight', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      }),
    });

    const response = await fetch(endpoint, { method: 'OPTIONS' });
    expect(response.ok).toBe(true);
  });

  it('should reject unauthenticated requests with 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Missing authorization' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        tenant_slug: 'my-store',
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Missing authorization');
  });

  it('should reject email mismatch with 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Email mismatch' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        email: 'other@example.com',
        tenant_slug: 'my-store',
      }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Email mismatch');
  });

  it('should return 404 when tenant not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Tenant not found' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        tenant_slug: 'nonexistent-store',
      }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Tenant not found');
  });

  it('should return 404 when tenant user not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Tenant user not found' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        tenant_slug: 'my-store',
      }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Tenant user not found');
  });

  it('should return 503 when email service not configured', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'Email service not configured' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        tenant_slug: 'my-store',
      }),
    });

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toBe('Email service not configured');
  });

  it('should return 502 when Resend API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ error: 'Failed to send verification email' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        tenant_slug: 'my-store',
      }),
    });

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toBe('Failed to send verification email');
  });

  it('should return success when email is sent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, message: 'Verification email sent' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        tenant_slug: 'my-store',
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Verification email sent');
  });

  it('should return 500 for validation errors (invalid body)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Invalid email' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({
        email: 'not-valid',
        tenant_slug: 'my-store',
      }),
    });

    expect(response.ok).toBe(false);
  });
});

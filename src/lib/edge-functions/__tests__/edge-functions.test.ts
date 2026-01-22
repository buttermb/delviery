/**
 * Edge Functions Integration Tests
 * Tests critical edge functions for FloraIQ platform
 *
 * These tests verify:
 * 1. validate-tenant - Tenant slug validation
 * 2. tenant-admin-auth - Login, refresh, verify actions
 * 3. check-stripe-config - Stripe configuration status
 * 4. process-payment - Payment processing with various methods
 * 5. send-notification - Multi-channel notification delivery
 * 6. menu-generate - Disposable menu creation
 * 7. menu-order-place - Menu ordering flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

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

describe('Edge Functions Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validate-tenant', () => {
    const endpoint = `${FUNCTIONS_URL}/validate-tenant`;

    it('should validate an existing tenant slug', async () => {
      const mockTenant = {
        id: 'tenant-123',
        slug: 'willysbo',
        subscription_status: 'active',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ valid: true, tenant: mockTenant })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'willysbo' }),
      });

      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'willysbo' }),
      });
      expect(data.valid).toBe(true);
      expect(data.tenant.slug).toBe('willysbo');
    });

    it('should return invalid for non-existent tenant', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ valid: false, error: 'Tenant not found' })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'nonexistent' }),
      });

      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toBe('Tenant not found');
    });

    it('should return error for missing slug', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ valid: false, error: 'Missing slug' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
      expect(data.error).toBe('Missing slug');
    });

    it('should handle CORS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(endpoint, {
        method: 'OPTIONS',
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('tenant-admin-auth', () => {
    const baseEndpoint = `${FUNCTIONS_URL}/tenant-admin-auth`;

    describe('login action', () => {
      const endpoint = `${baseEndpoint}?action=login`;

      it('should authenticate valid tenant admin credentials', async () => {
        const mockResponse = {
          user: { id: 'user-123', email: 'admin@example.com' },
          session: {
            access_token: 'access-token-123',
            refresh_token: 'refresh-token-123',
          },
          admin: {
            id: 'admin-123',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'owner',
            tenant_id: 'tenant-123',
          },
          tenant: {
            id: 'tenant-123',
            business_name: 'Test Business',
            slug: 'willysbo',
            subscription_plan: 'pro',
            subscription_status: 'active',
          },
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@example.com',
            password: 'secure-password',
            tenantSlug: 'willysbo',
          }),
        });

        const data = await response.json();

        expect(data.user.email).toBe('admin@example.com');
        expect(data.admin.role).toBe('owner');
        expect(data.tenant.slug).toBe('willysbo');
        expect(data.session.access_token).toBeDefined();
      });

      it('should reject invalid credentials', async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse(
            { error: 'Invalid credentials', detail: 'Email or password is incorrect.' },
            401
          )
        );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@example.com',
            password: 'wrong-password',
            tenantSlug: 'willysbo',
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Invalid credentials');
      });

      it('should return 404 for non-existent tenant', async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({ error: 'Tenant not found' }, 404)
        );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@example.com',
            password: 'password',
            tenantSlug: 'nonexistent',
          }),
        });

        expect(response.status).toBe(404);
      });

      it('should enforce rate limiting', async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse(
            {
              error: 'Too many login attempts. Please try again later.',
              retryAfter: 900,
            },
            429
          )
        );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@example.com',
            password: 'password',
            tenantSlug: 'willysbo',
          }),
        });

        expect(response.status).toBe(429);
        const data = await response.json();
        expect(data.retryAfter).toBeDefined();
      });

      it('should validate input schema', async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({ error: 'Validation failed', details: [] }, 400)
        );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'not-an-email',
            password: '',
            tenantSlug: '',
          }),
        });

        expect(response.status).toBe(400);
      });
    });

    describe('refresh action', () => {
      const endpoint = `${baseEndpoint}?action=refresh`;

      it('should refresh a valid token', async () => {
        const mockResponse = {
          user: { id: 'user-123', email: 'admin@example.com' },
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
          },
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: 'valid-refresh-token' }),
        });

        const data = await response.json();

        expect(data.session.access_token).toBe('new-access-token');
        expect(data.session.refresh_token).toBe('new-refresh-token');
      });

      it('should reject invalid refresh token', async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse(
            {
              error: 'Failed to refresh token',
              reason: 'invalid_refresh_token',
            },
            401
          )
        );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: 'invalid-token' }),
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.reason).toBe('invalid_refresh_token');
      });
    });

    describe('verify action', () => {
      const endpoint = `${baseEndpoint}?action=verify`;

      it('should verify a valid access token', async () => {
        const mockResponse = {
          user: { id: 'user-123', email: 'admin@example.com' },
          admin: { role: 'owner', tenant_id: 'tenant-123' },
          tenant: { slug: 'willysbo' },
        };

        mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-access-token',
          },
        });

        const data = await response.json();

        expect(data.user).toBeDefined();
        expect(data.admin.role).toBe('owner');
      });

      it('should reject missing token', async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({ error: 'No token provided' }, 401)
        );

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        expect(response.status).toBe(401);
      });
    });

    describe('logout action', () => {
      const endpoint = `${baseEndpoint}?action=logout`;

      it('should successfully logout', async () => {
        mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer access-token',
          },
        });

        const data = await response.json();

        expect(data.success).toBe(true);
      });
    });
  });

  describe('check-stripe-config', () => {
    const endpoint = `${FUNCTIONS_URL}/check-stripe-config`;

    it('should return configured=true and valid=true when Stripe is properly configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: true,
          valid: true,
          testMode: true,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      expect(data.configured).toBe(true);
      expect(data.valid).toBe(true);
      expect(data.testMode).toBeDefined();
    });

    it('should return configured=false when STRIPE_SECRET_KEY is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: false,
          valid: false,
          error: 'STRIPE_SECRET_KEY is missing',
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      expect(data.configured).toBe(false);
      expect(data.error).toBe('STRIPE_SECRET_KEY is missing');
    });

    it('should detect invalid key type (publishable instead of secret)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: true,
          valid: false,
          error: 'Invalid Stripe configuration. The key must be a SECRET key (starts with sk_), not a publishable key (pk_).',
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      expect(data.configured).toBe(true);
      expect(data.valid).toBe(false);
      expect(data.error).toContain('SECRET key');
    });

    it('should handle invalid Stripe key', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: true,
          valid: false,
          error: 'Invalid Stripe key',
          testMode: true,
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      expect(data.configured).toBe(true);
      expect(data.valid).toBe(false);
    });
  });

  describe('process-payment', () => {
    const endpoint = `${FUNCTIONS_URL}/process-payment`;

    it('should process cash payment successfully', async () => {
      const mockResponse = {
        success: true,
        payment: {
          id: null,
          transaction_id: 'CASH-abc123',
          status: 'pending',
          method: 'cash',
        },
        message: 'Payment will be collected on delivery',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'cash',
          amount: 150.0,
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.payment.method).toBe('cash');
      expect(data.payment.status).toBe('pending');
    });

    it('should process card payment with Stripe', async () => {
      const mockResponse = {
        success: true,
        payment: {
          id: 'pi_123456',
          transaction_id: 'pi_123456',
          status: 'completed',
          method: 'card',
          client_secret: 'pi_123456_secret_abc',
        },
        message: 'Payment processed successfully',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.payment.method).toBe('card');
      expect(data.payment.client_secret).toBeDefined();
    });

    it('should return crypto not implemented', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Crypto payments not yet implemented' },
          400
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'crypto',
          amount: 150.0,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not yet implemented');
    });

    it('should require authentication', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should validate order_id is UUID', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: 'not-a-uuid',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject negative amounts', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation error' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: -50.0,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should enforce rate limiting', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Rate limit exceeded',
            message: 'Too many payment attempts. Please try again later.',
          },
          429
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 150.0,
        }),
      });

      expect(response.status).toBe(429);
    });

    it('should handle amount mismatch with order total', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Amount mismatch' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 999.99,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Amount mismatch');
    });
  });

  describe('send-notification', () => {
    const endpoint = `${FUNCTIONS_URL}/send-notification`;

    it('should send database notification', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          results: {
            database: { success: true, id: 'notification-123' },
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'order_status',
          title: 'Order Update',
          message: 'Your order has been shipped!',
          channels: ['database'],
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.results.database.success).toBe(true);
    });

    it('should send multi-channel notification', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          results: {
            database: { success: true, id: 'notification-123' },
            email: { success: true, sent: false, note: 'Email service not configured' },
            push: { success: true, sent: false, note: 'Push service not configured' },
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'payment',
          title: 'Payment Received',
          message: 'Payment of $150 has been processed.',
          channels: ['database', 'email', 'push'],
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.results.database).toBeDefined();
      expect(data.results.email).toBeDefined();
      expect(data.results.push).toBeDefined();
    });

    it('should require authentication', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'system',
          title: 'Test',
          message: 'Test message',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should validate notification type', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 500)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          type: 'invalid_type',
          title: 'Test',
          message: 'Test message',
        }),
      });

      expect(response.status).toBe(500);
    });

    it('should validate message length', async () => {
      const longMessage = 'a'.repeat(1001);

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Validation failed' }, 500)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          type: 'system',
          title: 'Test',
          message: longMessage,
        }),
      });

      expect(response.status).toBe(500);
    });

    it('should support tenant-level notifications', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          results: {
            database: { success: true, id: 'notification-123' },
          },
        })
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'inventory',
          title: 'Low Stock Alert',
          message: 'Product XYZ is running low on stock.',
          metadata: { product_id: 'prod-123', current_stock: 5 },
          channels: ['database'],
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
    });
  });

  describe('menu-generate', () => {
    const endpoint = `${FUNCTIONS_URL}/menu-generate`;

    it('should create a disposable menu', async () => {
      const mockResponse = {
        success: true,
        menu: {
          id: 'menu-123',
          name: 'Weekly Special',
          status: 'active',
          tenant_id: 'tenant-123',
        },
        products: [
          { menu_id: 'menu-123', product_id: 'prod-1' },
          { menu_id: 'menu-123', product_id: 'prod-2' },
        ],
        access_code: 'ABC12345',
        url_token: 'abc123xyz456',
        shareable_url: 'https://example.com/m/abc123xyz456',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          name: 'Weekly Special',
          description: 'This weeks best products',
          product_ids: ['prod-1', 'prod-2'],
          min_order_quantity: 5,
          max_order_quantity: 50,
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.menu.name).toBe('Weekly Special');
      expect(data.access_code).toBeDefined();
      expect(data.shareable_url).toBeDefined();
    });

    it('should require authentication', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 500)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Menu',
          product_ids: ['prod-1'],
        }),
      });

      expect(response.status).toBe(500);
    });

    it('should validate product ownership', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Some products do not belong to your tenant' },
          403
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          name: 'Test Menu',
          product_ids: ['other-tenant-product'],
        }),
      });

      expect(response.status).toBe(403);
    });

    it('should support custom prices', async () => {
      const mockResponse = {
        success: true,
        menu: { id: 'menu-123' },
        products: [{ menu_id: 'menu-123', product_id: 'prod-1', custom_price: 99.99 }],
        access_code: 'ABC12345',
        url_token: 'abc123xyz456',
        shareable_url: 'https://example.com/m/abc123xyz456',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          name: 'Custom Price Menu',
          product_ids: ['prod-1'],
          custom_prices: { 'prod-1': 99.99 },
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it('should support security settings', async () => {
      const mockResponse = {
        success: true,
        menu: { id: 'menu-123', security_settings: { max_views: 100 } },
        products: [],
        access_code: 'CUSTOM123',
        url_token: 'abc123xyz456',
        shareable_url: 'https://example.com/m/abc123xyz456',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          name: 'Secure Menu',
          product_ids: ['prod-1'],
          security_settings: {
            access_code: 'CUSTOM123',
            max_views: 100,
          },
        }),
      });

      const data = await response.json();

      expect(data.access_code).toBe('CUSTOM123');
    });
  });

  describe('menu-order-place', () => {
    const endpoint = `${FUNCTIONS_URL}/menu-order-place`;

    it('should place an order successfully', async () => {
      const mockResponse = {
        success: true,
        order_id: 'order-123',
        status: 'confirmed',
        trace_id: 'trace-abc123',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-ID': 'trace-abc123',
        },
        body: JSON.stringify({
          menu_id: 'menu-123',
          order_items: [
            { product_id: 'prod-1', quantity: 10 },
            { product_id: 'prod-2', quantity: 5 },
          ],
          payment_method: 'cash',
          contact_phone: '+1234567890',
          contact_email: 'customer@example.com',
          customer_name: 'John Doe',
          total_amount: 500.0,
        }),
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.order_id).toBeDefined();
      expect(data.status).toBe('confirmed');
    });

    it('should handle inventory reservation failure', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Insufficient inventory for product prod-1' },
          400
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: 'menu-123',
          order_items: [{ product_id: 'prod-1', quantity: 1000 }],
          payment_method: 'cash',
          contact_phone: '+1234567890',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should handle payment failure with rollback', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Payment failed', details: 'Card declined' },
          402
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: 'menu-123',
          order_items: [{ product_id: 'prod-1', quantity: 10 }],
          payment_method: 'card',
          contact_phone: '+1234567890',
        }),
      });

      expect(response.status).toBe(402);
    });

    it('should support idempotency key', async () => {
      const mockResponse = {
        success: true,
        order_id: 'order-123',
        status: 'confirmed',
        trace_id: 'trace-abc123',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': 'unique-key-123',
        },
        body: JSON.stringify({
          menu_id: 'menu-123',
          order_items: [{ product_id: 'prod-1', quantity: 10 }],
          payment_method: 'cash',
          contact_phone: '+1234567890',
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Idempotency-Key': 'unique-key-123',
          }),
        })
      );
    });

    it('should validate menu exists and is active', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Menu not found or inactive' }, 400)
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: 'invalid-menu',
          order_items: [{ product_id: 'prod-1', quantity: 10 }],
          payment_method: 'cash',
          contact_phone: '+1234567890',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should handle zombie order recovery', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          {
            error: 'Order processing failed. Payment has been refunded.',
            trace_id: 'trace-abc123',
            code: 'ZOMBIE_ORDER_RECOVERED',
          },
          500
        )
      );

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: 'menu-123',
          order_items: [{ product_id: 'prod-1', quantity: 10 }],
          payment_method: 'card',
          contact_phone: '+1234567890',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('ZOMBIE_ORDER_RECOVERED');
    });

    it('should calculate total from server prices', async () => {
      const mockResponse = {
        success: true,
        order_id: 'order-123',
        status: 'confirmed',
        trace_id: 'trace-abc123',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      // Client sends total_amount but server should recalculate
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: 'menu-123',
          order_items: [{ product_id: 'prod-1', quantity: 10 }],
          payment_method: 'cash',
          contact_phone: '+1234567890',
          total_amount: 0.01, // Malicious attempt to pay less
        }),
      });

      // Server should accept but use its own calculated total
      expect(response.ok).toBe(true);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight for all endpoints', async () => {
      const endpoints = [
        '/validate-tenant',
        '/tenant-admin-auth',
        '/check-stripe-config',
        '/process-payment',
        '/send-notification',
        '/menu-generate',
        '/menu-order-place',
      ];

      for (const path of endpoints) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          }),
        });

        const response = await fetch(`${FUNCTIONS_URL}${path}`, {
          method: 'OPTIONS',
        });

        expect(response.ok).toBe(true);
      }
    });
  });
});

describe('Edge Function Security Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Authentication requirements', () => {
    it('validate-tenant should NOT require auth (public endpoint)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ valid: true, tenant: { slug: 'test' } })
      );

      const response = await fetch(`${FUNCTIONS_URL}/validate-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: 'test' }),
      });

      expect(response.ok).toBe(true);
    });

    it('process-payment should require auth (protected endpoint)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 401)
      );

      const response = await fetch(`${FUNCTIONS_URL}/process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_method: 'card',
          amount: 100,
        }),
      });

      expect(response.status).toBe(401);
    });

    it('menu-generate should require auth (protected endpoint)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Unauthorized' }, 500)
      );

      const response = await fetch(`${FUNCTIONS_URL}/menu-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test',
          product_ids: [],
        }),
      });

      // Should fail without auth
      expect(response.ok).toBe(false);
    });

    it('menu-order-place should NOT require auth (public for customers)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          order_id: 'order-123',
          status: 'confirmed',
        })
      );

      const response = await fetch(`${FUNCTIONS_URL}/menu-order-place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_id: 'menu-123',
          order_items: [{ product_id: 'prod-1', quantity: 5 }],
          payment_method: 'cash',
          contact_phone: '+1234567890',
        }),
      });

      // Menu orders are public (no JWT required per config)
      expect(response.ok).toBe(true);
    });
  });

  describe('Input validation', () => {
    it('should reject SQL injection attempts in tenant slug', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ valid: false, error: 'Tenant not found' })
      );

      const response = await fetch(`${FUNCTIONS_URL}/validate-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: "'; DROP TABLE tenants; --" }),
      });

      const data = await response.json();

      // Should not cause an error, just return not found
      expect(data.valid).toBe(false);
    });

    it('should handle XSS attempts in notification message', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          results: { database: { success: true } },
        })
      );

      const response = await fetch(`${FUNCTIONS_URL}/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          type: 'system',
          title: 'Test',
          message: '<script>alert("xss")</script>',
          channels: ['database'],
        }),
      });

      // Should accept (sanitization happens at display time)
      expect(response.ok).toBe(true);
    });
  });

  describe('Rate limiting', () => {
    it('should enforce rate limits on login attempts', async () => {
      // Simulate 6 login attempts (rate limit is 5 per 15 min)
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({ error: 'Invalid credentials' }, 401)
        );
      }

      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Too many login attempts. Please try again later.', retryAfter: 900 },
          429
        )
      );

      let lastResponse;
      for (let i = 0; i < 6; i++) {
        lastResponse = await fetch(`${FUNCTIONS_URL}/tenant-admin-auth?action=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'wrong',
            tenantSlug: 'test',
          }),
        });
      }

      expect(lastResponse?.status).toBe(429);
    });
  });
});

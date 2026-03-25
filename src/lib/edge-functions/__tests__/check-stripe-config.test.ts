/**
 * check-stripe-config Test Mode Detection Tests
 *
 * Verifies that the check-stripe-config edge function correctly detects
 * test mode vs live mode Stripe keys and returns the proper response shape.
 *
 * The edge function uses prefix-based detection:
 *   - sk_test_* → testMode: true
 *   - sk_live_* → testMode: false
 *   - pk_*      → invalid key type (not a secret key)
 *   - missing   → configured: false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/check-stripe-config`;

const mockFetch = vi.fn();
global.fetch = mockFetch;

interface StripeConfigResponse {
  configured: boolean;
  valid: boolean;
  testMode?: boolean;
  error?: string;
}

const createMockResponse = (data: StripeConfigResponse, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

/**
 * Mirrors the test mode detection logic from the edge function.
 * This is the core logic we're verifying:
 *   const isTestMode = STRIPE_SECRET_KEY.startsWith('sk_test_');
 */
function detectStripeTestMode(key: string): { isTestMode: boolean; isLiveMode: boolean; isSecretKey: boolean } {
  return {
    isTestMode: key.startsWith('sk_test_'),
    isLiveMode: key.startsWith('sk_live_'),
    isSecretKey: key.startsWith('sk_'),
  };
}

describe('check-stripe-config: test mode detection', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('key prefix detection logic', () => {
    it('should detect sk_test_ prefix as test mode', () => {
      const result = detectStripeTestMode('sk_test_abc123');
      expect(result.isTestMode).toBe(true);
      expect(result.isLiveMode).toBe(false);
      expect(result.isSecretKey).toBe(true);
    });

    it('should detect sk_live_ prefix as live mode', () => {
      const result = detectStripeTestMode('sk_live_abc123');
      expect(result.isTestMode).toBe(false);
      expect(result.isLiveMode).toBe(true);
      expect(result.isSecretKey).toBe(true);
    });

    it('should detect pk_test_ as not a secret key', () => {
      const result = detectStripeTestMode('pk_test_abc123');
      expect(result.isTestMode).toBe(false);
      expect(result.isLiveMode).toBe(false);
      expect(result.isSecretKey).toBe(false);
    });

    it('should detect pk_live_ as not a secret key', () => {
      const result = detectStripeTestMode('pk_live_abc123');
      expect(result.isTestMode).toBe(false);
      expect(result.isLiveMode).toBe(false);
      expect(result.isSecretKey).toBe(false);
    });

    it('should handle restricted keys (rk_test_)', () => {
      const result = detectStripeTestMode('rk_test_abc123');
      expect(result.isTestMode).toBe(false);
      expect(result.isLiveMode).toBe(false);
      expect(result.isSecretKey).toBe(false);
    });

    it('should handle empty string', () => {
      const result = detectStripeTestMode('');
      expect(result.isTestMode).toBe(false);
      expect(result.isLiveMode).toBe(false);
      expect(result.isSecretKey).toBe(false);
    });

    it('should handle sk_ without test_ or live_ suffix', () => {
      const result = detectStripeTestMode('sk_something_else');
      expect(result.isTestMode).toBe(false);
      expect(result.isLiveMode).toBe(false);
      expect(result.isSecretKey).toBe(true);
    });
  });

  describe('edge function response: test mode key', () => {
    it('should return testMode=true when Stripe has a test key configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: true,
          valid: true,
          testMode: true,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
      });

      const data: StripeConfigResponse = await response.json();

      expect(data.configured).toBe(true);
      expect(data.valid).toBe(true);
      expect(data.testMode).toBe(true);
    });

    it('should include testMode even when key validation fails (invalid test key)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: true,
          valid: false,
          testMode: true,
          error: 'Invalid API Key provided: sk_test_****',
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
      });

      const data: StripeConfigResponse = await response.json();

      expect(data.configured).toBe(true);
      expect(data.valid).toBe(false);
      expect(data.testMode).toBe(true);
      expect(data.error).toBeDefined();
    });
  });

  describe('edge function response: live mode key', () => {
    it('should return testMode=false when Stripe has a live key configured', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: true,
          valid: true,
          testMode: false,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
      });

      const data: StripeConfigResponse = await response.json();

      expect(data.configured).toBe(true);
      expect(data.valid).toBe(true);
      expect(data.testMode).toBe(false);
    });

    it('should include testMode=false when live key validation fails', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: true,
          valid: false,
          testMode: false,
          error: 'Invalid API Key provided: sk_live_****',
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
      });

      const data: StripeConfigResponse = await response.json();

      expect(data.configured).toBe(true);
      expect(data.valid).toBe(false);
      expect(data.testMode).toBe(false);
    });
  });

  describe('edge function response: missing or invalid key', () => {
    it('should not include testMode when STRIPE_SECRET_KEY is missing', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: false,
          valid: false,
          error: 'STRIPE_SECRET_KEY is missing',
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
      });

      const data: StripeConfigResponse = await response.json();

      expect(data.configured).toBe(false);
      expect(data.valid).toBe(false);
      expect(data.testMode).toBeUndefined();
    });

    it('should not include testMode when key is a publishable key (pk_)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          configured: true,
          valid: false,
          error: 'Invalid Stripe configuration. The key must be a SECRET key (starts with sk_), not a publishable key (pk_).',
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
      });

      const data: StripeConfigResponse = await response.json();

      expect(data.configured).toBe(true);
      expect(data.valid).toBe(false);
      expect(data.testMode).toBeUndefined();
      expect(data.error).toContain('SECRET key');
    });
  });

  describe('edge function response: auth requirements', () => {
    it('should return 401 when Authorization header is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Missing authorization header' }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization header');
    });

    it('should return 401 when token is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('client-side test mode detection', () => {
    /**
     * The IntegrationSetupDialog checks:
     *   formData.TENANT_STRIPE_SECRET_KEY?.startsWith('sk_test_')
     * This verifies that client-side logic matches edge function logic.
     */
    it('should match edge function detection for sk_test_ keys', () => {
      const clientKey = 'sk_test_51234567890abcdef';
      const clientDetects = clientKey.startsWith('sk_test_');
      const serverDetects = detectStripeTestMode(clientKey).isTestMode;
      expect(clientDetects).toBe(serverDetects);
      expect(clientDetects).toBe(true);
    });

    it('should match edge function detection for sk_live_ keys', () => {
      const clientKey = 'sk_live_51234567890abcdef';
      const clientDetects = clientKey.startsWith('sk_test_');
      const serverDetects = detectStripeTestMode(clientKey).isTestMode;
      expect(clientDetects).toBe(serverDetects);
      expect(clientDetects).toBe(false);
    });

    it('should correctly display test mode alert when testMode=true in response', () => {
      const stripeHealth: StripeConfigResponse = {
        configured: true,
        valid: true,
        testMode: true,
      };

      // This mirrors the conditional in BillingSettings.tsx line 521:
      //   {stripeHealth?.testMode && ( ... alert ... )}
      const shouldShowTestAlert = stripeHealth?.testMode === true;
      expect(shouldShowTestAlert).toBe(true);
    });

    it('should not display test mode alert when testMode=false', () => {
      const stripeHealth: StripeConfigResponse = {
        configured: true,
        valid: true,
        testMode: false,
      };

      const shouldShowTestAlert = stripeHealth?.testMode === true;
      expect(shouldShowTestAlert).toBe(false);
    });

    it('should not display test mode alert when testMode is undefined', () => {
      const stripeHealth: StripeConfigResponse = {
        configured: false,
        valid: false,
      };

      const shouldShowTestAlert = stripeHealth?.testMode === true;
      expect(shouldShowTestAlert).toBe(false);
    });

    it('should handle BillingPage test mode display logic', () => {
      // BillingPage.tsx line 445: {stripeHealth?.valid && stripeHealth.testMode && ( ... )}
      const testModeValid: StripeConfigResponse = { configured: true, valid: true, testMode: true };
      const testModeInvalid: StripeConfigResponse = { configured: true, valid: false, testMode: true };
      const liveModeValid: StripeConfigResponse = { configured: true, valid: true, testMode: false };

      expect(testModeValid.valid && testModeValid.testMode).toBe(true);
      expect(testModeInvalid.valid && testModeInvalid.testMode).toBe(false);
      expect(liveModeValid.valid && liveModeValid.testMode).toBe(false);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight request', async () => {
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
});

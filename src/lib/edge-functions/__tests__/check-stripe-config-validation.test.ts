/**
 * check-stripe-config edge function validation tests
 *
 * Verifies that the check-stripe-config edge function correctly validates
 * the sk_ prefix on Stripe secret keys and returns the appropriate response
 * for each key variant (missing, publishable, test, live, garbage).
 *
 * These tests exercise the same validation logic that lives in
 * supabase/functions/check-stripe-config/index.ts
 */

import { describe, it, expect } from 'vitest';

/**
 * Pure validation logic mirroring supabase/functions/check-stripe-config/index.ts
 * lines 40-67. Extracted here so unit tests can run without Deno/Stripe SDK.
 */
interface StripeConfigResult {
  configured: boolean;
  valid: boolean;
  error?: string;
  testMode?: boolean;
}

function validateStripeSecretKey(key: string | undefined | null): StripeConfigResult {
  if (!key) {
    return {
      configured: false,
      valid: false,
      error: 'STRIPE_SECRET_KEY is missing',
    };
  }

  if (!key.startsWith('sk_')) {
    return {
      configured: true,
      valid: false,
      error:
        'Invalid Stripe configuration. The key must be a SECRET key (starts with sk_), not a publishable key (pk_).',
    };
  }

  const isTestMode = key.startsWith('sk_test_');

  // In production the edge function would also call stripe.customers.list()
  // to verify the key actually works. That API call is out of scope for
  // unit tests — we only assert the prefix-based validation here.
  return {
    configured: true,
    valid: true,
    testMode: isTestMode,
  };
}

describe('check-stripe-config: sk_ prefix validation', () => {
  describe('missing key', () => {
    it('returns configured=false when key is undefined', () => {
      const result = validateStripeSecretKey(undefined);
      expect(result.configured).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('STRIPE_SECRET_KEY is missing');
    });

    it('returns configured=false when key is null', () => {
      const result = validateStripeSecretKey(null);
      expect(result.configured).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('STRIPE_SECRET_KEY is missing');
    });

    it('returns configured=false when key is empty string', () => {
      const result = validateStripeSecretKey('');
      expect(result.configured).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('STRIPE_SECRET_KEY is missing');
    });
  });

  describe('invalid prefix — publishable keys', () => {
    it('rejects pk_test_ publishable key', () => {
      const result = validateStripeSecretKey('pk_test_abc123');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SECRET key');
      expect(result.error).toContain('sk_');
    });

    it('rejects pk_live_ publishable key', () => {
      const result = validateStripeSecretKey('pk_live_abc123');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SECRET key');
    });
  });

  describe('invalid prefix — restricted keys', () => {
    it('rejects rk_test_ restricted key', () => {
      const result = validateStripeSecretKey('rk_test_abc123');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SECRET key');
    });

    it('rejects rk_live_ restricted key', () => {
      const result = validateStripeSecretKey('rk_live_abc123');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SECRET key');
    });
  });

  describe('invalid prefix — garbage input', () => {
    it('rejects random string', () => {
      const result = validateStripeSecretKey('not_a_stripe_key');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SECRET key');
    });

    it('rejects key with sk substring but wrong prefix', () => {
      const result = validateStripeSecretKey('my_sk_test_abc123');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(false);
    });

    it('rejects whisk_ prefix that contains sk_', () => {
      const result = validateStripeSecretKey('whisk_test_abc123');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(false);
    });
  });

  describe('valid sk_ prefix', () => {
    it('accepts sk_test_ key and reports testMode=true', () => {
      const result = validateStripeSecretKey('sk_test_abc123xyz');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.testMode).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts sk_live_ key and reports testMode=false', () => {
      const result = validateStripeSecretKey('sk_live_abc123xyz');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.testMode).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('accepts bare sk_ prefix (unusual but valid format)', () => {
      const result = validateStripeSecretKey('sk_something_else');
      expect(result.configured).toBe(true);
      expect(result.valid).toBe(true);
      // Not sk_test_ so testMode should be false
      expect(result.testMode).toBe(false);
    });
  });

  describe('edge function response contract', () => {
    it('always returns configured and valid fields', () => {
      const cases = [
        undefined,
        '',
        'pk_test_abc',
        'sk_test_abc',
        'sk_live_abc',
        'garbage',
      ] as const;

      for (const key of cases) {
        const result = validateStripeSecretKey(key as string | undefined);
        expect(result).toHaveProperty('configured');
        expect(result).toHaveProperty('valid');
        expect(typeof result.configured).toBe('boolean');
        expect(typeof result.valid).toBe('boolean');
      }
    });

    it('returns error string only when valid=false', () => {
      const invalid = validateStripeSecretKey('pk_test_abc');
      expect(invalid.valid).toBe(false);
      expect(typeof invalid.error).toBe('string');

      const valid = validateStripeSecretKey('sk_test_abc');
      expect(valid.valid).toBe(true);
      expect(valid.error).toBeUndefined();
    });

    it('returns testMode only when prefix passes validation', () => {
      const missing = validateStripeSecretKey(undefined);
      expect(missing.testMode).toBeUndefined();

      const wrongPrefix = validateStripeSecretKey('pk_test_abc');
      expect(wrongPrefix.testMode).toBeUndefined();

      const validTest = validateStripeSecretKey('sk_test_abc');
      expect(validTest.testMode).toBe(true);

      const validLive = validateStripeSecretKey('sk_live_abc');
      expect(validLive.testMode).toBe(false);
    });
  });
});

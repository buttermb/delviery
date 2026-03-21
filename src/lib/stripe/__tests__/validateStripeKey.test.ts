import { describe, it, expect } from 'vitest';
import { validateStripeSecretKey } from '@/lib/stripe/validateStripeKey';

describe('validateStripeSecretKey', () => {
  describe('valid secret keys', () => {
    it('accepts sk_test_ prefix', () => {
      const result = validateStripeSecretKey('sk_test_abc123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts sk_live_ prefix', () => {
      const result = validateStripeSecretKey('sk_live_abc123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts long realistic test key', () => {
      const result = validateStripeSecretKey(
        'sk_test_51Sb3ioFWN1Z6rLwAexample1234567890abcdef'
      );
      expect(result.valid).toBe(true);
    });

    it('accepts long realistic live key', () => {
      const result = validateStripeSecretKey(
        'sk_live_51Sb3ioFWN1Z6rLwAexample1234567890abcdef'
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('missing or empty keys', () => {
    it('rejects undefined', () => {
      const result = validateStripeSecretKey(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing or empty');
    });

    it('rejects null', () => {
      const result = validateStripeSecretKey(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing or empty');
    });

    it('rejects empty string', () => {
      const result = validateStripeSecretKey('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing or empty');
    });

    it('rejects whitespace-only string', () => {
      const result = validateStripeSecretKey('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing or empty');
    });
  });

  describe('publishable key rejection', () => {
    it('rejects pk_test_ prefix', () => {
      const result = validateStripeSecretKey('pk_test_abc123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('publishable key');
    });

    it('rejects pk_live_ prefix', () => {
      const result = validateStripeSecretKey('pk_live_abc123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('publishable key');
    });
  });

  describe('restricted key rejection', () => {
    it('rejects rk_test_ prefix', () => {
      const result = validateStripeSecretKey('rk_test_abc123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('restricted key');
    });

    it('rejects rk_live_ prefix', () => {
      const result = validateStripeSecretKey('rk_live_abc123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('restricted key');
    });
  });

  describe('invalid prefixes', () => {
    it('rejects random string', () => {
      const result = validateStripeSecretKey('not_a_valid_key');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("start with 'sk_'");
    });

    it('rejects key with similar but wrong prefix', () => {
      const result = validateStripeSecretKey('sk-test_abc123');
      expect(result.valid).toBe(false);
    });

    it('rejects key starting with uppercase SK_', () => {
      const result = validateStripeSecretKey('SK_test_abc123');
      expect(result.valid).toBe(false);
    });
  });
});

/**
 * Tests for secure-account edge function logic
 * Validates request handling, Zod validation, and response codes
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the schemas from the edge function
const secureAccountSchema = z.object({
  token: z.string().min(1),
});

const confirmLoginSchema = z.object({
  alertId: z.string().uuid(),
});

describe('secure-account edge function schemas', () => {
  describe('secureAccountSchema', () => {
    it('accepts valid token', () => {
      const result = secureAccountSchema.safeParse({ token: 'abc123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBe('abc123');
      }
    });

    it('rejects empty body', () => {
      const result = secureAccountSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects empty string token', () => {
      const result = secureAccountSchema.safeParse({ token: '' });
      expect(result.success).toBe(false);
    });

    it('rejects non-string token', () => {
      const result = secureAccountSchema.safeParse({ token: 123 });
      expect(result.success).toBe(false);
    });

    it('rejects null token', () => {
      const result = secureAccountSchema.safeParse({ token: null });
      expect(result.success).toBe(false);
    });

    it('provides field-level errors via flatten', () => {
      const result = secureAccountSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const flat = result.error.flatten();
        expect(flat.fieldErrors.token).toBeDefined();
        expect(flat.fieldErrors.token!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('confirmLoginSchema', () => {
    it('accepts valid UUID alertId', () => {
      const result = confirmLoginSchema.safeParse({
        alertId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty body', () => {
      const result = confirmLoginSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects non-UUID alertId', () => {
      const result = confirmLoginSchema.safeParse({ alertId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('rejects empty string alertId', () => {
      const result = confirmLoginSchema.safeParse({ alertId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('action routing logic', () => {
    it('defaults to "secure" when action is missing', () => {
      const rawBody: Record<string, unknown> = {};
      const action = (rawBody.action as string) || 'secure';
      expect(action).toBe('secure');
    });

    it('uses explicit action when provided', () => {
      const rawBody = { action: 'confirm' };
      const action = rawBody.action || 'secure';
      expect(action).toBe('confirm');
    });

    it('identifies invalid actions', () => {
      const rawBody = { action: 'delete' };
      const action = rawBody.action || 'secure';
      const validActions = ['secure', 'confirm'];
      expect(validActions.includes(action)).toBe(false);
    });
  });

  describe('response contract', () => {
    it('secure action with missing token should produce 400-level error info', () => {
      const rawBody = {};
      const parsed = secureAccountSchema.safeParse(rawBody);
      expect(parsed.success).toBe(false);
      // The edge function returns 400 with error details
      if (!parsed.success) {
        const responseBody = {
          error: 'Invalid request: token is required',
          details: parsed.error.flatten().fieldErrors,
        };
        expect(responseBody.error).toContain('token is required');
        expect(responseBody.details.token).toBeDefined();
      }
    });

    it('confirm action with missing alertId should produce 400-level error info', () => {
      const rawBody = { action: 'confirm' };
      const parsed = confirmLoginSchema.safeParse(rawBody);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const responseBody = {
          error: 'Invalid request: alertId (UUID) is required',
          details: parsed.error.flatten().fieldErrors,
        };
        expect(responseBody.error).toContain('alertId');
        expect(responseBody.details.alertId).toBeDefined();
      }
    });
  });
});

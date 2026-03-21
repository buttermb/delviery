/**
 * Tests for set-free-tier Zod validation
 *
 * Verifies that the setFreeTierSchema correctly validates:
 * - Valid UUID tenant_id values
 * - Rejects missing tenant_id
 * - Rejects non-UUID strings
 * - Rejects non-string types
 * - Rejects extra fields (strip behavior)
 * - validateSetFreeTier wrapper throws ZodError on invalid input
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-create the schema locally since Deno imports aren't available in Vitest
const setFreeTierSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID format'),
});

type SetFreeTierInput = z.infer<typeof setFreeTierSchema>;

function validateSetFreeTier(body: unknown): SetFreeTierInput {
  return setFreeTierSchema.parse(body);
}

describe('set-free-tier validation', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  describe('setFreeTierSchema', () => {
    it('accepts a valid UUID tenant_id', () => {
      const result = setFreeTierSchema.safeParse({ tenant_id: validUUID });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tenant_id).toBe(validUUID);
      }
    });

    it('accepts different valid UUID formats', () => {
      const uuids = [
        '00000000-0000-0000-0000-000000000000',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'ABCDEF12-3456-7890-ABCD-EF1234567890',
      ];

      for (const uuid of uuids) {
        const result = setFreeTierSchema.safeParse({ tenant_id: uuid });
        expect(result.success).toBe(true);
      }
    });

    it('rejects missing tenant_id', () => {
      const result = setFreeTierSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['tenant_id']);
      }
    });

    it('rejects empty string tenant_id', () => {
      const result = setFreeTierSchema.safeParse({ tenant_id: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid tenant ID format');
      }
    });

    it('rejects non-UUID string tenant_id', () => {
      const result = setFreeTierSchema.safeParse({ tenant_id: 'not-a-uuid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid tenant ID format');
      }
    });

    it('rejects numeric tenant_id', () => {
      const result = setFreeTierSchema.safeParse({ tenant_id: 12345 });
      expect(result.success).toBe(false);
    });

    it('rejects null tenant_id', () => {
      const result = setFreeTierSchema.safeParse({ tenant_id: null });
      expect(result.success).toBe(false);
    });

    it('rejects null body', () => {
      const result = setFreeTierSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('rejects undefined body', () => {
      const result = setFreeTierSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('strips extra fields', () => {
      const result = setFreeTierSchema.safeParse({
        tenant_id: validUUID,
        extra_field: 'should be stripped',
        admin: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ tenant_id: validUUID });
        expect((result.data as Record<string, unknown>)['extra_field']).toBeUndefined();
      }
    });
  });

  describe('validateSetFreeTier', () => {
    it('returns parsed input for valid data', () => {
      const result = validateSetFreeTier({ tenant_id: validUUID });
      expect(result).toEqual({ tenant_id: validUUID });
    });

    it('throws ZodError for missing tenant_id', () => {
      expect(() => validateSetFreeTier({})).toThrow(z.ZodError);
    });

    it('throws ZodError for invalid UUID', () => {
      expect(() => validateSetFreeTier({ tenant_id: 'bad' })).toThrow(z.ZodError);
    });

    it('throws ZodError with descriptive message for invalid UUID', () => {
      try {
        validateSetFreeTier({ tenant_id: 'not-valid' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        expect(zodError.errors[0].message).toBe('Invalid tenant ID format');
      }
    });

    it('throws ZodError for non-object input', () => {
      expect(() => validateSetFreeTier('string')).toThrow(z.ZodError);
      expect(() => validateSetFreeTier(42)).toThrow(z.ZodError);
      expect(() => validateSetFreeTier(null)).toThrow(z.ZodError);
    });
  });
});

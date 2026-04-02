/**
 * Tests for send-webhook validation schema.
 *
 * Verifies Zod schema correctly validates webhook_id (UUID),
 * optional payload (record), and optional event_type (string).
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-define schema to avoid Deno imports
// Mirrors supabase/functions/send-webhook/validation.ts
const sendWebhookSchema = z.object({
  webhook_id: z.string().uuid('Invalid webhook ID format'),
  payload: z.record(z.unknown()).optional().default({}),
  event_type: z.string().max(100).optional(),
});

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('sendWebhookSchema', () => {
  it('accepts valid input with all fields', () => {
    const input = {
      webhook_id: VALID_UUID,
      payload: { order_id: '123', event: 'order.created' },
      event_type: 'order.created',
    };
    const result = sendWebhookSchema.parse(input);

    expect(result.webhook_id).toBe(VALID_UUID);
    expect(result.payload).toEqual(input.payload);
    expect(result.event_type).toBe('order.created');
  });

  it('accepts minimal input with only webhook_id', () => {
    const result = sendWebhookSchema.parse({ webhook_id: VALID_UUID });

    expect(result.webhook_id).toBe(VALID_UUID);
    expect(result.payload).toEqual({});
    expect(result.event_type).toBeUndefined();
  });

  it('defaults payload to empty object when omitted', () => {
    const result = sendWebhookSchema.parse({ webhook_id: VALID_UUID });
    expect(result.payload).toEqual({});
  });

  it('rejects invalid UUID format', () => {
    expect(() =>
      sendWebhookSchema.parse({ webhook_id: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects missing webhook_id', () => {
    expect(() => sendWebhookSchema.parse({})).toThrow();
  });

  it('rejects non-string webhook_id', () => {
    expect(() => sendWebhookSchema.parse({ webhook_id: 12345 })).toThrow();
  });

  it('rejects event_type longer than 100 characters', () => {
    expect(() =>
      sendWebhookSchema.parse({
        webhook_id: VALID_UUID,
        event_type: 'x'.repeat(101),
      }),
    ).toThrow();
  });

  it('accepts event_type at exactly 100 characters', () => {
    const result = sendWebhookSchema.parse({
      webhook_id: VALID_UUID,
      event_type: 'x'.repeat(100),
    });
    expect(result.event_type).toHaveLength(100);
  });

  it('accepts payload with nested objects', () => {
    const payload = {
      order: { id: '1', items: [{ sku: 'A', qty: 2 }] },
      metadata: { source: 'api' },
    };
    const result = sendWebhookSchema.parse({
      webhook_id: VALID_UUID,
      payload,
    });
    expect(result.payload).toEqual(payload);
  });
});

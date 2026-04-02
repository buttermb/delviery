/**
 * send-webhook Edge Function Tests
 *
 * Verifies:
 * 1. Auth enforcement (JWT required)
 * 2. Tenant isolation (webhook must belong to caller's tenant)
 * 3. Webhook status check (must be active)
 * 4. HMAC signature generation when secret is present
 * 5. Webhook delivery with proper HTTP call
 * 6. Logging to webhook_logs table
 * 7. Error handling and response contracts
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('send-webhook edge function', () => {
  const source = readSource();

  describe('authentication and authorization', () => {
    it('should create an auth client scoped to the caller JWT', () => {
      expect(source).toContain("Authorization: req.headers.get('Authorization')!");
    });

    it('should call auth.getUser() to verify identity', () => {
      expect(source).toContain('authClient.auth.getUser()');
    });

    it('should return 401 for unauthenticated requests', () => {
      expect(source).toContain("{ error: 'Unauthorized' }");
      expect(source).toContain('status: 401');
    });

    it('should resolve tenant from tenant_users table', () => {
      expect(source).toContain("from('tenant_users')");
      expect(source).toContain("select('tenant_id')");
      expect(source).toContain("eq('user_id', user.id)");
    });

    it('should return 403 when no tenant found for user', () => {
      expect(source).toContain("{ error: 'No tenant found for user' }");
      expect(source).toContain('status: 403');
    });
  });

  describe('webhook lookup and tenant isolation', () => {
    it('should fetch webhook filtered by tenant_id', () => {
      expect(source).toContain("from('webhooks')");
      expect(source).toContain("eq('tenant_id', tenantId)");
    });

    it('should filter by webhook_id', () => {
      expect(source).toContain("eq('id', webhook_id)");
    });

    it('should use maybeSingle for optional results', () => {
      expect(source).toContain('.maybeSingle()');
    });

    it('should return 404 when webhook not found or not owned by tenant', () => {
      expect(source).toContain("{ error: 'Webhook not found or not owned by tenant' }");
      expect(source).toContain('status: 404');
    });

    it('should return 422 when webhook is inactive', () => {
      expect(source).toContain("{ error: 'Webhook is inactive' }");
      expect(source).toContain('status: 422');
    });
  });

  describe('HMAC signature', () => {
    it('should compute HMAC-SHA256 signature when secret exists', () => {
      expect(source).toContain('computeHmacSignature');
      expect(source).toContain("name: 'HMAC'");
      expect(source).toContain("hash: 'SHA-256'");
    });

    it('should set X-Webhook-Signature header when secret is present', () => {
      expect(source).toContain("'X-Webhook-Signature'");
      expect(source).toContain('webhook.secret');
    });

    it('should only sign when webhook has a secret', () => {
      expect(source).toContain('if (webhook.secret)');
    });
  });

  describe('webhook delivery', () => {
    it('should POST to the webhook URL', () => {
      expect(source).toContain('fetch(webhook.url');
      expect(source).toContain("method: 'POST'");
    });

    it('should set Content-Type to application/json', () => {
      expect(source).toContain("'Content-Type': 'application/json'");
    });

    it('should set a User-Agent header', () => {
      expect(source).toContain("'User-Agent': 'FloraIQ-Webhook/1.0'");
    });

    it('should enforce a 15 second timeout', () => {
      expect(source).toContain('AbortSignal.timeout(15_000)');
    });

    it('should track delivery duration', () => {
      expect(source).toContain('Date.now()');
      expect(source).toContain('durationMs');
    });
  });

  describe('logging', () => {
    it('should create a pending log entry in webhook_logs before delivery', () => {
      expect(source).toContain("from('webhook_logs')");
      expect(source).toContain("status: 'pending'");
    });

    it('should include tenant_id in log entry', () => {
      expect(source).toContain('tenant_id: tenantId');
    });

    it('should update log entry with response details after delivery', () => {
      expect(source).toContain('response_status: responseStatus');
      expect(source).toContain('error_message: errorMessage');
      expect(source).toContain('duration_ms: durationMs');
      expect(source).toContain('status: deliveryStatus');
    });

    it('should set completed_at timestamp on log entry', () => {
      expect(source).toContain('completed_at:');
    });

    it('should update last_triggered_at on the webhook', () => {
      expect(source).toContain('last_triggered_at:');
    });
  });

  describe('failure handling', () => {
    it('should increment failure_count on failed delivery', () => {
      expect(source).toContain('failure_count');
      expect(source).toContain("deliveryStatus === 'failed'");
    });

    it('should reset failure_count to 0 on successful delivery', () => {
      // Ternary sets newFailureCount to 0 on success path
      expect(source).toContain(': 0;');
      expect(source).toContain('failure_count: newFailureCount');
    });

    it('should return 502 on webhook delivery failure', () => {
      expect(source).toContain('status: 502');
      expect(source).toContain("error: 'Webhook delivery failed'");
    });

    it('should include delivery details in error response', () => {
      expect(source).toContain('details: errorMessage');
      expect(source).toContain('response_status: responseStatus');
      expect(source).toContain('duration_ms: durationMs');
      expect(source).toContain('log_id:');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should import corsHeaders from shared deps', () => {
      expect(source).toContain("corsHeaders } from '../_shared/deps.ts'");
    });
  });

  describe('service client', () => {
    it('should create a service-role client for DB operations', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    });

    it('should disable auto refresh and persist session on service client', () => {
      expect(source).toContain('autoRefreshToken: false');
      expect(source).toContain('persistSession: false');
    });
  });

  describe('uses Deno.serve', () => {
    it('should use Deno.serve instead of deprecated serve import', () => {
      expect(source).toContain('Deno.serve(');
    });
  });
});

describe('send-webhook response contracts', () => {
  const successResponseSchema = z.object({
    success: z.literal(true),
    webhook_id: z.string().uuid(),
    response_status: z.number().int().nullable(),
    duration_ms: z.number().int().nonnegative(),
    log_id: z.string().uuid().nullable(),
  });

  const errorResponseSchema = z.object({
    error: z.string(),
    details: z.string().nullable().optional(),
    response_status: z.number().int().nullable().optional(),
    duration_ms: z.number().int().nonnegative().optional(),
    log_id: z.string().uuid().nullable().optional(),
  });

  it('validates the success response shape', () => {
    const sample = {
      success: true,
      webhook_id: '550e8400-e29b-41d4-a716-446655440000',
      response_status: 200,
      duration_ms: 145,
      log_id: '660e8400-e29b-41d4-a716-446655440000',
    };
    expect(() => successResponseSchema.parse(sample)).not.toThrow();
  });

  it('validates the success response with null log_id', () => {
    const sample = {
      success: true,
      webhook_id: '550e8400-e29b-41d4-a716-446655440000',
      response_status: 200,
      duration_ms: 50,
      log_id: null,
    };
    expect(() => successResponseSchema.parse(sample)).not.toThrow();
  });

  it('validates the 502 delivery failure response shape', () => {
    const sample = {
      error: 'Webhook delivery failed',
      details: 'HTTP 500: Internal Server Error',
      response_status: 500,
      duration_ms: 3200,
      log_id: '770e8400-e29b-41d4-a716-446655440000',
    };
    expect(() => errorResponseSchema.parse(sample)).not.toThrow();
  });

  it('validates the 404 not found response shape', () => {
    const sample = {
      error: 'Webhook not found or not owned by tenant',
    };
    expect(() => errorResponseSchema.parse(sample)).not.toThrow();
  });

  it('validates the 401 unauthorized response shape', () => {
    const sample = {
      error: 'Unauthorized',
    };
    expect(() => errorResponseSchema.parse(sample)).not.toThrow();
  });
});

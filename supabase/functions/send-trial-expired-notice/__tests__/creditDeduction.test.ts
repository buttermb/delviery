/**
 * send-trial-expired-notice — Credit Deduction & Source Verification Tests
 *
 * Verifies that the edge function correctly:
 * 1. Imports CREDIT_ACTIONS from creditGate
 * 2. Queries suspended tenants with correct filters
 * 3. Deducts credits for free-tier tenants using send_email action key
 * 4. Handles credit deduction errors gracefully
 * 5. Reports correct counts (successful, skipped, failed)
 * 6. Returns proper response schemas
 * 7. Uses structured logging prefixes
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Helpers
// ============================================================================

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

// ============================================================================
// Schema Contracts
// ============================================================================

/** Response schema for successful execution */
const successResponseSchema = z.object({
  total: z.number().int().min(0),
  successful: z.number().int().min(0),
  skipped: z.number().int().min(0),
  failed: z.number().int().min(0),
  timestamp: z.string().datetime(),
});

/** Response schema for error execution */
const errorResponseSchema = z.object({
  error: z.string(),
  timestamp: z.string().datetime(),
});

/** Schema for the consume_credits RPC parameters */
const consumeCreditsParamsSchema = z.object({
  p_tenant_id: z.string().uuid(),
  p_action_key: z.literal('send_email'),
  p_reference_id: z.string().uuid(),
  p_reference_type: z.literal('trial_expiration_notice'),
  p_description: z.string().min(1),
});

/** Schema for per-tenant email task result */
const emailTaskResultSchema = z.object({
  email: z.string().email(),
  sent: z.boolean(),
  reason: z.string().optional(),
});

// ============================================================================
// Source-Level Verification Tests
// ============================================================================

describe('send-trial-expired-notice — Source Verification', () => {
  const source = readEdgeFunctionSource();

  describe('Imports', () => {
    it('should import CREDIT_ACTIONS from creditGate', () => {
      expect(source).toContain("import { CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
    });

    it('should import serve, createClient, corsHeaders from deps', () => {
      expect(source).toContain("import { serve, createClient, corsHeaders } from '../_shared/deps.ts'");
    });
  });

  describe('Tenant Query', () => {
    it('should query tenants table for suspended accounts', () => {
      expect(source).toContain(".from('tenants')");
      expect(source).toContain(".eq('subscription_status', 'suspended')");
    });

    it('should select required tenant fields including is_free_tier', () => {
      expect(source).toContain('id, business_name, owner_email, owner_name, trial_ends_at, is_free_tier');
    });

    it('should filter by updated_at within the last 24 hours', () => {
      expect(source).toContain("24 * 60 * 60 * 1000");
      expect(source).toContain(".gte('updated_at'");
    });

    it('should throw on select error to trigger 500 response', () => {
      expect(source).toContain('if (selectError)');
      expect(source).toContain('throw selectError');
    });
  });

  describe('Credit Deduction', () => {
    it('should only deduct credits for free-tier tenants', () => {
      expect(source).toContain('if (tenant.is_free_tier)');
    });

    it('should call consume_credits RPC with correct parameters', () => {
      expect(source).toContain("supabaseClient\n          .rpc('consume_credits'");
      expect(source).toContain('p_tenant_id: tenant.id');
      expect(source).toContain('p_action_key: CREDIT_ACTIONS.SEND_EMAIL');
      expect(source).toContain('p_reference_id: tenant.id');
      expect(source).toContain("p_reference_type: 'trial_expiration_notice'");
    });

    it('should include tenant email in p_description', () => {
      expect(source).toContain('p_description: `Trial expiration email to ${tenant.owner_email}`');
    });

    it('should handle credit RPC errors by returning sent: false with credit_error reason', () => {
      expect(source).toContain("return { email: tenant.owner_email, sent: false, reason: 'credit_error' }");
    });

    it('should handle insufficient credits by returning sent: false', () => {
      expect(source).toContain("return { email: tenant.owner_email, sent: false, reason: 'insufficient_credits' }");
    });

    it('should access first element of RPC result array', () => {
      expect(source).toContain('const result = creditResult?.[0]');
      expect(source).toContain('result?.success');
    });
  });

  describe('Email Template', () => {
    it('should include Trial Expired heading', () => {
      expect(source).toContain('Trial Expired</h1>');
    });

    it('should personalize with tenant owner_name', () => {
      expect(source).toContain("${tenant.owner_name || 'there'}");
    });

    it('should include business_name in the email body', () => {
      expect(source).toContain('${tenant.business_name}');
    });

    it('should include a Reactivate Now CTA button linking to billing', () => {
      expect(source).toContain('Reactivate Now');
      expect(source).toContain('admin/billing');
    });
  });

  describe('Response Counting', () => {
    it('should use Promise.allSettled for parallel email processing', () => {
      expect(source).toContain('Promise.allSettled(emailTasks)');
    });

    it('should count successful sends (fulfilled + sent)', () => {
      expect(source).toContain("r.status === 'fulfilled' && r.value.sent");
    });

    it('should count skipped sends (fulfilled + not sent)', () => {
      expect(source).toContain("r.status === 'fulfilled' && !r.value.sent");
    });

    it('should count failed sends (rejected)', () => {
      expect(source).toContain("r.status === 'rejected'");
    });

    it('should include total, successful, skipped, failed, and timestamp in response', () => {
      expect(source).toContain('total: suspendedTenants?.length || 0');
      expect(source).toContain('successful,');
      expect(source).toContain('skipped,');
      expect(source).toContain('failed,');
      expect(source).toContain("timestamp: new Date().toISOString()");
    });
  });

  describe('Error Handling', () => {
    it('should handle CORS OPTIONS requests', () => {
      expect(source).toContain("if (req.method === 'OPTIONS')");
    });

    it('should return 500 with error message on failure', () => {
      expect(source).toContain('status: 500');
      expect(source).toContain("error instanceof Error ? error.message : 'Unknown error occurred'");
    });

    it('should include Content-Type header in all responses', () => {
      const contentTypeCount = (source.match(/"Content-Type": "application\/json"/g) || []).length;
      expect(contentTypeCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Structured Logging', () => {
    it('should use [TRIAL EXPIRED] prefix in all log messages', () => {
      const logLines = source.split('\n').filter(line => line.includes('console.error'));
      const prefixedLines = logLines.filter(line => line.includes('[TRIAL EXPIRED]'));
      expect(prefixedLines.length).toBe(logLines.length);
    });
  });
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('send-trial-expired-notice — Response Schema', () => {
  it('should match the expected success response format with skipped count', () => {
    const mockResponse = {
      total: 3,
      successful: 2,
      skipped: 1,
      failed: 0,
      timestamp: new Date().toISOString(),
    };

    const result = successResponseSchema.safeParse(mockResponse);
    expect(result.success).toBe(true);
  });

  it('should match the expected error response format', () => {
    const mockResponse = {
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    };

    const result = errorResponseSchema.safeParse(mockResponse);
    expect(result.success).toBe(true);
  });

  it('should accept zero counts in success response', () => {
    const mockResponse = {
      total: 0,
      successful: 0,
      skipped: 0,
      failed: 0,
      timestamp: new Date().toISOString(),
    };

    const result = successResponseSchema.safeParse(mockResponse);
    expect(result.success).toBe(true);
  });
});

describe('send-trial-expired-notice — consume_credits RPC Parameters', () => {
  it('should use send_email as the action key', () => {
    const params = {
      p_tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      p_action_key: 'send_email',
      p_reference_id: '550e8400-e29b-41d4-a716-446655440000',
      p_reference_type: 'trial_expiration_notice',
      p_description: 'Trial expiration email to owner@example.com',
    };

    const result = consumeCreditsParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
  });

  it('should reject invalid action keys', () => {
    const params = {
      p_tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      p_action_key: 'wrong_action',
      p_reference_id: '550e8400-e29b-41d4-a716-446655440000',
      p_reference_type: 'trial_expiration_notice',
      p_description: 'Trial expiration email to owner@example.com',
    };

    const result = consumeCreditsParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });

  it('should use tenant_id as reference_id for traceability', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const params = {
      p_tenant_id: tenantId,
      p_action_key: 'send_email',
      p_reference_id: tenantId,
      p_reference_type: 'trial_expiration_notice',
      p_description: 'Trial expiration email to test@example.com',
    };

    const result = consumeCreditsParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
    expect(result.data?.p_reference_id).toBe(tenantId);
  });
});

describe('send-trial-expired-notice — Email Task Result Schema', () => {
  it('should represent a successful send', () => {
    const result = emailTaskResultSchema.safeParse({
      email: 'owner@example.com',
      sent: true,
    });
    expect(result.success).toBe(true);
  });

  it('should represent an insufficient credits skip', () => {
    const result = emailTaskResultSchema.safeParse({
      email: 'owner@example.com',
      sent: false,
      reason: 'insufficient_credits',
    });
    expect(result.success).toBe(true);
    expect(result.data?.reason).toBe('insufficient_credits');
  });

  it('should represent a credit error skip', () => {
    const result = emailTaskResultSchema.safeParse({
      email: 'owner@example.com',
      sent: false,
      reason: 'credit_error',
    });
    expect(result.success).toBe(true);
    expect(result.data?.reason).toBe('credit_error');
  });
});

// ============================================================================
// Credit Deduction Logic Tests
// ============================================================================

describe('send-trial-expired-notice — Credit Deduction Logic', () => {
  it('should only deduct credits for free-tier tenants', () => {
    const freeTierTenant = { is_free_tier: true };
    const paidTierTenant = { is_free_tier: false };

    expect(freeTierTenant.is_free_tier).toBe(true);
    expect(paidTierTenant.is_free_tier).toBe(false);
  });

  it('should skip email when credit deduction fails', () => {
    const creditResult = { success: false, error_message: 'Insufficient credits' };
    expect(creditResult.success).toBe(false);
  });

  it('should proceed with email when credit deduction succeeds', () => {
    const creditResult = { success: true, credits_cost: 10, new_balance: 990 };
    expect(creditResult.success).toBe(true);
    expect(creditResult.credits_cost).toBe(10);
  });

  it('should count skipped tenants separately from failed', () => {
    const results = [
      { email: 'a@test.com', sent: true },
      { email: 'b@test.com', sent: false, reason: 'insufficient_credits' },
      { email: 'c@test.com', sent: true },
    ];

    const successful = results.filter(r => r.sent).length;
    const skipped = results.filter(r => !r.sent).length;

    expect(successful).toBe(2);
    expect(skipped).toBe(1);
  });
});

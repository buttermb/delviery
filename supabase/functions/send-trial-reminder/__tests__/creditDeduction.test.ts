/**
 * Send Trial Reminder — Source-Level Verification Tests
 *
 * Verifies that the send-trial-reminder edge function properly integrates
 * credit deduction, auth handling, and validation patterns.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

// ── Credit Deduction Tests ────────────────────────────────────────────────

describe('Send Trial Reminder — Credit Deduction', () => {
  const source = readEdgeFunctionSource();

  it('should import checkCreditsAvailable from creditGate', () => {
    expect(source).toContain("import { checkCreditsAvailable, CREDIT_ACTIONS } from");
    expect(source).toContain("creditGate.ts");
  });

  it('should use CREDIT_ACTIONS.SEND_EMAIL for the credit check', () => {
    expect(source).toContain('CREDIT_ACTIONS.SEND_EMAIL');
  });

  it('should call checkCreditsAvailable before sending email', () => {
    const creditCheckIndex = source.indexOf('checkCreditsAvailable');
    const emailContentIndex = source.indexOf('Email content based on days remaining');

    expect(creditCheckIndex).toBeGreaterThan(-1);
    expect(emailContentIndex).toBeGreaterThan(-1);
    expect(creditCheckIndex).toBeLessThan(emailContentIndex);
  });

  it('should call consume_credits RPC with correct parameters', () => {
    expect(source).toContain('consume_credits');
    expect(source).toContain('p_tenant_id: tenant_id');
    expect(source).toContain('p_action_key: CREDIT_ACTIONS.SEND_EMAIL');
    expect(source).toContain('p_reference_type: "trial_reminder"');
  });

  it('should check isFreeTier before consuming credits', () => {
    expect(source).toContain('creditCheck.isFreeTier');
    expect(source).toContain('creditCheck.hasCredits');
  });

  it('should proceed with reminder even when credits are insufficient', () => {
    expect(source).toContain(
      'Proceeding with reminder anyway (critical system notification)'
    );
  });

  it('should handle credit check errors gracefully without blocking', () => {
    expect(source).toContain('Credit check error (proceeding anyway)');
  });

  it('should track creditDeducted status in response', () => {
    expect(source).toContain('let creditDeducted = false');
    expect(source).toContain('creditDeducted = true');
    expect(source).toContain('creditDeducted');
    expect(source).toMatch(/JSON\.stringify\(\{[^}]*creditDeducted/);
  });

  it('should include p_description with days_remaining context', () => {
    expect(source).toContain('p_description:');
    expect(source).toContain('days_remaining');
  });

  it('should not block the reminder on credit deduction failure', () => {
    const creditSection = source.slice(
      source.indexOf('Credit deduction for send_email'),
      source.indexOf('Email content based on days remaining')
    );

    expect(creditSection).toContain('try {');
    expect(creditSection).toContain('} catch (creditErr');
  });

  it('should log insufficient credits with balance and cost details', () => {
    expect(source).toContain('creditCheck.balance');
    expect(source).toContain('creditCheck.cost');
  });
});

// ── Auth & Validation Tests ───────────────────────────────────────────────

describe('Send Trial Reminder — Auth Handling', () => {
  const source = readEdgeFunctionSource();

  it('should skip auth when INTERNAL_API_KEY is not configured', () => {
    // The auth block is guarded by `if (INTERNAL_API_KEY)`
    // meaning empty string (not configured) skips the check
    expect(source).toContain('if (INTERNAL_API_KEY)');
    expect(source).toContain('INTERNAL_API_KEY not configured');
  });

  it('should not return 500 when INTERNAL_API_KEY is missing', () => {
    // The old pattern returned 500 for unconfigured key.
    // The new pattern skips auth, so no 500 for missing config.
    expect(source).not.toContain('Function not properly configured');
  });

  it('should return 403 for unauthorized requests when key IS configured', () => {
    expect(source).toContain('Unauthorized');
    expect(source).toContain('status: 403');
  });

  it('should check x-internal-api-key header', () => {
    expect(source).toContain('x-internal-api-key');
  });
});

describe('Send Trial Reminder — Validation', () => {
  const source = readEdgeFunctionSource();

  it('should validate tenant_id and days_remaining are present', () => {
    expect(source).toContain('!tenant_id');
    expect(source).toContain('days_remaining === undefined');
  });

  it('should return 200 for missing fields (cron-friendly)', () => {
    // Extract the validation response block
    const validationIndex = source.indexOf('Missing required fields');
    expect(validationIndex).toBeGreaterThan(-1);

    // Find the status code near the validation response
    const validationBlock = source.slice(
      validationIndex - 200,
      validationIndex + 200
    );
    expect(validationBlock).toContain('status: 200');
    expect(validationBlock).toContain('success: false');
  });

  it('should handle CORS preflight', () => {
    expect(source).toContain('req.method === "OPTIONS"');
    expect(source).toContain('corsHeaders');
  });
});

// ── Caller Integration Tests ──────────────────────────────────────────────

describe('Check Trial Reminders — Caller Integration', () => {
  const callerPath = path.resolve(__dirname, '..', '..', 'check-trial-reminders', 'index.ts');
  const callerSource = fs.readFileSync(callerPath, 'utf-8');

  it('should pass x-internal-api-key header when calling send-trial-reminder', () => {
    expect(callerSource).toContain('"x-internal-api-key"');
    expect(callerSource).toContain('INTERNAL_API_KEY');
  });

  it('should call the send-trial-reminder function endpoint', () => {
    expect(callerSource).toContain('send-trial-reminder');
  });

  it('should send reminder data as JSON body', () => {
    expect(callerSource).toContain('JSON.stringify(reminder)');
  });
});

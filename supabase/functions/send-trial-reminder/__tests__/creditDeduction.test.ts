/**
 * Send Trial Reminder — Credit Deduction Tests
 *
 * Verifies that the send-trial-reminder edge function properly integrates
 * credit deduction for the send_email action (10 credits).
 *
 * These are source-level verification tests that ensure the correct
 * credit gating pattern is present in the edge function code.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

// ── Tests ──────────────────────────────────────────────────────────────────

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
    // The credit check is wrapped in a try-catch that doesn't return early
    // The insufficient credits case logs a warning but continues
    expect(source).toContain(
      'Proceeding with reminder anyway (critical system notification)'
    );
  });

  it('should handle credit check errors gracefully without blocking', () => {
    // Credit errors are caught and logged, not re-thrown
    expect(source).toContain('Credit check error (proceeding anyway)');
  });

  it('should track creditDeducted status in response', () => {
    expect(source).toContain('let creditDeducted = false');
    expect(source).toContain('creditDeducted = true');
    expect(source).toContain('creditDeducted');
    // Verify it's included in the response
    expect(source).toMatch(/JSON\.stringify\(\{[^}]*creditDeducted/);
  });

  it('should include p_description with days_remaining context', () => {
    expect(source).toContain('p_description:');
    expect(source).toContain('days_remaining');
  });

  it('should not block the reminder on credit deduction failure', () => {
    // The credit deduction block uses a try-catch that doesn't re-throw
    // Verify the credit check section is in its own try-catch
    const creditSection = source.slice(
      source.indexOf('Credit deduction for send_email'),
      source.indexOf('Email content based on days remaining')
    );

    // Should have its own try-catch
    expect(creditSection).toContain('try {');
    expect(creditSection).toContain('} catch (creditErr');
  });

  it('should log insufficient credits with balance and cost details', () => {
    expect(source).toContain('creditCheck.balance');
    expect(source).toContain('creditCheck.cost');
  });
});

/**
 * Send Welcome Email — Credit Deduction Tests
 *
 * Verifies that the send-welcome-email edge function:
 * 1. Imports credit gate utilities
 * 2. Checks credits before sending (free tier)
 * 3. Returns 402 when insufficient credits
 * 4. Consumes credits after successful send
 * 5. Uses the correct action key (send_email, 10 credits)
 * 6. Skips credit operations when tenant_id is null
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SOURCE_PATH = path.resolve(
  __dirname,
  '..',
  'index.ts'
);
const source = fs.readFileSync(SOURCE_PATH, 'utf-8');

// ============================================================================
// 1. Import Verification
// ============================================================================

describe('Send Welcome Email — Credit Gate Imports', () => {
  it('should import checkCreditsAvailable from creditGate', () => {
    expect(source).toContain("import { checkCreditsAvailable, CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
  });

  it('should import CREDIT_ACTIONS from creditGate', () => {
    expect(source).toContain('CREDIT_ACTIONS');
  });
});

// ============================================================================
// 2. Pre-Send Credit Check
// ============================================================================

describe('Send Welcome Email — Pre-Send Credit Check', () => {
  it('should check credits before sending email', () => {
    // The credit check should appear before the Klaviyo send
    const creditCheckIndex = source.indexOf('checkCreditsAvailable(supabase, tenant_id, CREDIT_ACTIONS.SEND_EMAIL)');
    const klaviyoSendIndex = source.indexOf("send-klaviyo-email");

    expect(creditCheckIndex).toBeGreaterThan(-1);
    expect(klaviyoSendIndex).toBeGreaterThan(-1);
    expect(creditCheckIndex).toBeLessThan(klaviyoSendIndex);
  });

  it('should use CREDIT_ACTIONS.SEND_EMAIL action key', () => {
    expect(source).toContain('CREDIT_ACTIONS.SEND_EMAIL');
  });

  it('should only check credits when tenant_id is present', () => {
    // The credit check should be inside an if (tenant_id) block
    const lines = source.split('\n');
    let foundTenantCheck = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('if (tenant_id)') &&
          source.slice(source.indexOf(lines[i])).includes('checkCreditsAvailable')) {
        foundTenantCheck = true;
        break;
      }
    }

    expect(foundTenantCheck).toBe(true);
  });
});

// ============================================================================
// 3. Insufficient Credits Response
// ============================================================================

describe('Send Welcome Email — Insufficient Credits Response', () => {
  it('should return 402 status when credits are insufficient', () => {
    expect(source).toContain('status: 402');
  });

  it('should include INSUFFICIENT_CREDITS error code', () => {
    expect(source).toContain("code: 'INSUFFICIENT_CREDITS'");
  });

  it('should include creditsRequired in 402 response', () => {
    expect(source).toContain('creditsRequired: creditCheck.cost');
  });

  it('should include currentBalance in 402 response', () => {
    expect(source).toContain('currentBalance: creditCheck.balance');
  });

  it('should check isFreeTier && !hasCredits before blocking', () => {
    expect(source).toContain('creditCheck.isFreeTier && !creditCheck.hasCredits');
  });
});

// ============================================================================
// 4. Post-Send Credit Consumption
// ============================================================================

describe('Send Welcome Email — Post-Send Credit Consumption', () => {
  it('should consume credits after successful email send', () => {
    // consume_credits RPC call should exist
    expect(source).toContain("supabase.rpc('consume_credits'");
  });

  it('should only consume credits when email was sent successfully', () => {
    // emailSent flag should gate the consumption
    expect(source).toContain('emailSent && tenant_id');
  });

  it('should pass correct parameters to consume_credits RPC', () => {
    expect(source).toContain('p_tenant_id: tenant_id');
    expect(source).toContain('p_action_key: CREDIT_ACTIONS.SEND_EMAIL');
  });

  it('should include a descriptive message with the email address', () => {
    expect(source).toContain('p_description: `Welcome email sent to ${email}`');
  });

  it('should only consume for free tier tenants', () => {
    // The second checkCreditsAvailable call should check isFreeTier
    const consumeSection = source.slice(source.indexOf('Consume credits after'));
    expect(consumeSection).toContain('creditCheck.isFreeTier');
  });

  it('should consume credits after Klaviyo send, not before', () => {
    const klaviyoIndex = source.indexOf('send-klaviyo-email');
    const consumeIndex = source.indexOf("supabase.rpc('consume_credits'");

    expect(consumeIndex).toBeGreaterThan(klaviyoIndex);
  });
});

// ============================================================================
// 5. Email Send Tracking
// ============================================================================

describe('Send Welcome Email — Email Send Tracking', () => {
  it('should track email send success with emailSent flag', () => {
    expect(source).toContain('let emailSent = false');
    expect(source).toContain('emailSent = true');
  });

  it('should set emailSent to true on successful Klaviyo response', () => {
    // After successful response, emailSent should be set
    const successBlock = source.slice(
      source.indexOf('Sent successfully to:')
    );
    // emailSent = true should appear near the success log
    const nearbyCode = source.slice(
      source.indexOf('Sent successfully to:') - 100,
      source.indexOf('Sent successfully to:') + 100
    );
    expect(nearbyCode).toContain('emailSent = true');
  });

  it('should set emailSent to true in dev mode (no Klaviyo)', () => {
    // In dev mode (no Klaviyo key), email is "sent" (logged)
    expect(source).toContain("emailSent = true; // Count as \"sent\" for dev mode");
  });

  it('should not set emailSent on send failure', () => {
    // After send failure, emailSent stays false
    const failStart = source.indexOf('Failed to send via Resend:');
    const successStart = source.indexOf('Sent successfully to:');
    expect(failStart).toBeGreaterThan(-1);
    expect(successStart).toBeGreaterThan(-1);
    const failureBlock = source.slice(failStart, successStart);
    expect(failureBlock).not.toContain('emailSent = true');
  });
});

// ============================================================================
// 6. Action Key Correctness
// ============================================================================

describe('Send Welcome Email — Action Key', () => {
  it('should use send_email action key which costs 10 credits', () => {
    // Verify the action key is SEND_EMAIL (maps to 'send_email')
    expect(source).toContain('CREDIT_ACTIONS.SEND_EMAIL');
    // Should NOT use a different action key
    expect(source).not.toContain('CREDIT_ACTIONS.SEND_SMS');
    expect(source).not.toContain('CREDIT_ACTIONS.CREATE_ORDER');
  });
});

/**
 * Send Push Notification — Credit Gate Integration Tests
 *
 * Verifies that the send-push-notification edge function:
 * 1. Uses withCreditGate middleware for credit deduction
 * 2. Uses the correct action key (send_push_notification)
 * 3. Has matching client-side credit cost (15 credits)
 * 4. CREDIT_ACTIONS constant includes SEND_PUSH_NOTIFICATION
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  getCreditCost,
  getCreditCostInfo,
} from '../../../../src/lib/credits/creditCosts';

// ── Helpers ──────────────────────────────────────────────────────────────

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(
    __dirname,
    '..',
    'index.ts',
  );
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

function readCreditGateSource(): string {
  const creditGatePath = path.resolve(
    __dirname,
    '..',
    '..',
    '_shared',
    'creditGate.ts',
  );
  return fs.readFileSync(creditGatePath, 'utf-8');
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Send Push Notification — Credit Gate Integration', () => {
  const source = readEdgeFunctionSource();

  describe('withCreditGate middleware', () => {
    it('should import withCreditGate from shared creditGate', () => {
      expect(source).toContain("import");
      expect(source).toContain("withCreditGate");
      expect(source).toContain("creditGate");
    });

    it('should import CREDIT_ACTIONS from shared creditGate', () => {
      expect(source).toContain("CREDIT_ACTIONS");
    });

    it('should call withCreditGate with CREDIT_ACTIONS.SEND_PUSH_NOTIFICATION', () => {
      expect(source).toContain('CREDIT_ACTIONS.SEND_PUSH_NOTIFICATION');
    });

    it('should use withCreditGate as the handler wrapper', () => {
      // The function should return the result of withCreditGate
      expect(source).toMatch(/return\s+withCreditGate\s*\(/);
    });

    it('should use shared deps for corsHeaders', () => {
      expect(source).toContain("from '../_shared/deps.ts'");
      expect(source).toContain("corsHeaders");
    });

    it('should handle OPTIONS preflight before withCreditGate call', () => {
      // OPTIONS should be handled outside the credit gate to avoid unnecessary credit checks
      const optionsIndex = source.indexOf("'OPTIONS'");
      const creditGateCallIndex = source.indexOf("withCreditGate(");
      expect(optionsIndex).toBeGreaterThan(-1);
      expect(creditGateCallIndex).toBeGreaterThan(-1);
      expect(optionsIndex).toBeLessThan(creditGateCallIndex);
    });
  });

  describe('notification logic inside credit gate handler', () => {
    it('should check notification preferences', () => {
      expect(source).toContain('notification_preferences');
      expect(source).toContain('push_enabled');
    });

    it('should fetch push tokens', () => {
      expect(source).toContain('push_tokens');
    });

    it('should send via FCM API', () => {
      expect(source).toContain('fcm.googleapis.com');
    });

    it('should log notifications', () => {
      expect(source).toContain('notifications_log');
    });

    it('should use .maybeSingle() instead of .single()', () => {
      expect(source).not.toContain('.single()');
      expect(source).toContain('.maybeSingle()');
    });
  });
});

describe('CREDIT_ACTIONS constant — SEND_PUSH_NOTIFICATION', () => {
  const creditGateSource = readCreditGateSource();

  it('should define SEND_PUSH_NOTIFICATION in CREDIT_ACTIONS', () => {
    expect(creditGateSource).toContain("SEND_PUSH_NOTIFICATION: 'send_push_notification'");
  });

  it('should be in the Communication section', () => {
    const commSection = creditGateSource.slice(
      creditGateSource.indexOf('// Communication'),
      creditGateSource.indexOf('// Reports'),
    );
    expect(commSection).toContain('SEND_PUSH_NOTIFICATION');
  });
});

describe('Client-side credit cost for send_push_notification', () => {
  it('should cost exactly 15 credits', () => {
    const cost = getCreditCost('send_push_notification');
    expect(cost).toBe(15);
  });

  it('should have full cost info defined', () => {
    const info = getCreditCostInfo('send_push_notification');
    expect(info).not.toBeNull();
    expect(info?.actionKey).toBe('send_push_notification');
    expect(info?.actionName).toBe('Send Push Notification');
    expect(info?.credits).toBe(15);
    expect(info?.category).toBe('crm');
  });

  it('should not be a free action', () => {
    const cost = getCreditCost('send_push_notification');
    expect(cost).toBeGreaterThan(0);
  });

  it('should cost less than SMS (25) but more than email (10)', () => {
    const pushCost = getCreditCost('send_push_notification');
    const smsCost = getCreditCost('send_sms');
    const emailCost = getCreditCost('send_email');

    expect(pushCost).toBeLessThan(smsCost);
    expect(pushCost).toBeGreaterThan(emailCost);
  });
});

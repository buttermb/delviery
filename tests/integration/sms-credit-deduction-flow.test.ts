/**
 * SMS Credit Deduction Flow - End-to-End Integration Test
 *
 * Tests the complete credit deduction lifecycle for SMS sending:
 * 1. Pre-flight credit check before SMS send
 * 2. Credits deducted (25 credits for single SMS)
 * 3. SMS sent via provider (Twilio)
 * 4. Transaction logged with SMS reference
 * 5. Response headers include credit info
 * 6. Credits refunded if SMS delivery fails
 * 7. Insufficient credits blocks SMS with 402
 * 8. Paid tier users bypass credit check
 * 9. Bulk SMS uses volume discount (20 credits each)
 * 10. Analytics events tracked for credit actions
 *
 * Uses in-memory system simulation (no live services required).
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface TenantCredits {
  tenantId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  isFreeTier: boolean;
  creditsUsedToday: number;
}

interface CreditTransaction {
  id: string;
  tenantId: string;
  amount: number;
  balanceAfter: number;
  transactionType: 'usage' | 'refund' | 'purchase' | 'free_grant';
  actionType: string;
  referenceId: string | null;
  referenceType: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface SmsMessage {
  id: string;
  tenantId: string;
  to: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  externalId: string | null;
  createdAt: string;
}

interface AnalyticsEvent {
  tenantId: string;
  eventType: string;
  creditsAtEvent: number;
  actionAttempted: string | null;
  metadata: Record<string, unknown>;
}

interface CreditGateResponse {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

// ============================================================================
// Credit Cost Constants (mirroring creditCosts.ts)
// ============================================================================

const CREDIT_COSTS: Record<string, number> = {
  send_sms: 25,
  send_bulk_sms: 20,
  send_email: 10,
};

const FREE_TIER_DAILY_SMS_LIMIT = 2;

// ============================================================================
// In-Memory SMS Credit System Simulation
// ============================================================================

/**
 * Simulates the SMS credit deduction system:
 * - Credit gate middleware (withCreditGate)
 * - consume_credits RPC
 * - SMS provider (Twilio)
 * - Transaction logging
 * - Analytics tracking
 * - Refund on failure
 */
class SmsCreditSystem {
  tenants: Map<string, TenantCredits> = new Map();
  transactions: CreditTransaction[] = [];
  messages: SmsMessage[] = [];
  analytics: AnalyticsEvent[] = [];
  dailySmsCount: Map<string, number> = new Map(); // tenantId -> count today

  // Controls for simulating failures
  smsProviderShouldFail = false;
  smsProviderFailureMessage = 'SMS delivery failed';

  // ========================================================================
  // Setup
  // ========================================================================

  setTenantCredits(tenantId: string, balance: number, isFreeTier: boolean): void {
    this.tenants.set(tenantId, {
      tenantId,
      balance,
      lifetimeEarned: balance + 500,
      lifetimeSpent: 500,
      isFreeTier,
      creditsUsedToday: 0,
    });
    this.dailySmsCount.set(tenantId, 0);
  }

  getTenantCredits(tenantId: string): TenantCredits | null {
    return this.tenants.get(tenantId) ?? null;
  }

  // ========================================================================
  // Core: consume_credits RPC simulation
  // ========================================================================

  consumeCredits(
    tenantId: string,
    actionKey: string,
    referenceId?: string,
    description?: string,
    metadata?: Record<string, unknown>,
  ): { success: boolean; consumed: number; balance: number; error?: string; referenceId?: string } {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return { success: false, consumed: 0, balance: 0, error: 'Tenant not found' };
    }

    const cost = CREDIT_COSTS[actionKey] ?? 0;

    // Idempotency check
    if (referenceId) {
      const existing = this.transactions.find(
        (t) => t.referenceId === referenceId && t.transactionType === 'usage',
      );
      if (existing) {
        return {
          success: true,
          consumed: 0,
          balance: tenant.balance,
          referenceId,
        };
      }
    }

    // Balance check
    if (tenant.balance < cost) {
      return {
        success: false,
        consumed: 0,
        balance: tenant.balance,
        error: `Insufficient credits: need ${cost}, have ${tenant.balance}`,
      };
    }

    // Daily rate limit for free tier
    if (tenant.isFreeTier && actionKey === 'send_sms') {
      const todayCount = this.dailySmsCount.get(tenantId) ?? 0;
      if (todayCount >= FREE_TIER_DAILY_SMS_LIMIT) {
        return {
          success: false,
          consumed: 0,
          balance: tenant.balance,
          error: 'Daily SMS limit reached for free tier',
        };
      }
    }

    // Deduct credits
    tenant.balance -= cost;
    tenant.lifetimeSpent += cost;
    tenant.creditsUsedToday += cost;

    // Track daily SMS count
    if (actionKey === 'send_sms' || actionKey === 'send_bulk_sms') {
      const currentCount = this.dailySmsCount.get(tenantId) ?? 0;
      this.dailySmsCount.set(tenantId, currentCount + 1);
    }

    // Record transaction
    const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const txnRefId = referenceId ?? `ref_${txnId}`;
    this.transactions.push({
      id: txnId,
      tenantId,
      amount: -cost,
      balanceAfter: tenant.balance,
      transactionType: 'usage',
      actionType: actionKey,
      referenceId: txnRefId,
      referenceType: 'sms',
      description: description ?? `Credit deduction for ${actionKey}`,
      metadata: metadata ?? {},
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      consumed: cost,
      balance: tenant.balance,
      referenceId: txnRefId,
    };
  }

  // ========================================================================
  // Core: refund_credits simulation
  // ========================================================================

  refundCredits(
    tenantId: string,
    amount: number,
    actionKey: string,
    reason: string,
    originalReferenceId?: string,
  ): { success: boolean; newBalance: number } {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return { success: false, newBalance: 0 };
    }

    tenant.balance += amount;
    tenant.lifetimeSpent -= amount;

    const txnId = `txn_refund_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.transactions.push({
      id: txnId,
      tenantId,
      amount,
      balanceAfter: tenant.balance,
      transactionType: 'refund',
      actionType: actionKey,
      referenceId: originalReferenceId ?? null,
      referenceType: 'sms_refund',
      description: reason,
      metadata: { original_action: actionKey, refund_reason: reason },
      createdAt: new Date().toISOString(),
    });

    // Track analytics
    this.analytics.push({
      tenantId,
      eventType: 'credit_refunded',
      creditsAtEvent: tenant.balance,
      actionAttempted: actionKey,
      metadata: { amount, reason, original_reference_id: originalReferenceId },
    });

    return { success: true, newBalance: tenant.balance };
  }

  // ========================================================================
  // Core: withCreditGate simulation (edge function middleware)
  // ========================================================================

  withCreditGate(
    tenantId: string,
    actionKey: string,
    handler: () => { success: boolean; data?: Record<string, unknown>; error?: string },
    options?: { referenceId?: string; description?: string },
  ): CreditGateResponse {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return {
        status: 401,
        body: { error: 'Unauthorized - no tenant found' },
        headers: {},
      };
    }

    // Skip credit check for paid tiers
    if (!tenant.isFreeTier) {
      const result = handler();
      return {
        status: result.success ? 200 : 500,
        body: { ...result.data, success: result.success, error: result.error },
        headers: {},
      };
    }

    // Consume credits
    const creditResult = this.consumeCredits(
      tenantId,
      actionKey,
      options?.referenceId,
      options?.description,
    );

    if (!creditResult.success) {
      // Track blocked action
      this.analytics.push({
        tenantId,
        eventType: 'action_blocked_insufficient_credits',
        creditsAtEvent: creditResult.balance,
        actionAttempted: actionKey,
        metadata: {
          credits_required: CREDIT_COSTS[actionKey] ?? 0,
          current_balance: creditResult.balance,
          error: creditResult.error,
        },
      });

      return {
        status: 402,
        body: {
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          message: creditResult.error ?? 'You do not have enough credits to perform this action',
          creditsRequired: CREDIT_COSTS[actionKey] ?? 0,
          currentBalance: creditResult.balance,
          actionKey,
        },
        headers: {},
      };
    }

    // Execute handler
    const result = handler();

    // If handler fails, refund credits
    if (!result.success) {
      this.refundCredits(
        tenantId,
        creditResult.consumed,
        actionKey,
        `Action failed: ${result.error}`,
        creditResult.referenceId,
      );

      return {
        status: 500,
        body: { error: result.error ?? 'Action failed', creditsRefunded: true },
        headers: {
          'X-Credits-Consumed': '0',
          'X-Credits-Remaining': String(
            this.tenants.get(tenantId)?.balance ?? 0,
          ),
        },
      };
    }

    // Track successful consumption
    this.analytics.push({
      tenantId,
      eventType: 'credit_consumed',
      creditsAtEvent: creditResult.balance,
      actionAttempted: actionKey,
      metadata: {
        credits_consumed: creditResult.consumed,
        new_balance: creditResult.balance,
      },
    });

    return {
      status: 200,
      body: { ...result.data, success: true },
      headers: {
        'X-Credits-Consumed': String(creditResult.consumed),
        'X-Credits-Remaining': String(creditResult.balance),
      },
    };
  }

  // ========================================================================
  // SMS Sending (simulates send-sms edge function)
  // ========================================================================

  sendSms(
    tenantId: string,
    to: string,
    message: string,
    referenceId?: string,
  ): CreditGateResponse {
    return this.withCreditGate(
      tenantId,
      'send_sms',
      () => {
        if (this.smsProviderShouldFail) {
          return { success: false, error: this.smsProviderFailureMessage };
        }

        const smsId = `sms_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const externalId = `SM${Math.random().toString(36).slice(2, 14)}`;

        this.messages.push({
          id: smsId,
          tenantId,
          to,
          body: message,
          status: 'sent',
          externalId,
          createdAt: new Date().toISOString(),
        });

        return {
          success: true,
          data: { sid: externalId, message: 'SMS sent successfully' },
        };
      },
      { referenceId, description: `SMS to ${to}` },
    );
  }

  // ========================================================================
  // Bulk SMS Sending (simulates bulk SMS edge function)
  // ========================================================================

  sendBulkSms(
    tenantId: string,
    recipients: Array<{ to: string; message: string }>,
  ): {
    totalCost: number;
    sent: number;
    failed: number;
    responses: CreditGateResponse[];
    insufficientCredits: boolean;
  } {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return {
        totalCost: 0,
        sent: 0,
        failed: 0,
        responses: [],
        insufficientCredits: true,
      };
    }

    const perSmsCost = CREDIT_COSTS['send_bulk_sms'];
    const totalCost = recipients.length * perSmsCost;

    // Pre-check total cost for free tier
    if (tenant.isFreeTier && tenant.balance < totalCost) {
      return {
        totalCost,
        sent: 0,
        failed: 0,
        responses: [
          {
            status: 402,
            body: {
              error: 'Insufficient credits for bulk SMS',
              creditsRequired: totalCost,
              currentBalance: tenant.balance,
              recipientCount: recipients.length,
              perSmsCost,
            },
            headers: {},
          },
        ],
        insufficientCredits: true,
      };
    }

    const responses: CreditGateResponse[] = [];
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const response = this.withCreditGate(
        tenantId,
        'send_bulk_sms',
        () => {
          if (this.smsProviderShouldFail) {
            return { success: false, error: this.smsProviderFailureMessage };
          }

          const smsId = `sms_bulk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const externalId = `SM${Math.random().toString(36).slice(2, 14)}`;

          this.messages.push({
            id: smsId,
            tenantId,
            to: recipient.to,
            body: recipient.message,
            status: 'sent',
            externalId,
            createdAt: new Date().toISOString(),
          });

          return {
            success: true,
            data: { sid: externalId, to: recipient.to },
          };
        },
        { description: `Bulk SMS to ${recipient.to}` },
      );

      responses.push(response);
      if (response.status === 200) {
        sent++;
      } else {
        failed++;
      }
    }

    return {
      totalCost: sent * perSmsCost,
      sent,
      failed,
      responses,
      insufficientCredits: false,
    };
  }

  // ========================================================================
  // Query helpers
  // ========================================================================

  getTransactions(tenantId: string): CreditTransaction[] {
    return this.transactions.filter((t) => t.tenantId === tenantId);
  }

  getMessages(tenantId: string): SmsMessage[] {
    return this.messages.filter((m) => m.tenantId === tenantId);
  }

  getAnalytics(tenantId: string, eventType?: string): AnalyticsEvent[] {
    return this.analytics.filter(
      (a) =>
        a.tenantId === tenantId && (!eventType || a.eventType === eventType),
    );
  }
}

// ============================================================================
// Test Suite
// ============================================================================

const TENANT_FREE = 'tenant-free-001';
const TENANT_PAID = 'tenant-paid-001';

describe('SMS Credit Deduction Flow - End-to-End', () => {
  let system: SmsCreditSystem;

  beforeEach(() => {
    system = new SmsCreditSystem();
    system.setTenantCredits(TENANT_FREE, 500, true);
    system.setTenantCredits(TENANT_PAID, 0, false);
    system.smsProviderShouldFail = false;
  });

  // ==========================================================================
  // 1. Pre-flight Credit Check
  // ==========================================================================

  describe('Step 1: Pre-flight credit check before SMS send', () => {
    it('should allow SMS when balance >= 25 credits', () => {
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Hello!');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should block SMS when balance < 25 credits', () => {
      system.setTenantCredits(TENANT_FREE, 10, true);
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Hello!');
      expect(response.status).toBe(402);
      expect(response.body.code).toBe('INSUFFICIENT_CREDITS');
      expect(response.body.creditsRequired).toBe(25);
      expect(response.body.currentBalance).toBe(10);
    });

    it('should block SMS when balance is exactly 0', () => {
      system.setTenantCredits(TENANT_FREE, 0, true);
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Hello!');
      expect(response.status).toBe(402);
      expect(response.body.currentBalance).toBe(0);
    });

    it('should allow SMS when balance equals exactly 25', () => {
      system.setTenantCredits(TENANT_FREE, 25, true);
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Hello!');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 for unknown tenant', () => {
      const response = system.sendSms('unknown-tenant', '+15551234567', 'Hello!');
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Unauthorized');
    });
  });

  // ==========================================================================
  // 2. Credit Deduction (25 credits for single SMS)
  // ==========================================================================

  describe('Step 2: Credits deducted correctly (25 per SMS)', () => {
    it('should deduct exactly 25 credits for a single SMS', () => {
      const before = system.getTenantCredits(TENANT_FREE)!.balance;
      system.sendSms(TENANT_FREE, '+15551234567', 'Test message');
      const after = system.getTenantCredits(TENANT_FREE)!.balance;

      expect(before - after).toBe(25);
      expect(after).toBe(475);
    });

    it('should deduct 25 credits for each sequential SMS', () => {
      system.sendSms(TENANT_FREE, '+15551111111', 'First message');
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(475);

      system.sendSms(TENANT_FREE, '+15552222222', 'Second message');
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(450);
    });

    it('should deduct to exactly 0 when balance is 25', () => {
      system.setTenantCredits(TENANT_FREE, 25, true);
      system.sendSms(TENANT_FREE, '+15551234567', 'Last message');
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(0);
    });

    it('should update lifetime_spent correctly', () => {
      const before = system.getTenantCredits(TENANT_FREE)!.lifetimeSpent;
      system.sendSms(TENANT_FREE, '+15551234567', 'Test');
      const after = system.getTenantCredits(TENANT_FREE)!.lifetimeSpent;

      expect(after - before).toBe(25);
    });

    it('should show correct credit cost for send_sms action', () => {
      expect(CREDIT_COSTS['send_sms']).toBe(25);
    });

    it('should show volume discount for send_bulk_sms action', () => {
      expect(CREDIT_COSTS['send_bulk_sms']).toBe(20);
      expect(CREDIT_COSTS['send_bulk_sms']).toBeLessThan(CREDIT_COSTS['send_sms']);
    });
  });

  // ==========================================================================
  // 3. SMS Sent via Provider
  // ==========================================================================

  describe('Step 3: SMS sent via provider (Twilio simulation)', () => {
    it('should send SMS and return external SID', () => {
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Order shipped!');
      expect(response.status).toBe(200);
      expect(response.body.sid).toBeDefined();
      expect(typeof response.body.sid).toBe('string');
    });

    it('should record SMS in message history', () => {
      system.sendSms(TENANT_FREE, '+15559876543', 'Your order is ready');
      const messages = system.getMessages(TENANT_FREE);

      expect(messages).toHaveLength(1);
      expect(messages[0].to).toBe('+15559876543');
      expect(messages[0].body).toBe('Your order is ready');
      expect(messages[0].status).toBe('sent');
      expect(messages[0].externalId).toBeTruthy();
    });

    it('should record multiple SMS messages', () => {
      system.sendSms(TENANT_FREE, '+15551111111', 'Message 1');
      system.sendSms(TENANT_FREE, '+15552222222', 'Message 2');
      expect(system.getMessages(TENANT_FREE)).toHaveLength(2);
    });

    it('should not record SMS when credits are insufficient', () => {
      system.setTenantCredits(TENANT_FREE, 5, true);
      system.sendSms(TENANT_FREE, '+15551234567', 'Should not send');
      expect(system.getMessages(TENANT_FREE)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 4. Transaction Logged with SMS Reference
  // ==========================================================================

  describe('Step 4: Transaction logged with SMS reference', () => {
    it('should create a usage transaction for SMS', () => {
      system.sendSms(TENANT_FREE, '+15551234567', 'Test', 'sms-ref-001');
      const txns = system.getTransactions(TENANT_FREE);

      expect(txns).toHaveLength(1);
      expect(txns[0].transactionType).toBe('usage');
      expect(txns[0].actionType).toBe('send_sms');
      expect(txns[0].amount).toBe(-25);
      expect(txns[0].referenceId).toBe('sms-ref-001');
      expect(txns[0].referenceType).toBe('sms');
    });

    it('should include description with phone number', () => {
      system.sendSms(TENANT_FREE, '+15551234567', 'Hello');
      const txns = system.getTransactions(TENANT_FREE);
      expect(txns[0].description).toContain('+15551234567');
    });

    it('should have correct balance_after in transaction', () => {
      system.sendSms(TENANT_FREE, '+15551234567', 'Test');
      const txns = system.getTransactions(TENANT_FREE);
      expect(txns[0].balanceAfter).toBe(475);
    });

    it('should auto-generate reference ID when not provided', () => {
      system.sendSms(TENANT_FREE, '+15551234567', 'Test');
      const txns = system.getTransactions(TENANT_FREE);
      expect(txns[0].referenceId).toBeTruthy();
    });

    it('should handle idempotent requests with same reference ID', () => {
      system.sendSms(TENANT_FREE, '+15551234567', 'Test', 'idempotent-001');
      const balanceAfterFirst = system.getTenantCredits(TENANT_FREE)!.balance;

      // Same reference ID should not deduct again
      system.consumeCredits(TENANT_FREE, 'send_sms', 'idempotent-001');
      const balanceAfterSecond = system.getTenantCredits(TENANT_FREE)!.balance;

      expect(balanceAfterFirst).toBe(balanceAfterSecond);
    });

    it('should not create transaction when SMS is blocked', () => {
      system.setTenantCredits(TENANT_FREE, 5, true);
      system.sendSms(TENANT_FREE, '+15551234567', 'Should not log');

      const usageTxns = system
        .getTransactions(TENANT_FREE)
        .filter((t) => t.transactionType === 'usage');
      expect(usageTxns).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 5. Response Headers Include Credit Info
  // ==========================================================================

  describe('Step 5: Response headers include credit info', () => {
    it('should include X-Credits-Consumed header on success', () => {
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Test');
      expect(response.headers['X-Credits-Consumed']).toBe('25');
    });

    it('should include X-Credits-Remaining header on success', () => {
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Test');
      expect(response.headers['X-Credits-Remaining']).toBe('475');
    });

    it('should update remaining credits across multiple sends', () => {
      const r1 = system.sendSms(TENANT_FREE, '+15551111111', 'First');
      expect(r1.headers['X-Credits-Remaining']).toBe('475');

      const r2 = system.sendSms(TENANT_FREE, '+15552222222', 'Second');
      expect(r2.headers['X-Credits-Remaining']).toBe('450');
    });

    it('should not include credit headers on 402 response', () => {
      system.setTenantCredits(TENANT_FREE, 5, true);
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Test');
      expect(response.status).toBe(402);
      expect(response.headers['X-Credits-Consumed']).toBeUndefined();
    });
  });

  // ==========================================================================
  // 6. Credits Refunded on SMS Delivery Failure
  // ==========================================================================

  describe('Step 6: Credits refunded if SMS delivery fails', () => {
    it('should refund 25 credits when SMS provider fails', () => {
      system.smsProviderShouldFail = true;
      const balanceBefore = system.getTenantCredits(TENANT_FREE)!.balance;

      system.sendSms(TENANT_FREE, '+15551234567', 'Will fail');
      const balanceAfter = system.getTenantCredits(TENANT_FREE)!.balance;

      // Credits should be restored
      expect(balanceAfter).toBe(balanceBefore);
    });

    it('should create refund transaction on failure', () => {
      system.smsProviderShouldFail = true;
      system.sendSms(TENANT_FREE, '+15551234567', 'Will fail');

      const refundTxns = system
        .getTransactions(TENANT_FREE)
        .filter((t) => t.transactionType === 'refund');
      expect(refundTxns).toHaveLength(1);
      expect(refundTxns[0].amount).toBe(25);
      expect(refundTxns[0].actionType).toBe('send_sms');
      expect(refundTxns[0].description).toContain('Action failed');
    });

    it('should have both usage and refund transactions on failure', () => {
      system.smsProviderShouldFail = true;
      system.sendSms(TENANT_FREE, '+15551234567', 'Will fail');

      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(2);

      const usageTxn = txns.find((t) => t.transactionType === 'usage');
      const refundTxn = txns.find((t) => t.transactionType === 'refund');

      expect(usageTxn).toBeDefined();
      expect(refundTxn).toBeDefined();
      expect(usageTxn!.amount).toBe(-25);
      expect(refundTxn!.amount).toBe(25);
    });

    it('should show X-Credits-Consumed as 0 on failure with refund', () => {
      system.smsProviderShouldFail = true;
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Will fail');
      expect(response.status).toBe(500);
      expect(response.headers['X-Credits-Consumed']).toBe('0');
    });

    it('should indicate credits were refunded in response body', () => {
      system.smsProviderShouldFail = true;
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Will fail');
      expect(response.body.creditsRefunded).toBe(true);
    });

    it('should not record SMS in message history on failure', () => {
      system.smsProviderShouldFail = true;
      system.sendSms(TENANT_FREE, '+15551234567', 'Will fail');
      expect(system.getMessages(TENANT_FREE)).toHaveLength(0);
    });

    it('should track refund analytics event', () => {
      system.smsProviderShouldFail = true;
      system.sendSms(TENANT_FREE, '+15551234567', 'Will fail');

      const refundEvents = system.getAnalytics(TENANT_FREE, 'credit_refunded');
      expect(refundEvents).toHaveLength(1);
      expect(refundEvents[0].actionAttempted).toBe('send_sms');
      expect(refundEvents[0].metadata.amount).toBe(25);
    });
  });

  // ==========================================================================
  // 7. Insufficient Credits Blocks SMS with 402
  // ==========================================================================

  describe('Step 7: Insufficient credits blocks SMS with 402', () => {
    it('should return 402 status code', () => {
      system.setTenantCredits(TENANT_FREE, 10, true);
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Blocked');
      expect(response.status).toBe(402);
    });

    it('should include INSUFFICIENT_CREDITS error code', () => {
      system.setTenantCredits(TENANT_FREE, 10, true);
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Blocked');
      expect(response.body.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('should include credit requirements in error body', () => {
      system.setTenantCredits(TENANT_FREE, 15, true);
      const response = system.sendSms(TENANT_FREE, '+15551234567', 'Blocked');
      expect(response.body.creditsRequired).toBe(25);
      expect(response.body.currentBalance).toBe(15);
      expect(response.body.actionKey).toBe('send_sms');
    });

    it('should track blocked action in analytics', () => {
      system.setTenantCredits(TENANT_FREE, 10, true);
      system.sendSms(TENANT_FREE, '+15551234567', 'Blocked');

      const blockedEvents = system.getAnalytics(
        TENANT_FREE,
        'action_blocked_insufficient_credits',
      );
      expect(blockedEvents).toHaveLength(1);
      expect(blockedEvents[0].actionAttempted).toBe('send_sms');
      expect(blockedEvents[0].metadata.credits_required).toBe(25);
      expect(blockedEvents[0].metadata.current_balance).toBe(10);
    });

    it('should not change balance on blocked SMS', () => {
      system.setTenantCredits(TENANT_FREE, 10, true);
      const before = system.getTenantCredits(TENANT_FREE)!.balance;

      system.sendSms(TENANT_FREE, '+15551234567', 'Blocked');
      const after = system.getTenantCredits(TENANT_FREE)!.balance;

      expect(after).toBe(before);
    });
  });

  // ==========================================================================
  // 8. Paid Tier Users Bypass Credit Check
  // ==========================================================================

  describe('Step 8: Paid tier users bypass credit check', () => {
    it('should allow SMS for paid tier with 0 balance', () => {
      const response = system.sendSms(TENANT_PAID, '+15551234567', 'Paid user');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not deduct credits for paid tier', () => {
      const before = system.getTenantCredits(TENANT_PAID)!.balance;
      system.sendSms(TENANT_PAID, '+15551234567', 'Paid user');
      const after = system.getTenantCredits(TENANT_PAID)!.balance;
      expect(after).toBe(before);
    });

    it('should not create credit transaction for paid tier', () => {
      system.sendSms(TENANT_PAID, '+15551234567', 'Paid user');
      expect(system.getTransactions(TENANT_PAID)).toHaveLength(0);
    });

    it('should not include credit headers for paid tier', () => {
      const response = system.sendSms(TENANT_PAID, '+15551234567', 'Paid user');
      expect(response.headers['X-Credits-Consumed']).toBeUndefined();
      expect(response.headers['X-Credits-Remaining']).toBeUndefined();
    });

    it('should still record SMS in message history for paid tier', () => {
      system.sendSms(TENANT_PAID, '+15551234567', 'Paid message');
      expect(system.getMessages(TENANT_PAID)).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 9. Bulk SMS Uses Volume Discount
  // ==========================================================================

  describe('Step 9: Bulk SMS uses volume discount (20 credits each)', () => {
    it('should charge 20 credits per recipient for bulk SMS', () => {
      system.setTenantCredits(TENANT_FREE, 1000, true);
      const recipients = [
        { to: '+15551111111', message: 'Promo 1' },
        { to: '+15552222222', message: 'Promo 2' },
        { to: '+15553333333', message: 'Promo 3' },
      ];

      const result = system.sendBulkSms(TENANT_FREE, recipients);
      expect(result.sent).toBe(3);
      expect(result.totalCost).toBe(60); // 3 × 20

      const balance = system.getTenantCredits(TENANT_FREE)!.balance;
      expect(balance).toBe(940); // 1000 - 60
    });

    it('should pre-check total cost before sending', () => {
      system.setTenantCredits(TENANT_FREE, 50, true);
      const recipients = [
        { to: '+15551111111', message: 'Msg 1' },
        { to: '+15552222222', message: 'Msg 2' },
        { to: '+15553333333', message: 'Msg 3' }, // Total: 60 credits needed
      ];

      const result = system.sendBulkSms(TENANT_FREE, recipients);
      expect(result.insufficientCredits).toBe(true);
      expect(result.sent).toBe(0);
      expect(result.responses[0].status).toBe(402);
      expect(result.responses[0].body.creditsRequired).toBe(60);
    });

    it('should create individual transactions for each bulk SMS', () => {
      system.setTenantCredits(TENANT_FREE, 200, true);
      const recipients = [
        { to: '+15551111111', message: 'Msg 1' },
        { to: '+15552222222', message: 'Msg 2' },
      ];

      system.sendBulkSms(TENANT_FREE, recipients);

      const usageTxns = system
        .getTransactions(TENANT_FREE)
        .filter((t) => t.transactionType === 'usage');
      expect(usageTxns).toHaveLength(2);
      expect(usageTxns.every((t) => t.actionType === 'send_bulk_sms')).toBe(true);
      expect(usageTxns.every((t) => t.amount === -20)).toBe(true);
    });

    it('should record all bulk SMS in message history', () => {
      system.setTenantCredits(TENANT_FREE, 200, true);
      system.sendBulkSms(TENANT_FREE, [
        { to: '+15551111111', message: 'Bulk 1' },
        { to: '+15552222222', message: 'Bulk 2' },
      ]);

      const messages = system.getMessages(TENANT_FREE);
      expect(messages).toHaveLength(2);
    });

    it('should not send any bulk SMS if total cost exceeds balance', () => {
      system.setTenantCredits(TENANT_FREE, 30, true);
      const result = system.sendBulkSms(TENANT_FREE, [
        { to: '+15551111111', message: 'Should not send' },
        { to: '+15552222222', message: 'Should not send' },
      ]);

      expect(result.sent).toBe(0);
      expect(system.getMessages(TENANT_FREE)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 10. Analytics Events Tracked
  // ==========================================================================

  describe('Step 10: Analytics events tracked for credit actions', () => {
    it('should track credit_consumed on successful SMS', () => {
      system.sendSms(TENANT_FREE, '+15551234567', 'Tracked');

      const events = system.getAnalytics(TENANT_FREE, 'credit_consumed');
      expect(events).toHaveLength(1);
      expect(events[0].actionAttempted).toBe('send_sms');
      expect(events[0].metadata.credits_consumed).toBe(25);
      expect(events[0].metadata.new_balance).toBe(475);
    });

    it('should track action_blocked on insufficient credits', () => {
      system.setTenantCredits(TENANT_FREE, 5, true);
      system.sendSms(TENANT_FREE, '+15551234567', 'Blocked');

      const events = system.getAnalytics(
        TENANT_FREE,
        'action_blocked_insufficient_credits',
      );
      expect(events).toHaveLength(1);
      expect(events[0].actionAttempted).toBe('send_sms');
    });

    it('should track credit_refunded on SMS failure', () => {
      system.smsProviderShouldFail = true;
      system.sendSms(TENANT_FREE, '+15551234567', 'Will fail');

      const events = system.getAnalytics(TENANT_FREE, 'credit_refunded');
      expect(events).toHaveLength(1);
      expect(events[0].metadata.amount).toBe(25);
      expect(events[0].metadata.reason).toContain('Action failed');
    });

    it('should not create analytics for paid tier SMS', () => {
      system.sendSms(TENANT_PAID, '+15551234567', 'Paid tier');
      expect(system.getAnalytics(TENANT_PAID)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Free Tier Daily Limits
  // ==========================================================================

  describe('Free tier daily SMS limits', () => {
    it('should enforce daily SMS limit for free tier (2 per day)', () => {
      system.setTenantCredits(TENANT_FREE, 1000, true);

      // First 2 should succeed
      const r1 = system.sendSms(TENANT_FREE, '+15551111111', 'SMS 1');
      expect(r1.status).toBe(200);

      const r2 = system.sendSms(TENANT_FREE, '+15552222222', 'SMS 2');
      expect(r2.status).toBe(200);

      // Third should be blocked by daily limit
      const r3 = system.sendSms(TENANT_FREE, '+15553333333', 'SMS 3');
      expect(r3.status).toBe(402);
      expect(r3.body.message).toContain('Daily SMS limit');
    });

    it('should not enforce daily limit for paid tier', () => {
      system.setTenantCredits(TENANT_PAID, 0, false);

      // Send many SMS - paid tier has no daily limit
      for (let i = 0; i < 5; i++) {
        const response = system.sendSms(
          TENANT_PAID,
          `+1555000000${i}`,
          `SMS ${i}`,
        );
        expect(response.status).toBe(200);
      }
    });

    it('should still deduct credits even within daily limit', () => {
      system.setTenantCredits(TENANT_FREE, 100, true);

      system.sendSms(TENANT_FREE, '+15551111111', 'SMS 1');
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(75);

      system.sendSms(TENANT_FREE, '+15552222222', 'SMS 2');
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(50);
    });
  });

  // ==========================================================================
  // Complete End-to-End Scenario
  // ==========================================================================

  describe('Complete end-to-end: Send SMS with credit deduction', () => {
    it('should complete full flow: check → deduct → send → log → respond', () => {
      system.setTenantCredits(TENANT_FREE, 500, true);

      // 1. Send SMS
      const response = system.sendSms(
        TENANT_FREE,
        '+15559876543',
        'Your order #1234 is ready for pickup!',
        'sms-order-1234',
      );

      // 2. Verify success response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sid).toBeDefined();

      // 3. Verify credits deducted
      const credits = system.getTenantCredits(TENANT_FREE)!;
      expect(credits.balance).toBe(475);

      // 4. Verify transaction created
      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(1);
      expect(txns[0].transactionType).toBe('usage');
      expect(txns[0].actionType).toBe('send_sms');
      expect(txns[0].amount).toBe(-25);
      expect(txns[0].referenceId).toBe('sms-order-1234');
      expect(txns[0].balanceAfter).toBe(475);

      // 5. Verify SMS recorded
      const messages = system.getMessages(TENANT_FREE);
      expect(messages).toHaveLength(1);
      expect(messages[0].to).toBe('+15559876543');
      expect(messages[0].body).toBe('Your order #1234 is ready for pickup!');
      expect(messages[0].status).toBe('sent');

      // 6. Verify response headers
      expect(response.headers['X-Credits-Consumed']).toBe('25');
      expect(response.headers['X-Credits-Remaining']).toBe('475');

      // 7. Verify analytics tracked
      const events = system.getAnalytics(TENANT_FREE, 'credit_consumed');
      expect(events).toHaveLength(1);
    });

    it('should complete full flow with refund on failure: check → deduct → fail → refund → log', () => {
      system.setTenantCredits(TENANT_FREE, 500, true);
      system.smsProviderShouldFail = true;
      system.smsProviderFailureMessage = 'Invalid phone number format';

      // 1. Attempt SMS (will fail)
      const response = system.sendSms(
        TENANT_FREE,
        '+15559876543',
        'This will fail',
        'sms-fail-001',
      );

      // 2. Verify error response
      expect(response.status).toBe(500);
      expect(response.body.creditsRefunded).toBe(true);

      // 3. Verify credits refunded (back to original)
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(500);

      // 4. Verify both transactions (usage + refund)
      const txns = system.getTransactions(TENANT_FREE);
      expect(txns).toHaveLength(2);

      const usageTxn = txns.find((t) => t.transactionType === 'usage')!;
      const refundTxn = txns.find((t) => t.transactionType === 'refund')!;

      expect(usageTxn.amount).toBe(-25);
      expect(refundTxn.amount).toBe(25);
      expect(refundTxn.description).toContain('Action failed');

      // 5. Verify no SMS in message history
      expect(system.getMessages(TENANT_FREE)).toHaveLength(0);

      // 6. Verify headers show 0 consumed
      expect(response.headers['X-Credits-Consumed']).toBe('0');

      // 7. Verify analytics tracked refund
      const refundEvents = system.getAnalytics(TENANT_FREE, 'credit_refunded');
      expect(refundEvents).toHaveLength(1);
    });

    it('should handle mixed success/failure: send, send, blocked', () => {
      system.setTenantCredits(TENANT_FREE, 55, true);

      // First SMS: success (55 → 30)
      const r1 = system.sendSms(TENANT_FREE, '+15551111111', 'First');
      expect(r1.status).toBe(200);
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(30);

      // Second SMS: success (30 → 5)
      const r2 = system.sendSms(TENANT_FREE, '+15552222222', 'Second');
      expect(r2.status).toBe(200);
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(5);

      // Third SMS: blocked (5 < 25)
      const r3 = system.sendSms(TENANT_FREE, '+15553333333', 'Blocked');
      expect(r3.status).toBe(402);
      expect(system.getTenantCredits(TENANT_FREE)!.balance).toBe(5);

      // Verify: 2 messages sent, 2 transactions
      expect(system.getMessages(TENANT_FREE)).toHaveLength(2);
      const usageTxns = system
        .getTransactions(TENANT_FREE)
        .filter((t) => t.transactionType === 'usage');
      expect(usageTxns).toHaveLength(2);

      // Verify: 1 blocked event
      const blockedEvents = system.getAnalytics(
        TENANT_FREE,
        'action_blocked_insufficient_credits',
      );
      expect(blockedEvents).toHaveLength(1);
    });
  });
});

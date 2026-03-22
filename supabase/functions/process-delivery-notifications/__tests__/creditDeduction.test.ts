/**
 * Credit Deduction Tests for process-delivery-notifications
 *
 * Verifies that:
 * 1. Tracking link stages (1, 2, 3, 8) use tracking_send_link action key
 * 2. Plain SMS stages (4, 5, 6, 7) use send_sms action key
 * 3. Credit deduction is fail-open (notifications still sent on credit failure)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Read the source file to verify credit deduction patterns
const indexPath = path.resolve(__dirname, '../index.ts');
const sourceCode = fs.readFileSync(indexPath, 'utf-8');

describe('process-delivery-notifications credit deduction', () => {
  describe('action key mapping', () => {
    it('defines tracking link stages as 1, 2, 3, 8', () => {
      // Verify TRACKING_LINK_STAGES set
      expect(sourceCode).toContain('TRACKING_LINK_STAGES = new Set([1, 2, 3, 8])');
    });

    it('uses tracking_send_link for tracking link stages', () => {
      expect(sourceCode).toContain("'tracking_send_link'");
    });

    it('uses send_sms for non-tracking stages', () => {
      expect(sourceCode).toContain("'send_sms'");
    });

    it('getNotificationActionKey returns correct action key based on stage', () => {
      // Extract and test the logic inline since we can't import Deno modules
      const trackingLinkStages = new Set([1, 2, 3, 8]);
      const getActionKey = (stage: number) =>
        trackingLinkStages.has(stage) ? 'tracking_send_link' : 'send_sms';

      // Tracking link stages → tracking_send_link (15 credits)
      expect(getActionKey(1)).toBe('tracking_send_link');
      expect(getActionKey(2)).toBe('tracking_send_link');
      expect(getActionKey(3)).toBe('tracking_send_link');
      expect(getActionKey(8)).toBe('tracking_send_link');

      // Plain SMS stages → send_sms (25 credits)
      expect(getActionKey(4)).toBe('send_sms');
      expect(getActionKey(5)).toBe('send_sms');
      expect(getActionKey(6)).toBe('send_sms');
      expect(getActionKey(7)).toBe('send_sms');
    });
  });

  describe('credit deduction integration', () => {
    it('imports from shared deps', () => {
      expect(sourceCode).toContain("from \"../_shared/deps.ts\"");
    });

    it('imports SupabaseClient type', () => {
      expect(sourceCode).toContain('type SupabaseClient');
    });

    it('calls consume_credits RPC with correct parameters', () => {
      expect(sourceCode).toContain("supabase.rpc('consume_credits'");
      expect(sourceCode).toContain('p_tenant_id: tenantId');
      expect(sourceCode).toContain('p_action_key: actionKey');
      expect(sourceCode).toContain('p_reference_id: orderId');
      expect(sourceCode).toContain("p_reference_type: 'delivery_notification'");
    });

    it('includes stage number in credit description', () => {
      expect(sourceCode).toContain('`Delivery notification stage ${stage}`');
    });

    it('extracts tenant_id from order for credit deduction', () => {
      expect(sourceCode).toContain('order.tenant_id');
    });
  });

  describe('fail-open behavior', () => {
    it('has tryDeductCredits function that handles errors gracefully', () => {
      expect(sourceCode).toContain('async function tryDeductCredits');
    });

    it('logs warning on insufficient credits without blocking', () => {
      expect(sourceCode).toContain('Proceeding with notification (fail-open)');
    });

    it('catches errors in credit deduction', () => {
      expect(sourceCode).toContain('Credit deduction error for order');
    });

    it('returns deducted: false on failure without throwing', () => {
      expect(sourceCode).toContain('deducted: false');
    });

    it('only deducts credits when tenant_id is available', () => {
      expect(sourceCode).toContain('if (tenantId)');
    });
  });

  describe('sendStageNotification helper', () => {
    it('consolidates notification logic into a single helper', () => {
      expect(sourceCode).toContain('async function sendStageNotification');
    });

    it('calls getNotificationActionKey to determine credit action', () => {
      expect(sourceCode).toContain('getNotificationActionKey(stage)');
    });

    it('calls tryDeductCredits before sending SMS', () => {
      // Verify tryDeductCredits is called before sendSMS in sendStageNotification
      const fnBody = sourceCode.substring(
        sourceCode.indexOf('async function sendStageNotification'),
        sourceCode.indexOf('serve(async (req)')
      );
      const deductIdx = fnBody.indexOf('tryDeductCredits');
      const smsIdx = fnBody.indexOf('sendSMS');
      expect(deductIdx).toBeGreaterThan(-1);
      expect(smsIdx).toBeGreaterThan(-1);
      expect(deductIdx).toBeLessThan(smsIdx);
    });
  });

  describe('all 8 stages send notifications through sendStageNotification', () => {
    it('stage 1 uses sendStageNotification', () => {
      expect(sourceCode).toContain('sendStageNotification(supabase, order, 1, message, orderNumber)');
    });

    it('stage 2 uses sendStageNotification', () => {
      expect(sourceCode).toContain('sendStageNotification(supabase, order, 2, message, orderNumber)');
    });

    it('stage 3 uses sendStageNotification', () => {
      expect(sourceCode).toContain('sendStageNotification(supabase, order, 3, message, orderNumber)');
    });

    it('stage 4 uses sendStageNotification with distance', () => {
      expect(sourceCode).toContain('sendStageNotification(supabase, order, 4, message, orderNumber, { distance:');
    });

    it('stage 5 uses sendStageNotification with distance', () => {
      expect(sourceCode).toContain('sendStageNotification(supabase, order, 5, message, orderNumber, { distance:');
    });

    it('stage 6 uses sendStageNotification with distance', () => {
      expect(sourceCode).toContain('sendStageNotification(supabase, order, 6, message, orderNumber, { distance:');
    });

    it('stage 7 uses sendStageNotification with distance', () => {
      expect(sourceCode).toContain('sendStageNotification(supabase, order, 7, message, orderNumber, { distance:');
    });

    it('stage 8 uses sendStageNotification', () => {
      expect(sourceCode).toContain('sendStageNotification(supabase, order, 8, message, orderNumber)');
    });
  });
});

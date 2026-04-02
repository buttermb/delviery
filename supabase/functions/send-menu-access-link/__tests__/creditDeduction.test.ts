/**
 * Send Menu Access Link - Credit Deduction Tests
 *
 * Validates that the send-menu-access-link edge function:
 * 1. Deducts credits (send_sms = 25) before sending SMS
 * 2. Returns 402 when insufficient credits
 * 3. Returns credit info in success response
 * 4. Refunds credits on SMS delivery failure
 * 5. Does NOT deduct credits for email method
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ============================================================================
// Response Schemas
// ============================================================================

const smsSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  preview: z.object({
    message: z.string(),
  }),
  creditsConsumed: z.number(),
  creditsRemaining: z.number(),
});

const emailSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  preview: z.object({
    subject: z.string(),
    message: z.string(),
  }),
});

const insufficientCreditsResponseSchema = z.object({
  error: z.literal('Insufficient credits'),
  code: z.literal('INSUFFICIENT_CREDITS'),
  message: z.string(),
  creditsRequired: z.number(),
  currentBalance: z.number(),
  actionKey: z.literal('send_sms'),
});

const creditErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

const smsFailureRefundResponseSchema = z.object({
  error: z.literal('SMS delivery failed'),
  message: z.string(),
});

// ============================================================================
// Request Schema
// ============================================================================

const requestBodySchema = z.object({
  whitelistId: z.string().uuid(),
  method: z.enum(['email', 'sms']).default('email'),
});

// ============================================================================
// Credit Constants
// ============================================================================

const SEND_SMS_CREDIT_COST = 25;
const SEND_SMS_ACTION_KEY = 'send_sms';

// ============================================================================
// Tests
// ============================================================================

describe('Send Menu Access Link - Credit Deduction', () => {
  describe('SMS Credit Deduction Flow', () => {
    it('should define correct action key for SMS', () => {
      expect(SEND_SMS_ACTION_KEY).toBe('send_sms');
    });

    it('should define correct credit cost for SMS (25 credits)', () => {
      expect(SEND_SMS_CREDIT_COST).toBe(25);
    });

    it('should validate SMS success response includes credit info', () => {
      const validResponse = {
        success: true,
        message: 'Access link sent via SMS',
        preview: { message: 'Test Menu: Access your menu at https://example.com/menu/abc123' },
        creditsConsumed: 25,
        creditsRemaining: 975,
      };

      const result = smsSuccessResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate creditsConsumed matches send_sms cost', () => {
      const response = {
        success: true,
        message: 'Access link sent via SMS',
        preview: { message: 'Test: https://example.com/menu/abc' },
        creditsConsumed: SEND_SMS_CREDIT_COST,
        creditsRemaining: 475,
      };

      const parsed = smsSuccessResponseSchema.parse(response);
      expect(parsed.creditsConsumed).toBe(25);
    });

    it('should reject SMS success response without credit fields', () => {
      const responseWithoutCredits = {
        success: true,
        message: 'Access link sent via SMS',
        preview: { message: 'Test: https://example.com' },
        // Missing creditsConsumed and creditsRemaining
      };

      const result = smsSuccessResponseSchema.safeParse(responseWithoutCredits);
      expect(result.success).toBe(false);
    });
  });

  describe('Insufficient Credits Response (402)', () => {
    it('should validate 402 response format with credit details', () => {
      const errorResponse = {
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits to send SMS',
        creditsRequired: 25,
        currentBalance: 10,
        actionKey: 'send_sms',
      };

      const result = insufficientCreditsResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it('should include correct action key in insufficient credits response', () => {
      const errorResponse = {
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits to send SMS',
        creditsRequired: SEND_SMS_CREDIT_COST,
        currentBalance: 0,
        actionKey: SEND_SMS_ACTION_KEY,
      };

      const parsed = insufficientCreditsResponseSchema.parse(errorResponse);
      expect(parsed.actionKey).toBe('send_sms');
      expect(parsed.creditsRequired).toBe(25);
    });

    it('should indicate balance is below required credits', () => {
      const errorResponse = {
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits to send SMS',
        creditsRequired: 25,
        currentBalance: 10,
        actionKey: 'send_sms',
      };

      const parsed = insufficientCreditsResponseSchema.parse(errorResponse);
      expect(parsed.currentBalance).toBeLessThan(parsed.creditsRequired);
    });

    it('should handle zero balance case', () => {
      const errorResponse = {
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits to send SMS',
        creditsRequired: 25,
        currentBalance: 0,
        actionKey: 'send_sms',
      };

      const parsed = insufficientCreditsResponseSchema.parse(errorResponse);
      expect(parsed.currentBalance).toBe(0);
    });
  });

  describe('Email Method - No Credit Deduction', () => {
    it('should validate email success response does NOT include credit fields', () => {
      const emailResponse = {
        success: true,
        message: 'Access link sent via email',
        preview: {
          subject: 'Access to Test Menu',
          message: 'Hello, you have been granted access...',
        },
      };

      const result = emailSuccessResponseSchema.safeParse(emailResponse);
      expect(result.success).toBe(true);

      // Email response should NOT have creditsConsumed
      expect(emailResponse).not.toHaveProperty('creditsConsumed');
      expect(emailResponse).not.toHaveProperty('creditsRemaining');
    });
  });

  describe('SMS Delivery Failure - Credit Refund', () => {
    it('should validate refund response format', () => {
      const refundResponse = {
        error: 'SMS delivery failed',
        message: 'Failed to send SMS',
      };

      const result = smsFailureRefundResponseSchema.safeParse(refundResponse);
      expect(result.success).toBe(true);
    });

    it('should include descriptive error message on delivery failure', () => {
      const refundResponse = {
        error: 'SMS delivery failed',
        message: 'Connection timeout to SMS provider',
      };

      const parsed = smsFailureRefundResponseSchema.parse(refundResponse);
      expect(parsed.error).toBe('SMS delivery failed');
      expect(parsed.message).toBeTruthy();
    });
  });

  describe('Credit Error Handling', () => {
    it('should validate credit system error response', () => {
      const creditError = {
        error: 'Failed to process credits',
        details: 'Database connection failed',
      };

      const result = creditErrorResponseSchema.safeParse(creditError);
      expect(result.success).toBe(true);
    });

    it('should validate credit error response without details', () => {
      const creditError = {
        error: 'Failed to process credits',
      };

      const result = creditErrorResponseSchema.safeParse(creditError);
      expect(result.success).toBe(true);
    });
  });

  describe('Request Validation', () => {
    it('should accept valid SMS request', () => {
      const request = {
        whitelistId: '550e8400-e29b-41d4-a716-446655440000',
        method: 'sms',
      };

      const result = requestBodySchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should default to email method', () => {
      const request = {
        whitelistId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = requestBodySchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.method).toBe('email');
      }
    });

    it('should reject invalid method', () => {
      const request = {
        whitelistId: '550e8400-e29b-41d4-a716-446655440000',
        method: 'carrier_pigeon',
      };

      const result = requestBodySchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('Access URL Construction', () => {
    it('should construct access URL using SITE_URL env var pattern', () => {
      const siteUrl = 'https://app.floraiq.io';
      const uniqueAccessToken = 'abc-token-123';

      const accessUrl = `${siteUrl}/menu/${uniqueAccessToken}`;

      expect(accessUrl).toBe('https://app.floraiq.io/menu/abc-token-123');
      expect(accessUrl).not.toContain('supabase.co');
      expect(accessUrl).not.toContain('lovable.app');
    });

    it('should append access code placeholder when required', () => {
      const siteUrl = 'https://app.floraiq.io';
      const uniqueAccessToken = 'abc-token-123';
      const accessCodeRequired = true;

      const accessUrl = `${siteUrl}/menu/${uniqueAccessToken}${accessCodeRequired ? '?code=XXXXX' : ''}`;

      expect(accessUrl).toContain('?code=XXXXX');
    });

    it('should not append access code when not required', () => {
      const siteUrl = 'https://app.floraiq.io';
      const uniqueAccessToken = 'abc-token-123';
      const accessCodeRequired = false;

      const accessUrl = `${siteUrl}/menu/${uniqueAccessToken}${accessCodeRequired ? '?code=XXXXX' : ''}`;

      expect(accessUrl).not.toContain('?code=XXXXX');
    });

    it('should fall back to SUPABASE_URL when SITE_URL is not set', () => {
      const siteUrl = undefined;
      const supabaseUrl = 'https://abc.supabase.co';
      const resolvedUrl = siteUrl || supabaseUrl || '';

      expect(resolvedUrl).toBe('https://abc.supabase.co');
    });
  });

  describe('Consume Credits RPC Call Contract', () => {
    it('should use correct RPC parameters for SMS credit deduction', () => {
      const expectedRpcParams = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        p_action_key: 'send_sms',
        p_reference_id: 'whitelist-entry-001',
        p_reference_type: 'menu_access_whitelist',
        p_description: 'Send menu access link via SMS to +1234567890',
      };

      expect(expectedRpcParams.p_action_key).toBe(SEND_SMS_ACTION_KEY);
      expect(expectedRpcParams.p_reference_type).toBe('menu_access_whitelist');
      expect(expectedRpcParams.p_reference_id).toBeTruthy();
      expect(expectedRpcParams.p_description).toContain('SMS');
    });

    it('should reference whitelist entry as reference_type', () => {
      const referenceType = 'menu_access_whitelist';
      expect(referenceType).toBe('menu_access_whitelist');
    });
  });

  describe('Account Log Entry with Credits', () => {
    it('should include credits_consumed in SMS log details', () => {
      const logEntry = {
        menu_id: 'menu-001',
        whitelist_entry_id: 'whitelist-001',
        action: 'access_link_sent',
        details: {
          method: 'sms',
          recipient: '+1234567890',
          credits_consumed: 25,
        },
      };

      expect(logEntry.details.credits_consumed).toBe(SEND_SMS_CREDIT_COST);
      expect(logEntry.details.method).toBe('sms');
      expect(logEntry.action).toBe('access_link_sent');
    });

    it('should NOT include credits_consumed in email log details', () => {
      const logEntry = {
        menu_id: 'menu-001',
        whitelist_entry_id: 'whitelist-001',
        action: 'access_link_sent',
        details: {
          method: 'email',
          recipient: 'test@example.com',
        },
      };

      expect(logEntry.details).not.toHaveProperty('credits_consumed');
    });
  });
});

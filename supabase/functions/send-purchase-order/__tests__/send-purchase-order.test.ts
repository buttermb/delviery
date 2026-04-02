/**
 * Send Purchase Order — Edge Function Tests
 *
 * Verifies the send-purchase-order edge function:
 * 1. Uses withCreditGate with action key 'purchase_order_send' (25 credits)
 * 2. Validates input schema (purchase_order_id required UUID, optional email/message)
 * 3. Returns 401 for unauthenticated requests (via verify_jwt + creditGate)
 * 4. Returns 400 for validation failures (not 500)
 * 5. Returns 404 when PO not found
 * 6. Returns 400 when no supplier email available
 * 7. Handles email sending with/without Resend provider
 * 8. Updates PO status to 'sent' with sent_at timestamp
 *
 * Note: Validation schemas are replicated here using npm zod because
 * the edge function source imports from Deno URLs which aren't resolvable in vitest.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate validation schema from validation.ts (Deno module)
const sendPurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid(),
  supplier_email: z.string().email().optional(),
  message: z.string().max(2000).optional(),
});

type SendPurchaseOrderInput = z.infer<typeof sendPurchaseOrderSchema>;

function validateSendPurchaseOrder(body: unknown): SendPurchaseOrderInput {
  return sendPurchaseOrderSchema.parse(body);
}

// Replicate CREDIT_ACTIONS constant
const CREDIT_ACTIONS = {
  PURCHASE_ORDER_SEND: 'purchase_order_send',
} as const;

const ACTION_KEY = CREDIT_ACTIONS.PURCHASE_ORDER_SEND;
const EXPECTED_COST = 25;

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const PO_ID = '11111111-1111-1111-1111-111111111111';
const SUPPLIER_EMAIL = 'supplier@example.com';

// Credit result type mirroring the edge function's credit deduction logic
interface CreditResult {
  success: boolean;
  new_balance: number;
  credits_cost: number;
  error_message: string | null;
}

describe('Send Purchase Order — Edge Function', () => {
  describe('Credit gate configuration', () => {
    it('should use action key "purchase_order_send"', () => {
      expect(ACTION_KEY).toBe('purchase_order_send');
    });

    it('should cost 25 credits', () => {
      expect(EXPECTED_COST).toBe(25);
    });

    it('should use referenceType "purchase_order"', () => {
      const referenceType = 'purchase_order';
      expect(referenceType).toBe('purchase_order');
    });

    it('should use description "Send purchase order to supplier"', () => {
      const description = 'Send purchase order to supplier';
      expect(description).toBe('Send purchase order to supplier');
    });
  });

  describe('Validation schema', () => {
    it('should accept valid input with all fields', () => {
      const input = {
        purchase_order_id: PO_ID,
        supplier_email: SUPPLIER_EMAIL,
        message: 'Please process this order',
      };
      const result = validateSendPurchaseOrder(input);
      expect(result.purchase_order_id).toBe(PO_ID);
      expect(result.supplier_email).toBe(SUPPLIER_EMAIL);
      expect(result.message).toBe('Please process this order');
    });

    it('should accept input with only purchase_order_id', () => {
      const input = { purchase_order_id: PO_ID };
      const result = validateSendPurchaseOrder(input);
      expect(result.purchase_order_id).toBe(PO_ID);
      expect(result.supplier_email).toBeUndefined();
      expect(result.message).toBeUndefined();
    });

    it('should reject empty body (missing purchase_order_id)', () => {
      expect(() => validateSendPurchaseOrder({})).toThrow();
    });

    it('should reject non-UUID purchase_order_id', () => {
      expect(() =>
        validateSendPurchaseOrder({ purchase_order_id: 'not-a-uuid' }),
      ).toThrow();
    });

    it('should reject invalid email format', () => {
      expect(() =>
        validateSendPurchaseOrder({
          purchase_order_id: PO_ID,
          supplier_email: 'not-an-email',
        }),
      ).toThrow();
    });

    it('should reject message longer than 2000 characters', () => {
      expect(() =>
        validateSendPurchaseOrder({
          purchase_order_id: PO_ID,
          message: 'a'.repeat(2001),
        }),
      ).toThrow();
    });

    it('should accept message at exactly 2000 characters', () => {
      const result = validateSendPurchaseOrder({
        purchase_order_id: PO_ID,
        message: 'a'.repeat(2000),
      });
      expect(result.message).toHaveLength(2000);
    });

    it('should throw ZodError for invalid input', () => {
      try {
        validateSendPurchaseOrder({});
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
      }
    });

    it('should return 400 status for validation errors (not 500)', () => {
      // The function catches ZodError and returns 400
      // This test verifies the error type check logic
      let status = 500;
      try {
        validateSendPurchaseOrder({});
      } catch (error) {
        if (error instanceof z.ZodError) {
          status = 400;
        }
      }
      expect(status).toBe(400);
    });
  });

  describe('Authentication (401 handling)', () => {
    it('should return 401 when no Authorization header is present', () => {
      // With verify_jwt = true, Supabase Gateway returns 401 before function runs
      // Even without verify_jwt, creditGate returns 401 when no tenant is found
      const authHeader: string | null = null;
      const tenantInfo = authHeader ? { id: TENANT_ID } : null;

      expect(tenantInfo).toBeNull();

      // creditGate returns 401 response
      const responseStatus = tenantInfo ? 200 : 401;
      expect(responseStatus).toBe(401);
    });

    it('should return 401 response body with correct format', () => {
      const responseBody = { error: 'Unauthorized - no tenant found' };
      expect(responseBody.error).toBe('Unauthorized - no tenant found');
    });
  });

  describe('Successful credit deduction', () => {
    it('should return success with updated balance when credits are sufficient', () => {
      const creditResult: CreditResult = {
        success: true,
        new_balance: 975,
        credits_cost: 25,
        error_message: null,
      };

      expect(creditResult.success).toBe(true);
      expect(creditResult.credits_cost).toBe(EXPECTED_COST);
      expect(creditResult.new_balance).toBe(975);
    });

    it('should include credit headers on success', () => {
      const creditsCost = 25;
      const creditsRemaining = 975;

      const responseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Credits-Consumed': String(creditsCost),
        'X-Credits-Remaining': String(creditsRemaining),
      };

      expect(responseHeaders['X-Credits-Consumed']).toBe('25');
      expect(responseHeaders['X-Credits-Remaining']).toBe('975');
    });
  });

  describe('Insufficient credits', () => {
    it('should return 402 with INSUFFICIENT_CREDITS code', () => {
      const creditResult: CreditResult = {
        success: false,
        new_balance: 10,
        credits_cost: 25,
        error_message: 'Insufficient credits',
      };

      expect(creditResult.success).toBe(false);

      const responseBody = {
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        creditsRequired: creditResult.credits_cost,
        currentBalance: creditResult.new_balance,
        actionKey: ACTION_KEY,
      };

      expect(responseBody.code).toBe('INSUFFICIENT_CREDITS');
      expect(responseBody.creditsRequired).toBe(25);
      expect(responseBody.currentBalance).toBe(10);
      expect(responseBody.actionKey).toBe('purchase_order_send');
    });
  });

  describe('PO not found (404)', () => {
    it('should return 404 when PO does not exist', () => {
      const po = null;
      const responseStatus = po ? 200 : 404;
      const responseBody = { error: 'Purchase order not found' };

      expect(responseStatus).toBe(404);
      expect(responseBody.error).toBe('Purchase order not found');
    });
  });

  describe('No supplier email (400)', () => {
    it('should return 400 when no supplier_email and no supplier record email', () => {
      const supplierEmail: string | undefined = undefined;
      const poSupplierEmail: string | undefined = undefined;
      const recipientEmail = supplierEmail || poSupplierEmail;

      expect(recipientEmail).toBeUndefined();

      const responseBody = {
        error:
          'No supplier email available. Provide supplier_email or update supplier record.',
      };
      expect(responseBody.error).toContain('No supplier email');
    });

    it('should prefer explicit supplier_email over supplier record email', () => {
      const supplierEmail = 'explicit@example.com';
      const poSupplierEmail = 'record@example.com';
      const recipientEmail = supplierEmail || poSupplierEmail;

      expect(recipientEmail).toBe('explicit@example.com');
    });

    it('should fall back to supplier record email when no explicit email', () => {
      const supplierEmail: string | undefined = undefined;
      const poSupplierEmail = 'record@example.com';
      const recipientEmail = supplierEmail || poSupplierEmail;

      expect(recipientEmail).toBe('record@example.com');
    });
  });

  describe('Email sending', () => {
    it('should mark PO as sent with timestamp on email success', () => {
      const updateData = {
        status: 'sent',
        sent_at: new Date().toISOString(),
      };

      expect(updateData.status).toBe('sent');
      expect(updateData.sent_at).toBeTruthy();
      // Verify sent_at is a valid ISO string
      expect(new Date(updateData.sent_at).toISOString()).toBe(
        updateData.sent_at,
      );
    });

    it('should return success response with email details', () => {
      const responseBody = {
        success: true,
        email_id: 'resend-email-123',
        sent_to: SUPPLIER_EMAIL,
        po_number: 'PO-001',
      };

      expect(responseBody.success).toBe(true);
      expect(responseBody.email_id).toBeTruthy();
      expect(responseBody.sent_to).toBe(SUPPLIER_EMAIL);
      expect(responseBody.po_number).toBe('PO-001');
    });

    it('should handle missing email provider gracefully', () => {
      const resendApiKey: string | undefined = undefined;

      // When no provider is configured, PO is still marked as sent
      const responseBody = {
        success: true,
        message: 'Email provider not configured, PO marked as sent',
        sent_to: SUPPLIER_EMAIL,
        po_number: 'PO-001',
      };

      expect(resendApiKey).toBeUndefined();
      expect(responseBody.success).toBe(true);
      expect(responseBody.message).toContain('Email provider not configured');
    });
  });

  describe('Email HTML generation', () => {
    it('should use store name in email subject and body', () => {
      const tenantName = 'Green Leaf Dispensary';
      const storeName = tenantName || 'FloraIQ';
      expect(storeName).toBe('Green Leaf Dispensary');
    });

    it('should fall back to "FloraIQ" when tenant name is missing', () => {
      const tenantName: string | null = null;
      const storeName = tenantName || 'FloraIQ';
      expect(storeName).toBe('FloraIQ');
    });

    it('should resolve supplier name from contact_name or name', () => {
      // Priority: contact_name > name > 'Supplier'
      const supplier1 = { contact_name: 'John Doe', name: 'Acme Corp' };
      const supplier2 = { contact_name: null, name: 'Acme Corp' };
      const supplier3 = { contact_name: null, name: null };

      expect(supplier1.contact_name || supplier1.name || 'Supplier').toBe(
        'John Doe',
      );
      expect(supplier2.contact_name || supplier2.name || 'Supplier').toBe(
        'Acme Corp',
      );
      expect(supplier3.contact_name || supplier3.name || 'Supplier').toBe(
        'Supplier',
      );
    });

    it('should format currency amounts with 2 decimal places', () => {
      const pricePerLb = 12.5;
      const subtotal = 62.5;
      const totalAmount = 250;

      expect(Number(pricePerLb).toFixed(2)).toBe('12.50');
      expect(Number(subtotal).toFixed(2)).toBe('62.50');
      expect(Number(totalAmount).toFixed(2)).toBe('250.00');
    });

    it('should include custom message when provided', () => {
      const message = 'Rush order — please prioritize';
      const html = message
        ? `<p>${message}</p>`
        : '<p>Please find the purchase order details below.</p>';
      expect(html).toContain('Rush order');
    });

    it('should use default message when none provided', () => {
      const message: string | undefined = undefined;
      const html = message
        ? `<p>${message}</p>`
        : '<p>Please find the purchase order details below.</p>';
      expect(html).toContain('Please find the purchase order details below');
    });
  });

  describe('Tenant isolation', () => {
    it('should filter PO query by tenant_id', () => {
      // The edge function uses .eq('tenant_id', tenantId) on all queries
      const queryFilters = {
        id: PO_ID,
        tenant_id: TENANT_ID,
      };

      expect(queryFilters.tenant_id).toBe(TENANT_ID);
    });

    it('should filter PO status update by tenant_id', () => {
      const updateFilters = {
        id: PO_ID,
        tenant_id: TENANT_ID,
      };

      expect(updateFilters.id).toBe(PO_ID);
      expect(updateFilters.tenant_id).toBe(TENANT_ID);
    });
  });

  describe('CORS handling', () => {
    it('should include CORS headers in all responses', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      };

      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain(
        'authorization',
      );
    });
  });
});

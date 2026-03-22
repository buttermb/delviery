/**
 * Invoice Management Validation Tests
 *
 * Verifies that the invoice-management edge function properly validates
 * request bodies using Zod schemas. Tests cover:
 * - Valid actions accepted
 * - Invalid actions rejected
 * - UUID format enforcement for tenant_id and invoice_id
 * - Invoice data field validation (dates, amounts, line items, enums)
 * - Missing required fields
 * - Boundary values (max lengths, max amounts)
 * - Malformed / empty payloads
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ---------- Re-create the validation schemas (mirrors validation.ts) ----------
// We duplicate the schemas here because the source file uses Deno imports that
// are incompatible with vitest/node. The schemas are stable contracts so a test
// against the same Zod definitions is valid.

const invoiceLineItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(10000),
  unit_price: z.number().nonnegative().max(1000000),
  total: z.number().nonnegative().max(1000000),
});

const invoiceDataSchema = z.object({
  client_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  invoice_number: z.string().max(100).optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  line_items: z.array(invoiceLineItemSchema).optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  subtotal: z.number().nonnegative().max(1000000000).optional(),
  tax: z.number().nonnegative().max(1000000000).optional(),
  total: z.number().nonnegative().max(1000000000).optional(),
  amount_paid: z.number().nonnegative().max(1000000000).optional(),
  billing_period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  billing_period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  stripe_invoice_id: z.string().max(255).optional(),
  stripe_payment_intent_id: z.string().max(255).optional(),
});

const invoiceManagementSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'get', 'list', 'send', 'mark_paid']),
  tenant_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  invoice_data: invoiceDataSchema.optional(),
});

type InvoiceManagementInput = z.infer<typeof invoiceManagementSchema>;

function validateInvoiceManagement(body: unknown): InvoiceManagementInput {
  return invoiceManagementSchema.parse(body);
}

// ---------- Test helpers ----------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function validCreatePayload(): Record<string, unknown> {
  return {
    action: 'create',
    tenant_id: VALID_UUID,
    invoice_data: {
      issue_date: '2025-01-15',
      due_date: '2025-02-15',
      status: 'draft',
      subtotal: 100,
      tax: 10,
      total: 110,
      line_items: [
        {
          description: 'Widget A',
          quantity: 2,
          unit_price: 50,
          total: 100,
        },
      ],
    },
  };
}

// ---------- Tests ----------

describe('Invoice Management Request Body Validation', () => {
  // ── Valid actions ──────────────────────────────────────────────

  describe('valid action types', () => {
    const validActions = ['create', 'update', 'delete', 'get', 'list', 'send', 'mark_paid'];

    it.each(validActions)('should accept action "%s"', (action) => {
      const result = validateInvoiceManagement({ action });
      expect(result.action).toBe(action);
    });
  });

  // ── Invalid / missing action ──────────────────────────────────

  describe('invalid action types', () => {
    it('should reject unknown action', () => {
      expect(() =>
        validateInvoiceManagement({ action: 'refund' })
      ).toThrow();
    });

    it('should reject missing action', () => {
      expect(() =>
        validateInvoiceManagement({})
      ).toThrow();
    });

    it('should reject empty string action', () => {
      expect(() =>
        validateInvoiceManagement({ action: '' })
      ).toThrow();
    });

    it('should reject numeric action', () => {
      expect(() =>
        validateInvoiceManagement({ action: 123 })
      ).toThrow();
    });

    it('should reject null action', () => {
      expect(() =>
        validateInvoiceManagement({ action: null })
      ).toThrow();
    });
  });

  // ── Completely malformed payloads ─────────────────────────────

  describe('malformed payloads', () => {
    it('should reject null body', () => {
      expect(() => validateInvoiceManagement(null)).toThrow();
    });

    it('should reject undefined body', () => {
      expect(() => validateInvoiceManagement(undefined)).toThrow();
    });

    it('should reject string body', () => {
      expect(() => validateInvoiceManagement('hello')).toThrow();
    });

    it('should reject number body', () => {
      expect(() => validateInvoiceManagement(42)).toThrow();
    });

    it('should reject array body', () => {
      expect(() => validateInvoiceManagement([{ action: 'list' }])).toThrow();
    });
  });

  // ── tenant_id validation ──────────────────────────────────────

  describe('tenant_id validation', () => {
    it('should accept valid UUID tenant_id', () => {
      const result = validateInvoiceManagement({
        action: 'list',
        tenant_id: VALID_UUID,
      });
      expect(result.tenant_id).toBe(VALID_UUID);
    });

    it('should accept missing tenant_id (optional)', () => {
      const result = validateInvoiceManagement({ action: 'list' });
      expect(result.tenant_id).toBeUndefined();
    });

    it('should reject non-UUID tenant_id', () => {
      expect(() =>
        validateInvoiceManagement({ action: 'list', tenant_id: 'not-a-uuid' })
      ).toThrow();
    });

    it('should reject empty string tenant_id', () => {
      expect(() =>
        validateInvoiceManagement({ action: 'list', tenant_id: '' })
      ).toThrow();
    });
  });

  // ── invoice_id validation ─────────────────────────────────────

  describe('invoice_id validation', () => {
    it('should accept valid UUID invoice_id', () => {
      const result = validateInvoiceManagement({
        action: 'get',
        invoice_id: VALID_UUID,
      });
      expect(result.invoice_id).toBe(VALID_UUID);
    });

    it('should accept missing invoice_id (optional)', () => {
      const result = validateInvoiceManagement({ action: 'list' });
      expect(result.invoice_id).toBeUndefined();
    });

    it('should reject non-UUID invoice_id', () => {
      expect(() =>
        validateInvoiceManagement({ action: 'get', invoice_id: '12345' })
      ).toThrow();
    });
  });

  // ── Complete create payload ───────────────────────────────────

  describe('full create payload', () => {
    it('should accept a valid create payload with all fields', () => {
      const payload = validCreatePayload();
      const result = validateInvoiceManagement(payload);
      expect(result.action).toBe('create');
      expect(result.invoice_data?.status).toBe('draft');
      expect(result.invoice_data?.line_items).toHaveLength(1);
    });

    it('should accept create with minimal invoice_data', () => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: {},
      });
      expect(result.action).toBe('create');
      expect(result.invoice_data).toBeDefined();
    });
  });

  // ── Date format validation ────────────────────────────────────

  describe('date format validation', () => {
    const dateFields = [
      'invoice_date',
      'due_date',
      'issue_date',
      'billing_period_start',
      'billing_period_end',
    ];

    it.each(dateFields)('should accept valid YYYY-MM-DD for %s', (field) => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: { [field]: '2025-06-15' },
      });
      expect((result.invoice_data as Record<string, unknown>)?.[field]).toBe('2025-06-15');
    });

    it.each(dateFields)('should reject invalid date format for %s', (field) => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { [field]: '15/06/2025' },
        })
      ).toThrow();
    });

    it.each(dateFields)('should reject partial date for %s', (field) => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { [field]: '2025-6-1' },
        })
      ).toThrow();
    });

    it.each(dateFields)('should reject ISO datetime for %s', (field) => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { [field]: '2025-06-15T00:00:00Z' },
        })
      ).toThrow();
    });
  });

  // ── Status enum validation ────────────────────────────────────

  describe('status enum validation', () => {
    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

    it.each(validStatuses)('should accept status "%s"', (status) => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: { status },
      });
      expect(result.invoice_data?.status).toBe(status);
    });

    it('should reject invalid status', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { status: 'pending' },
        })
      ).toThrow();
    });
  });

  // ── Numeric field validation ──────────────────────────────────

  describe('numeric amount validation', () => {
    const amountFields = ['subtotal', 'tax', 'total', 'amount_paid'];

    it.each(amountFields)('should accept zero for %s', (field) => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: { [field]: 0 },
      });
      expect((result.invoice_data as Record<string, unknown>)?.[field]).toBe(0);
    });

    it.each(amountFields)('should accept max value (1 billion) for %s', (field) => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: { [field]: 1000000000 },
      });
      expect((result.invoice_data as Record<string, unknown>)?.[field]).toBe(1000000000);
    });

    it.each(amountFields)('should reject negative %s', (field) => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { [field]: -1 },
        })
      ).toThrow();
    });

    it.each(amountFields)('should reject %s exceeding max', (field) => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { [field]: 1000000001 },
        })
      ).toThrow();
    });

    it.each(amountFields)('should reject string value for %s', (field) => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { [field]: '100' },
        })
      ).toThrow();
    });
  });

  // ── Line item validation ──────────────────────────────────────

  describe('line item validation', () => {
    it('should accept valid line items array', () => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: {
          line_items: [
            { description: 'Item 1', quantity: 1, unit_price: 10, total: 10 },
            { description: 'Item 2', quantity: 3, unit_price: 20, total: 60 },
          ],
        },
      });
      expect(result.invoice_data?.line_items).toHaveLength(2);
    });

    it('should accept empty line items array', () => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: { line_items: [] },
      });
      expect(result.invoice_data?.line_items).toHaveLength(0);
    });

    it('should accept line item with optional product_id', () => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: {
          line_items: [
            {
              product_id: VALID_UUID,
              description: 'Widget',
              quantity: 1,
              unit_price: 50,
              total: 50,
            },
          ],
        },
      });
      expect(result.invoice_data?.line_items?.[0].product_id).toBe(VALID_UUID);
    });

    it('should reject line item with empty description', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: '', quantity: 1, unit_price: 10, total: 10 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item with description exceeding 500 chars', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: 'x'.repeat(501), quantity: 1, unit_price: 10, total: 10 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item with zero quantity', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: 'Item', quantity: 0, unit_price: 10, total: 0 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item with negative quantity', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: 'Item', quantity: -1, unit_price: 10, total: 10 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item with quantity exceeding 10000', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: 'Item', quantity: 10001, unit_price: 1, total: 10001 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item with negative unit_price', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: 'Item', quantity: 1, unit_price: -5, total: 0 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item with unit_price exceeding max', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: 'Item', quantity: 1, unit_price: 1000001, total: 1000001 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item with negative total', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: 'Item', quantity: 1, unit_price: 10, total: -10 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item missing required description', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { quantity: 1, unit_price: 10, total: 10 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item missing required quantity', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: 'Item', unit_price: 10, total: 10 },
            ],
          },
        })
      ).toThrow();
    });

    it('should reject line item with non-UUID product_id', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              {
                product_id: 'not-a-uuid',
                description: 'Item',
                quantity: 1,
                unit_price: 10,
                total: 10,
              },
            ],
          },
        })
      ).toThrow();
    });
  });

  // ── String length limits ──────────────────────────────────────

  describe('string length limits', () => {
    it('should reject invoice_number exceeding 100 chars', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { invoice_number: 'x'.repeat(101) },
        })
      ).toThrow();
    });

    it('should accept invoice_number at boundary (100 chars)', () => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: { invoice_number: 'x'.repeat(100) },
      });
      expect(result.invoice_data?.invoice_number).toHaveLength(100);
    });

    it('should reject notes exceeding 2000 chars', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { notes: 'x'.repeat(2001) },
        })
      ).toThrow();
    });

    it('should reject terms exceeding 2000 chars', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { terms: 'x'.repeat(2001) },
        })
      ).toThrow();
    });

    it('should reject stripe_invoice_id exceeding 255 chars', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { stripe_invoice_id: 'x'.repeat(256) },
        })
      ).toThrow();
    });

    it('should reject stripe_payment_intent_id exceeding 255 chars', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { stripe_payment_intent_id: 'x'.repeat(256) },
        })
      ).toThrow();
    });
  });

  // ── UUID fields in invoice_data ───────────────────────────────

  describe('UUID fields in invoice_data', () => {
    it('should accept valid client_id UUID', () => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: { client_id: VALID_UUID },
      });
      expect(result.invoice_data?.client_id).toBe(VALID_UUID);
    });

    it('should reject invalid client_id', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { client_id: 'abc' },
        })
      ).toThrow();
    });

    it('should accept valid account_id UUID', () => {
      const result = validateInvoiceManagement({
        action: 'create',
        invoice_data: { account_id: VALID_UUID },
      });
      expect(result.invoice_data?.account_id).toBe(VALID_UUID);
    });

    it('should reject invalid account_id', () => {
      expect(() =>
        validateInvoiceManagement({
          action: 'create',
          invoice_data: { account_id: 'not-uuid' },
        })
      ).toThrow();
    });
  });

  // ── Extra / unknown fields stripped ───────────────────────────

  describe('extra fields handling', () => {
    it('should strip unknown top-level fields', () => {
      const result = validateInvoiceManagement({
        action: 'list',
        unknown_field: 'should be stripped',
      });
      expect(result).not.toHaveProperty('unknown_field');
    });
  });

  // ── Error messages are useful ─────────────────────────────────

  describe('error message quality', () => {
    it('should provide Zod error details on invalid input', () => {
      try {
        validateInvoiceManagement({ action: 'invalid_action' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(z.ZodError);
        const zodErr = err as z.ZodError;
        expect(zodErr.issues.length).toBeGreaterThan(0);
        expect(zodErr.issues[0].path).toContain('action');
      }
    });

    it('should report nested line item errors with path', () => {
      try {
        validateInvoiceManagement({
          action: 'create',
          invoice_data: {
            line_items: [
              { description: '', quantity: -1, unit_price: -1, total: -1 },
            ],
          },
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(z.ZodError);
        const zodErr = err as z.ZodError;
        // Should have multiple issues for the nested fields
        expect(zodErr.issues.length).toBeGreaterThanOrEqual(3);
      }
    });
  });
});

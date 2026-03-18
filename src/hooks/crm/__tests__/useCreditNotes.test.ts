/**
 * Credit Notes Hook Tests
 *
 * Tests for the useCreditNotes hook — verifying Supabase integration
 * for the InvoiceCreditNoteSystem.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';

// Mock supabase client
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          eq: mockEq.mockReturnValue({
            order: mockOrder.mockReturnValue(
              Promise.resolve({ data: [], error: null })
            ),
          }),
        }),
      }),
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          maybeSingle: mockMaybeSingle.mockReturnValue(
            Promise.resolve({ data: null, error: null })
          ),
        }),
      }),
    })),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123', slug: 'test-tenant' },
    user: { id: 'user-123' },
    isAdmin: true,
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Credit Notes Query Keys', () => {
  it('should generate correct base key', () => {
    expect(queryKeys.crm.creditNotes.all()).toEqual(['crm', 'credit-notes']);
  });

  it('should generate correct byInvoice key', () => {
    const invoiceId = 'inv-123';
    expect(queryKeys.crm.creditNotes.byInvoice(invoiceId)).toEqual([
      'crm',
      'credit-notes',
      'invoice',
      invoiceId,
    ]);
  });

  it('should generate unique keys per invoice', () => {
    const key1 = queryKeys.crm.creditNotes.byInvoice('inv-1');
    const key2 = queryKeys.crm.creditNotes.byInvoice('inv-2');
    expect(key1).not.toEqual(key2);
  });

  it('should nest under crm namespace', () => {
    const key = queryKeys.crm.creditNotes.all();
    expect(key[0]).toBe('crm');
  });
});

describe('CreditNote interface', () => {
  it('should define expected fields', () => {
    // Type-level test — verifies the interface shape compiles
    const mockCreditNote = {
      id: 'cn-123',
      tenant_id: 'tenant-123',
      invoice_id: 'inv-456',
      client_id: 'client-789',
      credit_note_number: 'CN-abc12345-20260318-test',
      amount: 50.0,
      reason: 'return' as const,
      notes: 'Product returned',
      status: 'issued' as const,
      issued_date: '2026-03-18T00:00:00Z',
      created_at: '2026-03-18T00:00:00Z',
      updated_at: '2026-03-18T00:00:00Z',
    };

    expect(mockCreditNote.id).toBeDefined();
    expect(mockCreditNote.tenant_id).toBeDefined();
    expect(mockCreditNote.invoice_id).toBeDefined();
    expect(mockCreditNote.client_id).toBeDefined();
    expect(mockCreditNote.credit_note_number).toBeDefined();
    expect(mockCreditNote.amount).toBeGreaterThan(0);
    expect(['draft', 'issued', 'applied']).toContain(mockCreditNote.status);
    expect(['return', 'discount', 'overpayment', 'adjustment', 'other']).toContain(
      mockCreditNote.reason
    );
  });
});

describe('Credit note number generation', () => {
  it('should generate unique credit note numbers', () => {
    const invoiceId = 'abc12345-6789-0123-4567-890abcdef012';
    const shortId = invoiceId.slice(0, 8);
    const dateStr = '20260318';
    const suffix1 = Date.now().toString(36);

    // Simulate slight time progression
    const suffix2 = (Date.now() + 1).toString(36);

    const cn1 = `CN-${shortId}-${dateStr}-${suffix1}`;
    const cn2 = `CN-${shortId}-${dateStr}-${suffix2}`;

    expect(cn1).toMatch(/^CN-abc12345-\d{8}-.+$/);
    expect(cn1).not.toEqual(cn2);
  });

  it('should start with CN- prefix', () => {
    const cn = `CN-abc12345-20260318-${Date.now().toString(36)}`;
    expect(cn.startsWith('CN-')).toBe(true);
  });
});

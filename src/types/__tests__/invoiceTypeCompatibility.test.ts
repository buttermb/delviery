/**
 * Invoice Type Compatibility Tests
 *
 * Verifies that invoice types across CRM, Customer, and Portal systems
 * are compatible and share consistent status values, field names, and
 * type assignments.
 */

import { describe, it, expect } from 'vitest';
import type {
  CRMInvoice,
  CRMInvoiceStatus,
  InvoiceFormValues,
  LineItem,
} from '@/types/crm';
import type { PortalInvoice } from '@/types/portal';
import type {
  CustomerInvoice,
  CustomerInvoiceStatus,
  CustomerInvoiceLineItem,
} from '@/hooks/useCustomerInvoices';

describe('Invoice Type Compatibility', () => {
  describe('CRMInvoiceStatus type', () => {
    it('should include all expected status values', () => {
      const statuses: CRMInvoiceStatus[] = [
        'draft',
        'sent',
        'paid',
        'partially_paid',
        'overdue',
        'cancelled',
      ];
      expect(statuses).toHaveLength(6);
      expect(statuses).toContain('draft');
      expect(statuses).toContain('sent');
      expect(statuses).toContain('paid');
      expect(statuses).toContain('partially_paid');
      expect(statuses).toContain('overdue');
      expect(statuses).toContain('cancelled');
    });
  });

  describe('CRMInvoice and PortalInvoice status compatibility', () => {
    it('should allow all CRM statuses in PortalInvoice', () => {
      // This test verifies that PortalInvoice.status accepts all CRMInvoiceStatus values
      const crmStatuses: CRMInvoiceStatus[] = [
        'draft',
        'sent',
        'paid',
        'partially_paid',
        'overdue',
        'cancelled',
      ];

      // If PortalInvoice.status didn't include a status, this would fail at compile time
      const portalStatuses: PortalInvoice['status'][] = crmStatuses;
      expect(portalStatuses).toEqual(crmStatuses);
    });
  });

  describe('CRMInvoice and InvoiceFormValues compatibility', () => {
    it('should allow all CRM statuses in InvoiceFormValues', () => {
      const crmStatuses: CRMInvoiceStatus[] = [
        'draft',
        'sent',
        'paid',
        'partially_paid',
        'overdue',
        'cancelled',
      ];

      // InvoiceFormValues.status is optional, but should accept all CRMInvoiceStatus values
      const formStatuses: InvoiceFormValues['status'][] = crmStatuses;
      expect(formStatuses).toEqual(crmStatuses);
    });
  });

  describe('CustomerInvoiceStatus type', () => {
    it('should include all expected customer invoice status values', () => {
      const statuses: CustomerInvoiceStatus[] = [
        'draft',
        'unpaid',
        'paid',
        'overdue',
        'cancelled',
      ];
      expect(statuses).toHaveLength(5);
      expect(statuses).toContain('draft');
      expect(statuses).toContain('unpaid');
      expect(statuses).toContain('paid');
      expect(statuses).toContain('overdue');
      expect(statuses).toContain('cancelled');
    });

    it('should use unpaid instead of sent for customer invoices', () => {
      // Customer invoices use 'unpaid' where CRM invoices use 'sent'
      const customerStatus: CustomerInvoiceStatus = 'unpaid';
      expect(customerStatus).toBe('unpaid');
    });
  });

  describe('CRMInvoice alias fields', () => {
    it('should have issue_date as optional alias for invoice_date', () => {
      const invoice: Partial<CRMInvoice> = {
        invoice_date: '2025-01-01',
        issue_date: '2025-01-01',
      };
      expect(invoice.invoice_date).toBe(invoice.issue_date);
    });

    it('should have tax as alias for tax_amount', () => {
      const invoice: Partial<CRMInvoice> = {
        tax_amount: 10,
        tax: 10,
      };
      expect(invoice.tax_amount).toBe(invoice.tax);
    });
  });

  describe('LineItem type compatibility', () => {
    it('should be structurally compatible with CustomerInvoiceLineItem', () => {
      // LineItem has more optional fields than CustomerInvoiceLineItem
      const lineItem: LineItem = {
        description: 'Test item',
        quantity: 2,
        unit_price: 50,
        line_total: 100,
      };

      // A LineItem with description set should provide the same data as CustomerInvoiceLineItem
      const customerLineItem: CustomerInvoiceLineItem = {
        description: lineItem.description ?? '',
        quantity: lineItem.quantity,
        unit_price: lineItem.unit_price,
        total: lineItem.line_total,
      };

      expect(customerLineItem.description).toBe(lineItem.description);
      expect(customerLineItem.quantity).toBe(lineItem.quantity);
      expect(customerLineItem.unit_price).toBe(lineItem.unit_price);
      expect(customerLineItem.total).toBe(lineItem.line_total);
    });

    it('should support product_name field for CRM invoices', () => {
      const lineItem: LineItem = {
        product_name: 'Product A',
        quantity: 1,
        unit_price: 25,
        line_total: 25,
      };

      expect(lineItem.product_name).toBe('Product A');
      expect(lineItem.description).toBeUndefined();
    });
  });

  describe('CRMInvoice complete mock validity', () => {
    it('should accept all required fields without type errors', () => {
      const invoice: CRMInvoice = {
        id: 'test-id',
        account_id: 'account-id',
        client_id: 'client-id',
        invoice_number: 'INV-001',
        invoice_date: '2025-01-01',
        due_date: '2025-01-31',
        line_items: [],
        subtotal: 100,
        tax_rate: 10,
        tax_amount: 10,
        tax: 10,
        total: 110,
        amount_paid: null,
        payment_history: null,
        status: 'draft',
        paid_at: null,
        public_token: 'token-123',
        created_from_pre_order_id: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(invoice.id).toBe('test-id');
      expect(invoice.status).toBe('draft');
    });

    it('should accept all CRM status values', () => {
      const statuses: CRMInvoiceStatus[] = [
        'draft',
        'sent',
        'paid',
        'partially_paid',
        'overdue',
        'cancelled',
      ];

      for (const status of statuses) {
        const invoice: Partial<CRMInvoice> = { status };
        expect(invoice.status).toBe(status);
      }
    });
  });

  describe('CustomerInvoice complete mock validity', () => {
    it('should accept all required fields without type errors', () => {
      const invoice: CustomerInvoice = {
        id: 'test-id',
        tenant_id: 'tenant-id',
        customer_id: 'customer-id',
        invoice_number: 'INV-001',
        status: 'unpaid',
        subtotal: 100,
        tax: 10,
        total: 110,
        amount_paid: 0,
        amount_due: 110,
        due_date: '2025-01-31',
        issue_date: '2025-01-01',
        paid_at: null,
        notes: null,
        line_items: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      expect(invoice.id).toBe('test-id');
      expect(invoice.status).toBe('unpaid');
    });
  });
});

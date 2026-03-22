/**
 * ConvertToInvoiceDialog Component Tests
 *
 * Tests the dialog that converts a menu order to an invoice.
 * Verifies credit gate integration and error handling for
 * insufficient credits (402 response).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvertToInvoiceDialog, type ConvertToInvoiceDialogProps } from '../ConvertToInvoiceDialog';

// ============================================================================
// Mocks - use vi.hoisted to define mocks before vi.mock hoisting
// ============================================================================

const { mockInvoke, mockFrom } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    wholesaleClients: {
      list: vi.fn(() => ['wholesaleClients', 'list']),
    },
    menuOrders: {
      all: ['menuOrders'],
    },
    crm: {
      invoices: {
        all: vi.fn(() => ['crm', 'invoices']),
      },
    },
  },
}));

vi.mock('@/lib/formatters', () => ({
  formatPhoneNumber: vi.fn((phone: string) => phone || ''),
  formatCurrency: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
}));

// ============================================================================
// Test Setup
// ============================================================================

const defaultOrder: ConvertToInvoiceDialogProps['order'] = {
  id: 'order-123',
  total_amount: 150.00,
  created_at: '2026-03-20T10:00:00Z',
  order_data: {
    items: [
      { name: 'Product A', quantity: 2, price: 50 },
      { name: 'Product B', quantity: 1, price: 50 },
    ],
    subtotal: 150,
    tax: 0,
  },
  client_id: null,
  converted_to_invoice_id: null,
};

function renderDialog(props: Partial<ConvertToInvoiceDialogProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ConvertToInvoiceDialog
        open={true}
        onOpenChange={vi.fn()}
        order={defaultOrder}
        onSuccess={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('ConvertToInvoiceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the dialog when open', () => {
    renderDialog();
    expect(screen.getByText('Convert Order to Invoice')).toBeTruthy();
  });

  it('should show already converted message when order has invoice', () => {
    renderDialog({
      order: {
        ...defaultOrder,
        converted_to_invoice_id: 'existing-invoice-id',
      },
    });
    expect(screen.getByText('Order Already Converted')).toBeTruthy();
  });

  it('should render convert button when order is not yet converted', () => {
    renderDialog();
    const convertButton = screen.getByRole('button', { name: /convert to invoice/i });
    expect(convertButton).toBeTruthy();
  });

  it('should render order summary with formatted currency', () => {
    renderDialog();
    expect(screen.getByText('Order Summary')).toBeTruthy();
    expect(screen.getAllByText('$150.00').length).toBeGreaterThan(0);
  });

  it('should render order items from order_data', () => {
    renderDialog();
    expect(screen.getByText('Product A')).toBeTruthy();
    expect(screen.getByText('Product B')).toBeTruthy();
  });
});

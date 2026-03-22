/**
 * Tests verifying aria-label attributes on invoice action buttons
 * Ensures download, print, and generate invoice buttons are accessible
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: vi.fn().mockReturnValue(210), getHeight: vi.fn().mockReturnValue(297) } },
    setFillColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    line: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn().mockReturnValue(['text']),
    getTextWidth: vi.fn().mockReturnValue(50),
    addPage: vi.fn(),
    setPage: vi.fn(),
    getNumberOfPages: vi.fn().mockReturnValue(1),
    addImage: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: 'INV-001', error: null }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test', business_name: 'Test' },
    loading: false,
    admin: { id: 'admin-123' },
    tenantSlug: 'test',
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: { invoices: { all: () => ['invoices'] } },
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn().mockReturnValue('Error'),
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: vi.fn().mockImplementation((v: number) => `$${v.toFixed(2)}`),
}));

vi.mock('date-fns', () => ({
  format: vi.fn().mockReturnValue('Jan 1, 2025'),
}));

// Import after mocks
import {
  OrderInvoiceDownloadButton,
  OrderInvoicePrintButton,
  GenerateAndSaveInvoiceButton,
} from '../OrderInvoiceGenerator';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const mockOrder = {
  id: 'order-1',
  tracking_code: 'ORD-001',
  created_at: '2025-01-01T00:00:00Z',
  total_amount: 100,
  status: 'completed',
  delivery_address: '123 Test St',
  order_items: [],
};

describe('OrderInvoiceDownloadButton aria-label', () => {
  it('should have aria-label matching the default label', () => {
    render(<OrderInvoiceDownloadButton order={mockOrder} />);
    const button = screen.getByRole('button', { name: 'Download Invoice' });
    expect(button).toHaveAttribute('aria-label', 'Download Invoice');
  });

  it('should have aria-label matching a custom label', () => {
    render(<OrderInvoiceDownloadButton order={mockOrder} label="Download PDF" />);
    const button = screen.getByRole('button', { name: 'Download PDF' });
    expect(button).toHaveAttribute('aria-label', 'Download PDF');
  });
});

describe('OrderInvoicePrintButton aria-label', () => {
  it('should have aria-label matching the default label', () => {
    render(<OrderInvoicePrintButton order={mockOrder} />);
    const button = screen.getByRole('button', { name: 'Print Invoice' });
    expect(button).toHaveAttribute('aria-label', 'Print Invoice');
  });

  it('should have aria-label matching a custom label', () => {
    render(<OrderInvoicePrintButton order={mockOrder} label="Print PDF" />);
    const button = screen.getByRole('button', { name: 'Print PDF' });
    expect(button).toHaveAttribute('aria-label', 'Print PDF');
  });
});

describe('GenerateAndSaveInvoiceButton aria-label', () => {
  it('should have aria-label matching the default label', () => {
    render(
      <GenerateAndSaveInvoiceButton
        order={mockOrder}
        customerId="cust-1"
      />,
      { wrapper },
    );
    const button = screen.getByRole('button', { name: 'Generate Invoice' });
    expect(button).toHaveAttribute('aria-label', 'Generate Invoice');
  });

  it('should have aria-label matching a custom label', () => {
    render(
      <GenerateAndSaveInvoiceButton
        order={mockOrder}
        customerId="cust-1"
        label="Create & Download Invoice"
      />,
      { wrapper },
    );
    const button = screen.getByRole('button', { name: 'Create & Download Invoice' });
    expect(button).toHaveAttribute('aria-label', 'Create & Download Invoice');
  });
});

/**
 * Tests verifying aria-label on InvoiceDownloadButton from InvoicePDF
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock react-pdf renderer
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  StyleSheet: { create: <T,>(styles: T): T => styles },
  PDFDownloadLink: ({
    children,
    ...props
  }: {
    children: React.ReactNode | ((p: { loading: boolean }) => React.ReactNode);
    [key: string]: unknown;
  }) => (
    <a
      data-testid="pdf-download-link"
      aria-label={props['aria-label'] as string}
      href="#"
    >
      {typeof children === 'function' ? children({ loading: false }) : children}
    </a>
  ),
  PDFViewer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: vi.fn().mockReturnValue('Jan 1, 2025'),
}));

import { InvoiceDownloadButton } from '../InvoicePDF';

const mockInvoice = {
  invoiceNumber: 'INV-001',
  issueDate: '2025-01-01',
  dueDate: '2025-01-31',
  customerName: 'Test Customer',
  companyName: 'Test Company',
  lineItems: [
    { description: 'Item 1', quantity: 1, unitPrice: 100, total: 100 },
  ],
  subtotal: 100,
  tax: 10,
  total: 110,
};

describe('InvoiceDownloadButton aria-label', () => {
  it('should have aria-label="Download invoice" on the PDF download link', async () => {
    render(<InvoiceDownloadButton invoice={mockInvoice} />);

    await waitFor(() => {
      const link = screen.getByTestId('pdf-download-link');
      expect(link).toHaveAttribute('aria-label', 'Download invoice');
    });
  });
});

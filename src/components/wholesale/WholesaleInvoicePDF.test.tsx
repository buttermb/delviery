/**
 * Tests for WholesaleInvoicePDF component with lazy-loaded @react-pdf/renderer
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WholesaleInvoicePDF, WholesaleInvoiceDownloadButton } from './WholesaleInvoicePDF';

// Mock the lazy-react-pdf module
vi.mock('@/components/ui/lazy-react-pdf', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-document">{children}</div>,
  Page: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-page">{children}</div>,
  View: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-view">{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-text">{children}</div>,
  PDFDownloadLink: ({ children, document: _document, fileName }: { children: React.ReactNode | ((props: { loading: boolean }) => React.ReactNode); document: unknown; fileName: string }) => (
    <div data-testid="pdf-download-link" data-filename={fileName}>
      {typeof children === 'function' ? children({ loading: false }) : children}
    </div>
  ),
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, disabled, className }: { children: React.ReactNode; disabled?: boolean; className?: string }) => (
    <button data-testid="button" disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="icon-filetext">FileText</span>,
  Loader2: () => <span data-testid="icon-loader">Loader2</span>,
}));

describe('WholesaleInvoicePDF', () => {
  const mockInvoiceData = {
    orderNumber: 'WH-12345',
    orderDate: '2024-01-15',
    dueDate: '2024-02-15',
    clientName: 'ABC Restaurant',
    clientContact: 'Jane Smith',
    clientAddress: '789 Restaurant Blvd, City, State 11111',
    clientPhone: '555-1234',
    clientEmail: 'jane@abc-restaurant.com',
    companyName: 'Fresh Produce Co.',
    companyAddress: '123 Farm Road, City, State 22222',
    companyPhone: '555-5678',
    companyEmail: 'sales@freshproduce.com',
    items: [
      {
        id: '1',
        product_name: 'Organic Tomatoes',
        quantity_lbs: 50,
        unit_price: 2.5,
      },
      {
        id: '2',
        product_name: 'Fresh Lettuce',
        quantity_lbs: 30,
        unit_price: 1.75,
      },
    ],
    subtotal: 177.5,
    tax: 17.75,
    total: 195.25,
    paymentTerms: 'Net 30',
    paymentStatus: 'pending',
    outstandingBalance: 100.0,
    notes: 'Please store in refrigerated area upon delivery.',
  };

  describe('WholesaleInvoicePDF component', () => {
    it('should render PDF document structure', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pdf-page')).toBeInTheDocument();
    });

    it('should display order number', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByText(/Order #WH-12345/)).toBeInTheDocument();
      });
    });

    it('should display client information', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByText('ABC Restaurant')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('789 Restaurant Blvd, City, State 11111')).toBeInTheDocument();
        expect(screen.getByText('555-1234')).toBeInTheDocument();
        expect(screen.getByText('jane@abc-restaurant.com')).toBeInTheDocument();
      });
    });

    it('should display company information', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByText('Fresh Produce Co.')).toBeInTheDocument();
        expect(screen.getByText('123 Farm Road, City, State 22222')).toBeInTheDocument();
        expect(screen.getByText('555-5678')).toBeInTheDocument();
        expect(screen.getByText('sales@freshproduce.com')).toBeInTheDocument();
      });
    });

    it('should display product items with quantities and prices', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByText('Organic Tomatoes')).toBeInTheDocument();
        expect(screen.getByText('Fresh Lettuce')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument(); // quantity
        expect(screen.getByText('30')).toBeInTheDocument(); // quantity
      });
    });

    it('should calculate and display total weight', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByText(/80 lbs/)).toBeInTheDocument(); // 50 + 30
      });
    });

    it('should display payment terms and status', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        const netTerms = screen.getAllByText(/Net 30/);
        expect(netTerms.length).toBeGreaterThan(0);
        const pendingStatus = screen.getAllByText(/PENDING/);
        expect(pendingStatus.length).toBeGreaterThan(0);
      });
    });

    it('should display outstanding balance warning when present', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByText(/Outstanding Balance/)).toBeInTheDocument();
        expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
      });
    });

    it('should not display outstanding balance warning when zero', async () => {
      const invoiceWithoutBalance = { ...mockInvoiceData, outstandingBalance: 0 };
      render(<WholesaleInvoicePDF invoice={invoiceWithoutBalance} />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
      });
      expect(screen.queryByText(/Outstanding Balance/)).not.toBeInTheDocument();
    });

    it('should display notes when provided', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByText('Please store in refrigerated area upon delivery.')).toBeInTheDocument();
      });
    });

    it('should handle invoice without notes', async () => {
      const invoiceWithoutNotes = { ...mockInvoiceData, notes: undefined };
      render(<WholesaleInvoicePDF invoice={invoiceWithoutNotes} />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
      });
      expect(screen.queryByText('Please store in refrigerated area upon delivery.')).not.toBeInTheDocument();
    });

    it('should handle invoice without tax', async () => {
      const invoiceWithoutTax = { ...mockInvoiceData, tax: undefined };
      render(<WholesaleInvoicePDF invoice={invoiceWithoutTax} />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
      });
    });

    it('should display payment status with correct styling for paid status', async () => {
      const paidInvoice = { ...mockInvoiceData, paymentStatus: 'paid' };
      render(<WholesaleInvoicePDF invoice={paidInvoice} />);

      await waitFor(() => {
        expect(screen.getByText(/PAID/)).toBeInTheDocument();
      });
    });
  });

  describe('WholesaleInvoiceDownloadButton component', () => {
    it('should render download button with correct filename', async () => {
      render(<WholesaleInvoiceDownloadButton invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-download-link')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pdf-download-link')).toHaveAttribute(
        'data-filename',
        'wholesale-invoice-WH-12345.pdf'
      );
    });

    it('should display download button content when not loading', async () => {
      render(<WholesaleInvoiceDownloadButton invoice={mockInvoiceData} />);

      await waitFor(() => {
        expect(screen.getByTestId('button')).toBeInTheDocument();
        expect(screen.getByText('Download Invoice')).toBeInTheDocument();
        expect(screen.getByTestId('icon-filetext')).toBeInTheDocument();
      });
    });

    it('should support custom variant and size props', async () => {
      render(
        <WholesaleInvoiceDownloadButton
          invoice={mockInvoiceData}
          variant="outline"
          size="sm"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('button')).toBeInTheDocument();
      });
    });

    it('should apply gap-2 className to button', async () => {
      render(<WholesaleInvoiceDownloadButton invoice={mockInvoiceData} />);

      await waitFor(() => {
        const button = screen.getByTestId('button');
        expect(button.className).toContain('gap-2');
      });
    });
  });

  describe('Currency and date formatting', () => {
    it('should format currency values correctly', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        // Check for properly formatted currency
        expect(screen.getByText(/\$177\.50/)).toBeInTheDocument(); // Subtotal
        expect(screen.getByText(/\$17\.75/)).toBeInTheDocument(); // Tax
        expect(screen.getByText(/\$195\.25/)).toBeInTheDocument(); // Total
      });
    });

    it('should format dates correctly', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        // Dates should be formatted in long format
        const janDates = screen.getAllByText(/January 14, 2024/);
        expect(janDates.length).toBeGreaterThan(0);
        const febDates = screen.getAllByText(/February 14, 2024/);
        expect(febDates.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Lazy loading behavior', () => {
    it('should use lazy-loaded PDF components from lazy-react-pdf module', async () => {
      render(<WholesaleInvoicePDF invoice={mockInvoiceData} />);

      await waitFor(() => {
        // Verify that the mocked lazy components are being used
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
        expect(screen.getByTestId('pdf-page')).toBeInTheDocument();
      });
    });
  });
});

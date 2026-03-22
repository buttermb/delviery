/**
 * Tests verifying aria-label on InvoiceAgingReport export button
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: vi.fn().mockImplementation((v: number) => `$${v.toFixed(2)}`),
}));

import { InvoiceAgingReport } from '../InvoiceAgingReport';

describe('InvoiceAgingReport export button aria-label', () => {
  it('should have aria-label on the export button', () => {
    render(<InvoiceAgingReport invoices={[]} />);
    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).toHaveAttribute('aria-label', 'Export invoice aging report');
  });
});

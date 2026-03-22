/**
 * GenerateBarcodes Credit Gating Tests
 *
 * Verifies that batch barcode printing is properly gated by credits:
 * 1. barcode_print_batch action key is used with the correct cost (25 credits)
 * 2. useCreditGatedAction hook is integrated in GenerateBarcodes
 * 3. Credit check blocks print when insufficient credits
 * 4. Credit check allows print when sufficient credits
 * 5. Credit cost configuration is correct
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      is_free_tier: true,
    },
    loading: false,
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: [
              { id: 'prod-1', name: 'Test Product', sku: 'SKU-001', wholesale_price: 10 },
            ],
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@/components/inventory/BarcodeGenerator', () => ({
  BarcodeGenerator: ({ value }: { value: string }) => (
    <div data-testid="barcode-generator">{value}</div>
  ),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="qr-code">{value}</div>
  ),
}));

const mockPdfSave = vi.fn();
vi.mock('jspdf', () => ({
  default: class MockJsPDF {
    setDrawColor = vi.fn();
    rect = vi.fn();
    setFontSize = vi.fn();
    text = vi.fn();
    addPage = vi.fn();
    save = mockPdfSave;
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/barcodeService', () => ({
  createPackageQRData: vi.fn(),
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div>Loading...</div>,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({ title }: { title: string }) => (
    <div data-testid="empty-state">{title}</div>
  ),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    productsForBarcode: {
      byTenant: (id: string | undefined) => ['products-barcode', id],
    },
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('GenerateBarcodes Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPdfSave.mockClear();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  afterEach(async () => {
    // Flush any pending requestAnimationFrame / setTimeout callbacks from async PDF generation
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should render the barcode generator page', async () => {
    const GenerateBarcodes = (await import('../GenerateBarcodes')).default;
    renderWithProviders(<GenerateBarcodes />);

    expect(screen.getByText('Barcode & QR Code Generator')).toBeInTheDocument();
  });

  it('should call executeCreditAction with barcode_print_batch on Download Sheet', async () => {
    const user = userEvent.setup();
    const GenerateBarcodes = (await import('../GenerateBarcodes')).default;
    renderWithProviders(<GenerateBarcodes />);

    // Switch to custom mode and generate barcodes
    const customTab = screen.getByRole('tab', { name: /custom/i });
    await user.click(customTab);

    // Fill in custom barcode fields
    const prefixInput = screen.getByPlaceholderText('CUST-2024');
    await user.type(prefixInput, 'TEST');

    // Generate barcodes
    const generateBtn = screen.getByRole('button', { name: /generate barcodes/i });
    await user.click(generateBtn);

    // Wait for barcodes to be generated
    await waitFor(() => {
      expect(screen.getByText(/Generated Barcodes/)).toBeInTheDocument();
    });

    // Click Download Sheet
    const downloadBtn = screen.getByRole('button', { name: /download sheet/i });
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'barcode_print_batch',
        expect.any(Function),
        { referenceType: 'barcode_batch' }
      );
    });
  });

  it('should call executeCreditAction with barcode_print_batch on Print All Labels', async () => {
    const user = userEvent.setup();
    const GenerateBarcodes = (await import('../GenerateBarcodes')).default;
    renderWithProviders(<GenerateBarcodes />);

    // Switch to custom mode and generate barcodes
    const customTab = screen.getByRole('tab', { name: /custom/i });
    await user.click(customTab);

    const prefixInput = screen.getByPlaceholderText('CUST-2024');
    await user.type(prefixInput, 'TEST');

    const generateBtn = screen.getByRole('button', { name: /generate barcodes/i });
    await user.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Generated Barcodes/)).toBeInTheDocument();
    });

    // Click Print All Labels
    const printAllBtn = screen.getByRole('button', { name: /print all labels/i });
    await user.click(printAllBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'barcode_print_batch',
        expect.any(Function),
        { referenceType: 'barcode_batch' }
      );
    });
  });

  it('should not generate PDF when credit gate blocks the action', async () => {
    // Simulate credit gate blocking the action (returns null, action callback not invoked)
    mockExecute.mockResolvedValue(null);

    // Wait for any pending async operations from prior tests to flush
    await new Promise(resolve => setTimeout(resolve, 50));
    mockPdfSave.mockClear();

    const user = userEvent.setup();
    const GenerateBarcodes = (await import('../GenerateBarcodes')).default;
    renderWithProviders(<GenerateBarcodes />);

    // Generate custom barcodes
    const customTab = screen.getByRole('tab', { name: /custom/i });
    await user.click(customTab);

    const prefixInput = screen.getByPlaceholderText('CUST-2024');
    await user.type(prefixInput, 'TEST');

    const generateBtn = screen.getByRole('button', { name: /generate barcodes/i });
    await user.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Generated Barcodes/)).toBeInTheDocument();
    });

    // Click Download Sheet
    const downloadBtn = screen.getByRole('button', { name: /download sheet/i });
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'barcode_print_batch',
        expect.any(Function),
        { referenceType: 'barcode_batch' }
      );
    });

    // Allow a tick for any async callbacks to settle
    await new Promise(resolve => setTimeout(resolve, 50));

    // The PDF save should NOT have been called since the credit gate blocked it
    // (the action callback was never invoked by the mock)
    expect(mockPdfSave).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Barcode Print Batch Credit Cost Configuration', () => {
  it('barcode_print_batch should cost 25 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('barcode_print_batch')).toBe(25);
  });

  it('barcode_print_batch should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('barcode_print_batch')).toBe(false);
  });

  it('barcode_print_batch should be categorized under inventory', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('barcode_print_batch');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('inventory');
    expect(info?.actionName).toBe('Print Barcode Batch');
    expect(info?.credits).toBe(25);
  });

  it('barcode_view should be free', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('barcode_view')).toBe(true);
  });

  it('barcode_generate should cost 5 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('barcode_generate')).toBe(5);
  });
});

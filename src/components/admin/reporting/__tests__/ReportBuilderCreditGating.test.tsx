/**
 * ReportBuilder Credit Gating Tests
 *
 * Verifies that advanced report generation is properly gated by credits:
 * 1. report_advanced_generate action key is used with 100 credits
 * 2. useCreditGatedAction hook is integrated in ReportBuilder
 * 3. Credit check blocks report creation when insufficient credits
 * 4. Credit check allows report creation when sufficient credits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockInsert = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Mock Dialog to avoid Radix UI infinite update loop in test environment
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

// Mock ScrollArea to render children directly
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Mock Accordion to render children directly
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Mock Checkbox to render a native checkbox
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
  }) => (
    <input
      type="checkbox"
      id={id}
      checked={checked ?? false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-testid={id ? `checkbox-${id}` : undefined}
    />
  ),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      is_free_tier: true,
    },
    admin: { id: 'test-admin-id' },
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
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
      insert: mockInsert.mockReturnValue({ error: null }),
    }),
  },
}));

vi.mock('@/hooks/useReportDataSources', () => ({
  useReportDataSources: () => ({
    data: [
      {
        id: 'ds-1',
        name: 'orders',
        display_name: 'Orders',
        description: 'Order data',
        source_type: 'table',
      },
      {
        id: 'ds-2',
        name: 'products',
        display_name: 'Products',
        description: 'Product catalog',
        source_type: 'table',
      },
    ],
    isLoading: false,
  }),
  useDataSourceFields: () => ({
    fields: [
      { id: 'order_id', label: 'Order ID', type: 'string' },
      { id: 'total', label: 'Total', type: 'number' },
    ],
    metrics: [{ id: 'sum_total', label: 'Total Revenue' }],
    dimensions: [{ id: 'status', label: 'Status' }],
  }),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
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

describe('ReportBuilder Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render the report builder dialog when open', async () => {
    const { ReportBuilder } = await import('../ReportBuilder');
    renderWithProviders(
      <ReportBuilder open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByText('Create Custom Report')).toBeInTheDocument();
  });

  it('should call executeCreditAction with report_advanced_generate on submit', async () => {
    const user = userEvent.setup();
    const { ReportBuilder } = await import('../ReportBuilder');
    renderWithProviders(
      <ReportBuilder open={true} onOpenChange={vi.fn()} onSuccess={vi.fn()} />
    );

    // Fill in report name
    const nameInput = screen.getByPlaceholderText('e.g., Monthly Sales Summary');
    await user.type(nameInput, 'Test Report');

    // Select a data source by clicking the container div
    const ordersLabel = screen.getByText('Orders');
    await user.click(ordersLabel);

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create report/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'report_advanced_generate',
        expect.any(Function)
      );
    });
  });

  it('should not create report when credit gate blocks the action', async () => {
    // Simulate credit gate blocking the action (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const { ReportBuilder } = await import('../ReportBuilder');
    renderWithProviders(
      <ReportBuilder open={true} onOpenChange={vi.fn()} />
    );

    // Fill in report name
    const nameInput = screen.getByPlaceholderText('e.g., Monthly Sales Summary');
    await user.type(nameInput, 'Test Report');

    // Select a data source
    const ordersLabel = screen.getByText('Orders');
    await user.click(ordersLabel);

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create report/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'report_advanced_generate',
        expect.any(Function)
      );
    });

    // The supabase insert should NOT have been called
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should disable submit button when no data sources are selected', async () => {
    const { ReportBuilder } = await import('../ReportBuilder');
    renderWithProviders(
      <ReportBuilder open={true} onOpenChange={vi.fn()} />
    );

    // The submit button should be disabled when no data sources selected
    const submitBtn = screen.getByRole('button', { name: /create report/i });
    expect(submitBtn).toBeDisabled();

    // Credit gate should NOT have been called
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should show placeholder when builder is closed', async () => {
    const { ReportBuilder } = await import('../ReportBuilder');
    renderWithProviders(
      <ReportBuilder open={false} onOpenChange={vi.fn()} />
    );

    expect(screen.getByText('Report Builder')).toBeInTheDocument();
    expect(
      screen.getByText(/Click "New Report" to start building a custom report/)
    ).toBeInTheDocument();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for report_advanced_generate
// ============================================================================

describe('Advanced Report Credit Cost Configuration', () => {
  it('report_advanced_generate should cost 100 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('report_advanced_generate')).toBe(100);
  });

  it('report_advanced_generate should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('report_advanced_generate')).toBe(false);
  });

  it('report_advanced_generate should be categorized under reports', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('report_advanced_generate');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('reports');
    expect(info?.actionName).toBe('Generate Advanced Report');
    expect(info?.credits).toBe(100);
  });
});

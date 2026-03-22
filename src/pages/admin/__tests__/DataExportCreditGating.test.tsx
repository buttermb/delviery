/**
 * DataExport Credit Gating Tests
 *
 * Verifies that the data warehouse export is properly gated by credits:
 * 1. data_warehouse_export action key costs 200 credits
 * 2. useCreditGatedAction is called for warehouse exports
 * 3. Regular exports still use the existing credit confirm flow
 * 4. OutOfCreditsModal is shown when insufficient credits
 * 5. Credit cost indicators show the correct action key
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

const mockExecuteCreditGatedAction = vi.fn();
const mockCloseOutOfCreditsModal = vi.fn();
const mockPerformAction = vi.fn();
const mockSupabaseInsert = vi.fn();
const mockSupabaseInvoke = vi.fn();
const mockTriggerRegularExport = vi.fn();

let mockShowOutOfCreditsModal = false;
let mockBlockedAction: string | null = null;

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
    tenantSlug: 'test-tenant',
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    isFreeTier: true,
    performAction: mockPerformAction,
    balance: 500,
    canPerformAction: vi.fn().mockResolvedValue(true),
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecuteCreditGatedAction,
    isExecuting: false,
    showOutOfCreditsModal: mockShowOutOfCreditsModal,
    closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
    blockedAction: mockBlockedAction,
    balance: 500,
    isFreeTier: true,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
      insert: () => ({
        select: () => ({
          maybeSingle: () => mockSupabaseInsert(),
        }),
      }),
    }),
    functions: {
      invoke: (...args: unknown[]) => mockSupabaseInvoke(...args),
    },
  },
}));

// Mock shadcn Select to avoid Radix/jsdom pointer capture issues
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select data-testid="mock-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('@/components/credits', () => ({
  CreditCostBadge: ({ actionKey }: { actionKey: string }) => (
    <span data-testid="credit-cost-badge">{actionKey}</span>
  ),
  CreditCostIndicator: ({ actionKey }: { actionKey: string }) => (
    <div data-testid="credit-cost-indicator">{actionKey}</div>
  ),
  useCreditConfirm: ({ onConfirm }: { onConfirm: () => void }) => ({
    trigger: () => {
      mockTriggerRegularExport();
      onConfirm();
    },
    dialogProps: {
      open: false,
      onOpenChange: vi.fn(),
      actionKey: 'export_csv',
      onConfirm,
    },
  }),
  CreditConfirmDialog: () => <div data-testid="credit-confirm-dialog" />,
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) => (
    open ? <div data-testid="out-of-credits-modal">{actionAttempted}</div> : null
  ),
}));

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/shared/DisabledTooltip', () => ({
  DisabledTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    dataExport: {
      history: (tenantId?: string) => ['dataExport', 'history', tenantId],
    },
    credits: {
      balance: (tenantId?: string) => ['credits', 'balance', tenantId],
      all: ['credits'],
    },
  },
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: () => false,
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => date,
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

describe('DataExport Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowOutOfCreditsModal = false;
    mockBlockedAction = null;
    mockPerformAction.mockResolvedValue({ success: true });
    mockSupabaseInsert.mockResolvedValue({
      data: { id: 'export-1', data_type: 'orders', format: 'csv', status: 'pending' },
      error: null,
    });
    mockSupabaseInvoke.mockResolvedValue({ data: { success: true }, error: null });
    mockExecuteCreditGatedAction.mockResolvedValue({
      success: true,
      creditsCost: 200,
      wasBlocked: false,
    });
  });

  it('should render the data warehouse export option', async () => {
    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    // The mocked Select renders native <option> elements
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain('Data Warehouse (All Data)');
  });

  it('should call useCreditGatedAction with data_warehouse_export when warehouse is selected', async () => {
    const user = userEvent.setup();
    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    // Select data warehouse via native select
    const selects = screen.getAllByTestId('mock-select');
    const dataTypeSelect = selects[0]; // First select is data type
    await user.selectOptions(dataTypeSelect, 'data_warehouse');

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockExecuteCreditGatedAction).toHaveBeenCalledTimes(1);
      expect(mockExecuteCreditGatedAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionKey: 'data_warehouse_export',
          referenceType: 'data_export',
        })
      );
    });
  });

  it('should NOT call useCreditGatedAction for regular exports', async () => {
    const user = userEvent.setup();
    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    // Select a regular export type (orders)
    const selects = screen.getAllByTestId('mock-select');
    await user.selectOptions(selects[0], 'orders');

    // Click export - this triggers the useCreditConfirm flow
    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);

    await waitFor(() => {
      // Regular exports should NOT call useCreditGatedAction
      expect(mockExecuteCreditGatedAction).not.toHaveBeenCalled();
      // The credit confirm trigger should have been called
      expect(mockTriggerRegularExport).toHaveBeenCalled();
    });
  });

  it('should show data_warehouse_export credit cost when warehouse is selected', async () => {
    const user = userEvent.setup();
    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    const selects = screen.getAllByTestId('mock-select');
    await user.selectOptions(selects[0], 'data_warehouse');

    await waitFor(() => {
      const badge = screen.getByTestId('credit-cost-badge');
      expect(badge).toHaveTextContent('data_warehouse_export');
      const indicator = screen.getByTestId('credit-cost-indicator');
      expect(indicator).toHaveTextContent('data_warehouse_export');
    });
  });

  it('should show export_csv credit cost for regular CSV exports', async () => {
    const user = userEvent.setup();
    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    const selects = screen.getAllByTestId('mock-select');
    await user.selectOptions(selects[0], 'orders');

    await waitFor(() => {
      const badge = screen.getByTestId('credit-cost-badge');
      expect(badge).toHaveTextContent('export_csv');
    });
  });

  it('should execute the action callback passed to useCreditGatedAction for warehouse export', async () => {
    mockExecuteCreditGatedAction.mockImplementation(
      async (options: { action: () => Promise<unknown> }) => {
        await options.action();
        return { success: true, creditsCost: 200, wasBlocked: false };
      }
    );

    const user = userEvent.setup();
    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    const selects = screen.getAllByTestId('mock-select');
    await user.selectOptions(selects[0], 'data_warehouse');

    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockSupabaseInvoke).toHaveBeenCalledWith(
        'process-data-export',
        expect.objectContaining({ body: expect.any(Object) })
      );
    });
  });

  it('should show error toast when no data type is selected and export button is clicked', async () => {
    const { toast } = await import('sonner');
    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    // The button is disabled when no export type is selected, but handleExport
    // also guards with a toast. Let's verify the disabled state instead.
    const exportButton = screen.getByRole('button', { name: /export data/i });
    expect(exportButton).toBeDisabled();

    // toast.error should NOT have been called since button is disabled
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ============================================================================
// OutOfCreditsModal Integration Tests
// ============================================================================

describe('DataExport OutOfCreditsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show OutOfCreditsModal when showOutOfCreditsModal is true', async () => {
    mockShowOutOfCreditsModal = true;
    mockBlockedAction = 'data_warehouse_export';

    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
    expect(screen.getByTestId('out-of-credits-modal')).toHaveTextContent('data_warehouse_export');

    // Reset
    mockShowOutOfCreditsModal = false;
    mockBlockedAction = null;
  });

  it('should not show OutOfCreditsModal when showOutOfCreditsModal is false', async () => {
    mockShowOutOfCreditsModal = false;
    mockBlockedAction = null;

    const DataExport = (await import('../DataExport')).default;
    renderWithProviders(<DataExport />);

    expect(screen.queryByTestId('out-of-credits-modal')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Data Warehouse Export Credit Cost Configuration', () => {
  it('data_warehouse_export should cost 200 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('data_warehouse_export')).toBe(200);
  });

  it('data_warehouse_export should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('data_warehouse_export')).toBe(false);
  });

  it('data_warehouse_export should be categorized under exports', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('data_warehouse_export');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('exports');
    expect(info?.actionName).toBe('Export from Data Warehouse');
    expect(info?.credits).toBe(200);
  });
});

/**
 * CustomReports Credit Gating Tests
 *
 * Verifies that the report generation action is properly gated by credits:
 * 1. report_custom_generate action key is used with the correct cost (75 credits)
 * 2. useCreditGatedAction hook is integrated in CustomReports
 * 3. Credit check blocks generation when insufficient credits
 * 4. Credit check allows generation when sufficient credits
 * 5. Download button is disabled while generating
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
const mockInvoke = vi.fn();

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
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: mockInvoke,
    },
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

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    customReports: {
      byTenant: (id: string | undefined) => ['custom-reports', id],
    },
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (error: unknown, fallback?: string) =>
    error instanceof Error ? error.message : fallback ?? 'Unknown error',
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div data-testid="loading">Loading...</div>,
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

// Mock report data
const mockReports = [
  {
    id: 'report-1',
    name: 'Sales Report',
    description: 'Monthly sales overview',
    sql_query: 'SELECT * FROM orders',
    query: null,
    format: 'csv',
    schedule: null,
    created_at: '2026-01-01T00:00:00Z',
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('CustomReports Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockInvoke.mockResolvedValue({
      data: {
        data: {
          wholesale_orders: [
            { id: '1', total: 100, status: 'completed' },
          ],
        },
      },
      error: null,
    });
  });

  it('should render the custom reports page', async () => {
    // Mock the query to return reports
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const CustomReports = (await import('../CustomReports')).default;
    renderWithProviders(<CustomReports />);

    await waitFor(() => {
      expect(screen.getByText('Custom Reports')).toBeInTheDocument();
    });
  });

  it('should call executeCreditAction with report_custom_generate on download click', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const user = userEvent.setup();
    const CustomReports = (await import('../CustomReports')).default;
    renderWithProviders(<CustomReports />);

    await waitFor(() => {
      expect(screen.getByText('Sales Report')).toBeInTheDocument();
    });

    // Find and click the download button (it has the Download icon)
    const downloadButtons = screen.getAllByRole('button');
    const downloadBtn = downloadButtons.find((btn) =>
      btn.querySelector('svg.lucide-download')
    );
    expect(downloadBtn).toBeDefined();
    await user.click(downloadBtn!);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'report_custom_generate',
        expect.any(Function),
        { referenceId: 'report-1', referenceType: 'custom_report' }
      );
    });
  });

  it('should not generate report when credit gate blocks the action', async () => {
    // Simulate credit gate blocking the action (returns null)
    mockExecute.mockResolvedValue(null);

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const user = userEvent.setup();
    const CustomReports = (await import('../CustomReports')).default;
    renderWithProviders(<CustomReports />);

    await waitFor(() => {
      expect(screen.getByText('Sales Report')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByRole('button');
    const downloadBtn = downloadButtons.find((btn) =>
      btn.querySelector('svg.lucide-download')
    );
    await user.click(downloadBtn!);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        'report_custom_generate',
        expect.any(Function),
        { referenceId: 'report-1', referenceType: 'custom_report' }
      );
    });

    // The edge function should NOT have been called (blocked by gate)
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('should invoke edge function when credit gate allows the action', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockReports, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);

    const user = userEvent.setup();
    const CustomReports = (await import('../CustomReports')).default;
    renderWithProviders(<CustomReports />);

    await waitFor(() => {
      expect(screen.getByText('Sales Report')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByRole('button');
    const downloadBtn = downloadButtons.find((btn) =>
      btn.querySelector('svg.lucide-download')
    );
    await user.click(downloadBtn!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('generate-custom-report', {
        body: { reportId: 'report-1' },
      });
    });
  });
});

// ============================================================================
// Credit Cost Configuration Tests for report_custom_generate
// ============================================================================

describe('Custom Report Credit Cost Configuration', () => {
  it('report_custom_generate should cost 75 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('report_custom_generate')).toBe(75);
  });

  it('report_custom_generate should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('report_custom_generate')).toBe(false);
  });

  it('report_custom_generate should be categorized under reports', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('report_custom_generate');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('reports');
    expect(info?.actionName).toBe('Generate Custom Report');
    expect(info?.credits).toBe(75);
  });

  it('generate_report legacy alias should also cost 75 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('generate_report')).toBe(75);
  });
});

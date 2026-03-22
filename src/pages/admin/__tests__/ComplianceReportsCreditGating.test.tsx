/**
 * ComplianceReports Credit Gating Tests
 *
 * Verifies that the compliance report export action is properly gated by credits:
 * 1. compliance_report_generate action key is used with the correct cost (100 credits)
 * 2. useCredits hook is integrated in ComplianceReports
 * 3. Credit check blocks export when insufficient credits
 * 4. Credit check allows export when sufficient credits
 * 5. Non-free-tier users bypass credit checks
 * 6. CreditCostBadge is rendered for free-tier users
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

const mockPerformAction = vi.fn();

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

const mockUseCredits = vi.fn();

vi.mock('@/hooks/useCredits', () => ({
  useCredits: (...args: unknown[]) => mockUseCredits(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          not: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          order: () => ({
            gte: () => ({ lte: () => Promise.resolve({ data: [{ id: '1', user_id: 'u1', action: 'login', entity_type: 'session', entity_id: 's1', ip_address: '1.2.3.4', details: null, created_at: '2024-01-01' }], error: null }) }),
            lte: () => Promise.resolve({ data: [{ id: '1', user_id: 'u1', action: 'login', entity_type: 'session', entity_id: 's1', ip_address: '1.2.3.4', details: null, created_at: '2024-01-01' }], error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
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
    complianceReports: {
      retentionPolicy: () => ['compliance', 'retention'],
      ipLogs: () => ['compliance', 'ipLogs'],
    },
    credits: {
      all: ['credits'],
      balance: () => ['credits', 'balance'],
    },
  },
}));

vi.mock('@/components/credits', () => ({
  CreditCostBadge: ({ actionKey }: { actionKey: string }) => (
    <span data-testid="credit-cost-badge" data-action-key={actionKey}>
      100 credits
    </span>
  ),
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

const freeTierCreditsReturn = () => ({
  isFreeTier: true,
  performAction: mockPerformAction,
  balance: 500,
  isLoading: false,
  isLowCredits: false,
  isCriticalCredits: false,
  isOutOfCredits: false,
  hasCredits: (amount: number) => 500 >= amount,
  canPerformAction: vi.fn().mockResolvedValue(true),
  refetch: vi.fn(),
  invalidate: vi.fn(),
  error: null,
  lifetimeStats: { earned: 500, spent: 0, purchased: 0, expired: 0, refunded: 0 },
  subscription: { status: 'none' as const, isFreeTier: true, creditsPerPeriod: 500, currentPeriodEnd: null, cancelAtPeriodEnd: false },
  lifetimeEarned: 500,
  lifetimeSpent: 0,
  nextFreeGrantAt: null,
  percentUsed: 0,
});

describe('ComplianceReports Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCredits.mockReturnValue(freeTierCreditsReturn());
    mockPerformAction.mockResolvedValue({
      success: true,
      newBalance: 400,
      creditsCost: 100,
    });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('should render the compliance reports page', async () => {
    const { ComplianceReports } = await import('../ComplianceReports');
    renderWithProviders(<ComplianceReports />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Reports')).toBeInTheDocument();
    });
  });

  it('should render CreditCostBadge on the export button', async () => {
    const { ComplianceReports } = await import('../ComplianceReports');
    renderWithProviders(<ComplianceReports />);

    await waitFor(() => {
      const badge = screen.getByTestId('credit-cost-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-action-key', 'compliance_report_generate');
    });
  });

  it('should call performAction with compliance_report_generate on export', async () => {
    const user = userEvent.setup();
    const { ComplianceReports } = await import('../ComplianceReports');
    renderWithProviders(<ComplianceReports />);

    await waitFor(() => {
      expect(screen.getByText('Export Audit Trail (CSV)')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export audit trail/i });
    await user.click(exportBtn);

    await waitFor(() => {
      expect(mockPerformAction).toHaveBeenCalledWith(
        'compliance_report_generate',
        undefined,
        'compliance'
      );
    });
  });

  it('should not export when credit gate blocks the action', async () => {
    mockPerformAction.mockResolvedValue({
      success: false,
      newBalance: 50,
      creditsCost: 100,
      errorMessage: 'Insufficient credits',
    });

    const user = userEvent.setup();
    const { ComplianceReports } = await import('../ComplianceReports');
    renderWithProviders(<ComplianceReports />);

    await waitFor(() => {
      expect(screen.getByText('Export Audit Trail (CSV)')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export audit trail/i });
    await user.click(exportBtn);

    await waitFor(() => {
      expect(mockPerformAction).toHaveBeenCalledWith(
        'compliance_report_generate',
        undefined,
        'compliance'
      );
    });

    // The export should fail - no download should have been triggered
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('should export when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const { ComplianceReports } = await import('../ComplianceReports');
    renderWithProviders(<ComplianceReports />);

    await waitFor(() => {
      expect(screen.getByText('Export Audit Trail (CSV)')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export audit trail/i });
    await user.click(exportBtn);

    await waitFor(() => {
      expect(mockPerformAction).toHaveBeenCalledTimes(1);
    });

    // On success, createObjectURL should be called for the CSV download
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Non-free-tier bypass tests
// ============================================================================

describe('ComplianceReports Credit Gating - Paid Tier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    // Override useCredits to simulate paid tier
    mockUseCredits.mockReturnValue({
      isFreeTier: false,
      performAction: mockPerformAction,
      balance: 0,
      isLoading: false,
      isLowCredits: false,
      isCriticalCredits: false,
      isOutOfCredits: false,
      hasCredits: () => true,
      canPerformAction: vi.fn().mockResolvedValue(true),
      refetch: vi.fn(),
      invalidate: vi.fn(),
      error: null,
      lifetimeStats: { earned: 0, spent: 0, purchased: 0, expired: 0, refunded: 0 },
      subscription: { status: 'active' as const, isFreeTier: false, creditsPerPeriod: 0, currentPeriodEnd: null, cancelAtPeriodEnd: false },
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      nextFreeGrantAt: null,
      percentUsed: 0,
    });
  });

  it('should skip credit check for paid tier users', async () => {
    const user = userEvent.setup();
    const { ComplianceReports } = await import('../ComplianceReports');
    renderWithProviders(<ComplianceReports />);

    await waitFor(() => {
      expect(screen.getByText('Export Audit Trail (CSV)')).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /export audit trail/i });
    await user.click(exportBtn);

    // For paid tier, performAction should NOT be called
    await waitFor(() => {
      expect(mockPerformAction).not.toHaveBeenCalled();
    });

    // Export should proceed directly
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Compliance Report Credit Cost Configuration', () => {
  it('compliance_report_generate should cost 100 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('compliance_report_generate')).toBe(100);
  });

  it('compliance_report_generate should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('compliance_report_generate')).toBe(false);
  });

  it('compliance_report_generate should be categorized under compliance', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('compliance_report_generate');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('compliance');
    expect(info?.actionName).toBe('Generate Compliance Report');
    expect(info?.credits).toBe(100);
  });
});

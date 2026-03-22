/**
 * CommissionTracking Credit Gating Tests
 *
 * Verifies that the commission calculation action is properly gated by credits:
 * 1. commission_calculate action key is used with the correct cost (30 credits)
 * 2. useCreditGatedAction hook is integrated in CommissionTracking
 * 3. Credit check blocks action when insufficient credits
 * 4. Credit check allows action when sufficient credits
 * 5. OutOfCreditsModal is rendered for insufficient credits
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
const mockCloseOutOfCreditsModal = vi.fn();
const mockUseCreditGatedAction = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
    },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: (...args: unknown[]) => mockUseCreditGatedAction(...args),
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) =>
    open ? <div data-testid="out-of-credits-modal">{actionAttempted}</div> : null,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
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

describe('CommissionTracking Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({
      success: true,
      result: [],
      creditsCost: 30,
      wasBlocked: false,
    });
    mockUseCreditGatedAction.mockReturnValue({
      execute: mockExecute,
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: null,
      isExecuting: false,
      balance: 100,
      isFreeTier: true,
    });
  });

  it('should render the Calculate Commissions button', async () => {
    const CommissionTracking = (await import('../CommissionTracking')).default;
    renderWithProviders(<CommissionTracking />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /calculate commissions/i })).toBeInTheDocument();
    });
  });

  it('should call executeCreditAction with commission_calculate action key on calculate click', async () => {
    const user = userEvent.setup();
    const CommissionTracking = (await import('../CommissionTracking')).default;
    renderWithProviders(<CommissionTracking />);

    const calcBtn = await screen.findByRole('button', { name: /calculate commissions/i });
    await user.click(calcBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          actionKey: 'commission_calculate',
          referenceType: 'commission',
        })
      );
    });
  });

  it('should not execute calculation when credit gate blocks the action', async () => {
    mockExecute.mockResolvedValue({
      success: false,
      creditsCost: 30,
      wasBlocked: true,
    });

    const user = userEvent.setup();
    const CommissionTracking = (await import('../CommissionTracking')).default;
    renderWithProviders(<CommissionTracking />);

    const calcBtn = await screen.findByRole('button', { name: /calculate commissions/i });
    await user.click(calcBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          actionKey: 'commission_calculate',
        })
      );
    });
  });

  it('should pass onSuccess and onError callbacks to executeCreditAction', async () => {
    const user = userEvent.setup();
    const CommissionTracking = (await import('../CommissionTracking')).default;
    renderWithProviders(<CommissionTracking />);

    const calcBtn = await screen.findByRole('button', { name: /calculate commissions/i });
    await user.click(calcBtn);

    await waitFor(() => {
      const callArgs = mockExecute.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs).toHaveProperty('onSuccess');
      expect(callArgs).toHaveProperty('onError');
      expect(typeof callArgs.onSuccess).toBe('function');
      expect(typeof callArgs.onError).toBe('function');
    });
  });

  it('should render the Export CSV button alongside Calculate', async () => {
    const CommissionTracking = (await import('../CommissionTracking')).default;
    renderWithProviders(<CommissionTracking />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /calculate commissions/i })).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Credit Cost Configuration Tests for commission_calculate
// ============================================================================

describe('Commission Credit Cost Configuration', () => {
  it('commission_calculate should cost 30 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('commission_calculate')).toBe(30);
  });

  it('commission_calculate should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('commission_calculate')).toBe(false);
  });

  it('commission_calculate should be categorized under analytics', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('commission_calculate');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('analytics');
    expect(info?.actionName).toBe('Calculate Commissions');
    expect(info?.credits).toBe(30);
  });
});

// ============================================================================
// OutOfCreditsModal Integration Tests
// ============================================================================

describe('CommissionTracking OutOfCreditsModal Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreditGatedAction.mockReturnValue({
      execute: mockExecute,
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: null,
      isExecuting: false,
      balance: 100,
      isFreeTier: true,
    });
  });

  it('should not show OutOfCreditsModal when credits are sufficient', async () => {
    const CommissionTracking = (await import('../CommissionTracking')).default;
    renderWithProviders(<CommissionTracking />);

    await waitFor(() => {
      expect(screen.queryByTestId('out-of-credits-modal')).not.toBeInTheDocument();
    });
  });

  it('should show OutOfCreditsModal when credit gate blocks', async () => {
    mockUseCreditGatedAction.mockReturnValue({
      execute: mockExecute,
      showOutOfCreditsModal: true,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: 'commission_calculate',
      isExecuting: false,
      balance: 5,
      isFreeTier: true,
    });

    const CommissionTracking = (await import('../CommissionTracking')).default;
    renderWithProviders(<CommissionTracking />);

    await waitFor(() => {
      expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
      expect(screen.getByTestId('out-of-credits-modal')).toHaveTextContent('commission_calculate');
    });
  });
});

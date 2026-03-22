/**
 * AdvancedInvoice Component Tests
 *
 * Tests credit gating on invoice save action (invoice_create, 50 credits).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn().mockResolvedValue(null);
const mockNavigateToAdmin = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn().mockReturnValue({
    balance: 1000,
    isFreeTier: true,
    isLoading: false,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
    lifetimeSpent: 500,
  }),
  useCreditGatedAction: vi.fn().mockReturnValue({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: vi.fn().mockReturnValue({
    navigateToAdmin: mockNavigateToAdmin,
    navigate: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) =>
    open ? <div data-testid="out-of-credits-modal">{actionAttempted}</div> : null,
}));

vi.mock('@/components/credits/CreditCostBadge', () => ({
  CreditCostBadge: ({ actionKey }: { actionKey?: string }) =>
    <span data-testid="credit-cost-badge">{actionKey}</span>,
}));

vi.mock('@/components/admin/InvoicePDF', () => ({
  InvoiceDownloadButton: () => <button data-testid="download-btn">Download</button>,
}));

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('AdvancedInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Save button with credit cost badge', async () => {
    const { AdvancedInvoice } = await import('../AdvancedInvoice');
    render(<AdvancedInvoice />, { wrapper: createWrapper() });

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeInTheDocument();

    const badge = screen.getByTestId('credit-cost-badge');
    expect(badge).toHaveTextContent('invoice_create');
  });

  it('calls executeCreditAction with invoice_create when Save is clicked', async () => {
    const user = userEvent.setup();
    const { AdvancedInvoice } = await import('../AdvancedInvoice');
    render(<AdvancedInvoice />, { wrapper: createWrapper() });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(
      'invoice_create',
      expect.any(Function),
      expect.objectContaining({
        onInsufficientCredits: expect.any(Function),
      })
    );
  });

  it('executes the save action callback when credits are sufficient', async () => {
    const { toast } = await import('sonner');
    const { logger } = await import('@/lib/logger');

    // Make execute actually call the action callback
    mockExecute.mockImplementationOnce(
      async (_key: string, action: () => Promise<void>) => {
        await action();
        return null;
      }
    );

    const user = userEvent.setup();
    const { AdvancedInvoice } = await import('../AdvancedInvoice');
    render(<AdvancedInvoice />, { wrapper: createWrapper() });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(logger.info).toHaveBeenCalledWith(
      'Invoice saved as draft',
      expect.objectContaining({ component: 'AdvancedInvoice' })
    );
    expect(toast.success).toHaveBeenCalledWith('Invoice has been saved as draft');
  });

  it('shows OutOfCreditsModal when insufficient credits', async () => {
    // Make execute call onInsufficientCredits
    mockExecute.mockImplementationOnce(
      async (
        _key: string,
        _action: () => Promise<void>,
        options?: { onInsufficientCredits?: () => void }
      ) => {
        options?.onInsufficientCredits?.();
        return null;
      }
    );

    const user = userEvent.setup();
    const { AdvancedInvoice } = await import('../AdvancedInvoice');
    render(<AdvancedInvoice />, { wrapper: createWrapper() });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    const modal = screen.getByTestId('out-of-credits-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent('invoice_create');
  });

  it('disables Save button while credit action is executing', async () => {
    const { useCreditGatedAction } = await import('@/hooks/useCredits');
    vi.mocked(useCreditGatedAction).mockReturnValueOnce({
      execute: mockExecute,
      isPerforming: true,
      isFreeTier: true,
    });

    const { AdvancedInvoice } = await import('../AdvancedInvoice');
    render(<AdvancedInvoice />, { wrapper: createWrapper() });

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });
});

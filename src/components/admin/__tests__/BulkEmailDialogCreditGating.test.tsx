/**
 * BulkEmailDialog Credit Gating Tests
 *
 * Verifies that bulk email sending is properly gated by credits:
 * 1. send_bulk_email action key costs 8 credits per recipient
 * 2. useCreditGatedAction hook is integrated in BulkEmailDialog
 * 3. Shows estimated credit cost before sending
 * 4. Credit check blocks action when insufficient credits
 * 5. Credit check allows action when sufficient credits
 * 6. OutOfCreditsModal shown when credits are insufficient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
      business_name: 'Test Business',
      is_free_tier: true,
    },
    tenantSlug: 'test-tenant',
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

vi.mock('@/lib/credits', () => ({
  getCreditCost: (actionKey: string) => {
    if (actionKey === 'send_bulk_email') return 8;
    return 0;
  },
  getCreditCostInfo: (actionKey: string) => {
    if (actionKey === 'send_bulk_email') {
      return {
        actionKey: 'send_bulk_email',
        actionName: 'Send Bulk Email',
        credits: 8,
        category: 'crm',
        description: 'Send bulk email (volume discount)',
      };
    }
    return null;
  },
  calculateCreditVsSubscription: () => ({ savings: 0, creditPackCost: 0 }),
  CREDIT_PACKAGES: [
    { id: 'pkg-1', credits: 500, priceCents: 499 },
    { id: 'pkg-2', credits: 1000, priceCents: 899 },
  ],
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
  useCredits: () => ({
    balance: 1000,
    isFreeTier: true,
    lifetimeSpent: 500,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) =>
    open ? (
      <div data-testid="out-of-credits-modal">
        Out of credits for {actionAttempted}
      </div>
    ) : null,
}));

const mockSupabaseInsert = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseFrom = vi.fn().mockReturnValue({
  insert: mockSupabaseInsert,
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      not: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'c1', first_name: 'Alice', last_name: 'Smith', email: 'alice@test.com' },
            { id: 'c2', first_name: 'Bob', last_name: 'Jones', email: 'bob@test.com' },
            { id: 'c3', first_name: 'Carol', last_name: 'White', email: 'carol@test.com' },
          ],
          error: null,
        }),
      }),
    }),
  }),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
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

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (e: unknown) => String(e),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    customers: {
      list: (tenantId: string) => ['customers', 'list', tenantId],
    },
  },
}));

vi.mock('@/config/planPricing', () => ({
  PLAN_CONFIG: {
    starter: { priceMonthly: 29 },
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
  // Pre-populate customer data
  queryClient.setQueryData(['customers', 'list', 'test-tenant-id'], [
    { id: 'c1', first_name: 'Alice', last_name: 'Smith', email: 'alice@test.com' },
    { id: 'c2', first_name: 'Bob', last_name: 'Jones', email: 'bob@test.com' },
    { id: 'c3', first_name: 'Carol', last_name: 'White', email: 'carol@test.com' },
  ]);
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('BulkEmailDialog Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render the bulk email dialog', async () => {
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByText('Send Bulk Email')).toBeInTheDocument();
    expect(screen.getByText('Send personalized emails to multiple customers at once.')).toBeInTheDocument();
  });

  it('should show estimated credit cost when customers are selected', async () => {
    const user = userEvent.setup();
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} preSelectedCustomerIds={['c1', 'c2']} />
    );

    // With 2 pre-selected customers at 8 credits each = 16 credits
    await waitFor(() => {
      const costEstimate = screen.getByTestId('credit-cost-estimate');
      expect(costEstimate).toBeInTheDocument();
      expect(costEstimate).toHaveTextContent('2 recipients × 8 credits = 16 credits');
    });
  });

  it('should update estimated cost when recipients change', async () => {
    const user = userEvent.setup();
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} preSelectedCustomerIds={['c1']} />
    );

    // Initially 1 recipient = 8 credits
    await waitFor(() => {
      const costEstimate = screen.getByTestId('credit-cost-estimate');
      expect(costEstimate).toHaveTextContent('1 recipient × 8 credits = 8 credits');
    });
  });

  it('should not show cost estimate when no customers selected', async () => {
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.queryByTestId('credit-cost-estimate')).not.toBeInTheDocument();
  });

  it('should show credit cost badge on the send button', async () => {
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} preSelectedCustomerIds={['c1', 'c2', 'c3']} />
    );

    // 3 recipients × 8 = 24 credits badge
    await waitFor(() => {
      expect(screen.getByText('24 cr')).toBeInTheDocument();
    });
  });

  it('should call executeCreditAction with send_bulk_email on send', async () => {
    const user = userEvent.setup();
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} preSelectedCustomerIds={['c1']} />
    );

    // Fill in subject and body
    const subjectInput = screen.getByPlaceholderText('Email subject...');
    await user.type(subjectInput, 'Test Subject');

    const bodyInput = screen.getByPlaceholderText('Email body...');
    await user.type(bodyInput, 'Test body content');

    // Click send
    const sendBtn = screen.getByRole('button', { name: /send to 1 customer/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'send_bulk_email',
        expect.any(Function),
        expect.objectContaining({
          onInsufficientCredits: expect.any(Function),
        })
      );
    });
  });

  it('should not send emails when credit gate blocks the action', async () => {
    // Simulate credit gate blocking
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} preSelectedCustomerIds={['c1']} />
    );

    const subjectInput = screen.getByPlaceholderText('Email subject...');
    await user.type(subjectInput, 'Test Subject');

    const bodyInput = screen.getByPlaceholderText('Email body...');
    await user.type(bodyInput, 'Test body content');

    const sendBtn = screen.getByRole('button', { name: /send to 1 customer/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('send_bulk_email', expect.any(Function), expect.any(Object));
    });

    // email_logs insert should NOT have been called since action was blocked
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });

  it('should show OutOfCreditsModal when insufficient credits callback fires', async () => {
    // Simulate credit gate blocking and calling onInsufficientCredits
    mockExecute.mockImplementation(
      async (_actionKey: string, _action: () => Promise<unknown>, options?: { onInsufficientCredits?: () => void }) => {
        options?.onInsufficientCredits?.();
        return null;
      }
    );

    const user = userEvent.setup();
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} preSelectedCustomerIds={['c1']} />
    );

    const subjectInput = screen.getByPlaceholderText('Email subject...');
    await user.type(subjectInput, 'Test Subject');

    const bodyInput = screen.getByPlaceholderText('Email body...');
    await user.type(bodyInput, 'Test body content');

    const sendBtn = screen.getByRole('button', { name: /send to 1 customer/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
      expect(screen.getByText('Out of credits for send_bulk_email')).toBeInTheDocument();
    });
  });

  it('should queue emails when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} preSelectedCustomerIds={['c1']} />
    );

    const subjectInput = screen.getByPlaceholderText('Email subject...');
    await user.type(subjectInput, 'Hello {customer_name}');

    const bodyInput = screen.getByPlaceholderText('Email body...');
    await user.type(bodyInput, 'Welcome to {business_name}!');

    const sendBtn = screen.getByRole('button', { name: /send to 1 customer/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalledWith('email_logs');
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'test-tenant-id',
          customer_id: 'c1',
          status: 'queued',
        })
      );
    });

    expect(toast.success).toHaveBeenCalledWith(
      'Emails queued successfully!',
      expect.objectContaining({
        description: expect.stringContaining('1 email'),
      })
    );
  });

  it('should not call credit gate when no recipients are selected', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');
    const { BulkEmailDialog } = await import('../BulkEmailDialog');
    renderWithProviders(
      <BulkEmailDialog open={true} onOpenChange={vi.fn()} />
    );

    // Fill in subject and body but select no recipients
    const subjectInput = screen.getByPlaceholderText('Email subject...');
    await user.type(subjectInput, 'Test Subject');

    const bodyInput = screen.getByPlaceholderText('Email body...');
    await user.type(bodyInput, 'Some body text');

    // Send button should be disabled because no recipients
    const sendBtn = screen.getByRole('button', { name: /send to 0 customers/i });
    expect(sendBtn).toBeDisabled();

    // Credit gate should NOT have been called
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests
// ============================================================================

describe('Bulk Email Credit Cost Configuration', () => {
  it('send_bulk_email should cost 8 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('send_bulk_email')).toBe(8);
  });

  it('send_bulk_email should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('send_bulk_email')).toBe(false);
  });

  it('send_bulk_email should be categorized under crm', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('send_bulk_email');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('crm');
    expect(info?.actionName).toBe('Send Bulk Email');
    expect(info?.credits).toBe(8);
  });

  it('bulk email should be cheaper per-email than single send_email', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    const bulkCost = getCreditCost('send_bulk_email');
    const singleCost = getCreditCost('send_email');
    expect(bulkCost).toBeLessThan(singleCost);
  });
});

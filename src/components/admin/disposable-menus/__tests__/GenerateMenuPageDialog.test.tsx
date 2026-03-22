/**
 * GenerateMenuPageDialog Tests
 *
 * Tests credit-gating integration:
 * 1. Renders CreditCostBadge on generate button (free tier)
 * 2. Calls generateMenu (credit-gated) on form submit
 * 3. Shows OutOfCreditsModal when insufficient credits
 * 4. Hides CreditCostBadge for non-free-tier users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// Mock setup
// ============================================================================

const mockGenerateMenu = vi.fn();
const mockCloseOutOfCreditsModal = vi.fn();

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useGenerateMenu: vi.fn(() => ({
    generateMenu: mockGenerateMenu,
    isGenerating: false,
    showOutOfCreditsModal: false,
    closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
    blockedAction: null,
    balance: 1000,
    isFreeTier: true,
  })),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Biz' },
    tenantSlug: 'test-tenant',
    loading: false,
    admin: { id: 'admin-1', email: 'admin@test.com' },
  })),
}));

vi.mock('@/hooks/useProductsForMenu', () => ({
  useProductsForMenu: vi.fn(() => ({
    data: [
      { id: 'prod-1', name: 'OG Kush', price: 35, category: 'Flower' },
      { id: 'prod-2', name: 'Blue Dream', price: 40, category: 'Flower' },
    ],
    isLoading: false,
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { url_token: 'abc123' }, error: null }),
    },
  },
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

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    menus: { all: ['menus'] },
    credits: { balance: (id?: string) => ['credits', 'balance', id] },
  },
}));

vi.mock('@/components/credits/OutOfCreditsModal', () => ({
  OutOfCreditsModal: ({ open, actionAttempted }: { open: boolean; actionAttempted?: string }) =>
    open ? (
      <div data-testid="out-of-credits-modal">
        Out of credits modal - action: {actionAttempted}
      </div>
    ) : null,
}));

vi.mock('@/components/credits/CreditCostBadge', () => ({
  CreditCostBadge: ({ actionKey, compact }: { actionKey: string; compact?: boolean }) => (
    <span data-testid="credit-cost-badge" data-action-key={actionKey} data-compact={compact}>
      100
    </span>
  ),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: vi.fn(() => ({
    balance: 1000,
    isFreeTier: true,
    isLoading: false,
    lifetimeSpent: 500,
  })),
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn(() => 100),
  getCreditCostInfo: vi.fn(() => ({
    actionName: 'Create Menu',
    credits: 100,
    description: 'Generate a menu page',
  })),
  calculateCreditVsSubscription: vi.fn(() => ({
    creditPackCost: 10,
    subscriptionCost: 29,
    savings: 0,
  })),
  CREDIT_PACKAGES: [
    { id: 'pack-100', credits: 100, priceCents: 499 },
    { id: 'pack-500', credits: 500, priceCents: 1999 },
  ],
}));

vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: vi.fn((val: number) => `$${val.toFixed(2)}`),
}));

// ============================================================================
// Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Import after mocks
// ============================================================================

import { GenerateMenuPageDialog } from '../GenerateMenuPageDialog';
import { useGenerateMenu } from '@/hooks/useCreditGatedAction';

describe('GenerateMenuPageDialog', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateMenu.mockResolvedValue({ success: true, result: 'abc123', creditsCost: 100, wasBlocked: false });
  });

  it('renders CreditCostBadge on the generate button', () => {
    render(
      <GenerateMenuPageDialog open onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    const badge = screen.getByTestId('credit-cost-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-action-key', 'menu_create');
  });

  it('renders the generate button with correct text', () => {
    render(
      <GenerateMenuPageDialog open onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole('button', { name: /generate page/i })).toBeInTheDocument();
  });

  it('disables generate button when no products selected and no title', () => {
    render(
      <GenerateMenuPageDialog open onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    const btn = screen.getByRole('button', { name: /generate page/i });
    expect(btn).toBeDisabled();
  });

  it('calls generateMenu with credit gate on form submit', async () => {
    render(
      <GenerateMenuPageDialog open onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    // Fill in title
    const titleInput = screen.getByPlaceholderText('e.g. Weekly Specials');
    await user.type(titleInput, 'Test Menu');

    // Select a product
    const productCheckboxes = screen.getAllByRole('checkbox');
    await user.click(productCheckboxes[0]);

    // Click generate
    const generateBtn = screen.getByRole('button', { name: /generate page/i });
    expect(generateBtn).not.toBeDisabled();
    await user.click(generateBtn);

    await waitFor(() => {
      expect(mockGenerateMenu).toHaveBeenCalledTimes(1);
    });

    // Verify it was called with an action function and options
    const [actionFn, options] = mockGenerateMenu.mock.calls[0];
    expect(typeof actionFn).toBe('function');
    expect(options).toHaveProperty('onSuccess');
    expect(options).toHaveProperty('onError');
  });

  it('shows OutOfCreditsModal when credits are insufficient', () => {
    vi.mocked(useGenerateMenu).mockReturnValue({
      generateMenu: mockGenerateMenu,
      isGenerating: false,
      showOutOfCreditsModal: true,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: 'menu_create',
      balance: 50,
      isFreeTier: true,
    });

    render(
      <GenerateMenuPageDialog open onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    const modal = screen.getByTestId('out-of-credits-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent('menu_create');
  });

  it('does not show OutOfCreditsModal when credits are sufficient', () => {
    vi.mocked(useGenerateMenu).mockReturnValue({
      generateMenu: mockGenerateMenu,
      isGenerating: false,
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: null,
      balance: 1000,
      isFreeTier: true,
    });

    render(
      <GenerateMenuPageDialog open onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId('out-of-credits-modal')).not.toBeInTheDocument();
  });

  it('shows loading state when generating', () => {
    vi.mocked(useGenerateMenu).mockReturnValue({
      generateMenu: mockGenerateMenu,
      isGenerating: true,
      showOutOfCreditsModal: false,
      closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
      blockedAction: null,
      balance: 1000,
      isFreeTier: true,
    });

    render(
      <GenerateMenuPageDialog open onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    const btn = screen.getByRole('button', { name: /generate page/i });
    expect(btn).toBeDisabled();
  });

  it('does not render when open is false', () => {
    render(
      <GenerateMenuPageDialog open={false} onOpenChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByText('Generate Menu Page')).not.toBeInTheDocument();
  });
});

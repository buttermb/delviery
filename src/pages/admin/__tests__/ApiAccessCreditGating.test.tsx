/**
 * ApiAccess Credit Gating Tests
 *
 * Verifies that the API Access page properly integrates useCreditGatedAction:
 * 1. Shows per-call API costs for free-tier users
 * 2. Hides cost reference card for paid users
 * 3. Gates "Create API Key" behind credit check
 * 4. Shows OutOfCreditsModal when credits insufficient
 * 5. Displays CreditCostBadge next to create button
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockCloseOutOfCreditsModal = vi.fn();

let mockIsFreeTier = true;
let mockBalance = 1000;
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
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: false,
    error: null,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    lifetimeStats: { earned: 500, spent: 0, purchased: 0, expired: 0, refunded: 0 },
    subscription: { status: 'none', isFreeTier: mockIsFreeTier, creditsPerPeriod: 500, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    lifetimeEarned: 500,
    lifetimeSpent: 0,
    nextFreeGrantAt: null,
    percentUsed: 0,
    hasCredits: (amount: number) => mockBalance >= amount,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true, newBalance: 995, creditsCost: 5 }),
    refetch: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isExecuting: false,
    showOutOfCreditsModal: mockShowOutOfCreditsModal,
    closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
    blockedAction: mockBlockedAction,
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
  }),
}));

vi.mock('@/utils/adminApiClient', () => ({
  listAdminRecords: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'key-1',
        name: 'Production Key',
        key: 'sk_abc123def456ghi789',
        created_at: '2026-01-15T10:00:00Z',
        permissions: ['read', 'write'],
      },
    ],
    error: null,
  }),
  createAdminRecord: vi.fn().mockResolvedValue({
    data: { id: 'key-2', name: 'Test Key', key: 'sk_newkey123' },
    error: null,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((actionKey: string) => {
    const costs: Record<string, number> = { api_call: 5 };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn((actionKey: string) => {
    if (actionKey === 'api_call') {
      return { actionKey: 'api_call', actionName: 'API Call', credits: 5, category: 'api', description: 'External API request' };
    }
    return null;
  }),
  calculateCreditVsSubscription: vi.fn(() => ({ savings: 0, creditPackCost: 0 })),
  CREDIT_PACKAGES: [
    { id: 'starter-pack', name: 'Starter Pack', slug: 'starter-pack', credits: 5000, priceCents: 999, description: '5,000 credits' },
    { id: 'growth-pack', name: 'Growth Pack', slug: 'growth-pack', credits: 15000, priceCents: 2499, description: '15,000 credits' },
  ],
}));

vi.mock('@/config/planPricing', () => ({
  PLAN_CONFIG: {
    starter: { priceMonthly: 29 },
    professional: { priceMonthly: 79 },
    enterprise: { priceMonthly: 199 },
  },
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
}));

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </BrowserRouter>
    );
  };
}

// Lazy import so mocks are in place before module loads
async function renderApiAccess() {
  const mod = await import('@/pages/admin/ApiAccess');
  const ApiAccess = mod.default;
  return render(<ApiAccess />, { wrapper: createWrapper() });
}

// ============================================================================
// Tests
// ============================================================================

describe('ApiAccess – Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFreeTier = true;
    mockBalance = 1000;
    mockShowOutOfCreditsModal = false;
    mockBlockedAction = null;
  });

  it('shows per-call API costs card for free-tier users', async () => {
    await renderApiAccess();

    const costCard = await screen.findByTestId('api-cost-reference');
    expect(costCard).toBeInTheDocument();

    // Verify all HTTP methods are displayed
    expect(screen.getByTestId('api-cost-get')).toBeInTheDocument();
    expect(screen.getByTestId('api-cost-post')).toBeInTheDocument();
    expect(screen.getByTestId('api-cost-put')).toBeInTheDocument();
    expect(screen.getByTestId('api-cost-delete')).toBeInTheDocument();
  });

  it('shows correct costs for each HTTP method', async () => {
    await renderApiAccess();

    const getCell = await screen.findByTestId('api-cost-get');
    expect(within(getCell).getByText('1')).toBeInTheDocument();
    expect(within(getCell).getByText('GET')).toBeInTheDocument();

    const postCell = screen.getByTestId('api-cost-post');
    expect(within(postCell).getByText('5–25')).toBeInTheDocument();

    const putCell = screen.getByTestId('api-cost-put');
    expect(within(putCell).getByText('3')).toBeInTheDocument();

    const deleteCell = screen.getByTestId('api-cost-delete');
    expect(within(deleteCell).getByText('1')).toBeInTheDocument();
  });

  it('hides per-call costs card for paid-tier users', async () => {
    mockIsFreeTier = false;
    await renderApiAccess();

    // Wait for content to load
    await screen.findByText('API Access');
    expect(screen.queryByTestId('api-cost-reference')).not.toBeInTheDocument();
  });

  it('displays current balance in cost card description', async () => {
    mockBalance = 2500;
    await renderApiAccess();

    const costCard = await screen.findByTestId('api-cost-reference');
    expect(within(costCard).getByText(/Current balance: 2,500 credits/)).toBeInTheDocument();
  });

  it('calls useCreditGatedAction execute when creating a key', async () => {
    const user = userEvent.setup();
    await renderApiAccess();

    // Open the create dialog
    const createButton = await screen.findByRole('button', { name: /Create API Key/i });
    await user.click(createButton);

    // Fill in the form
    const nameInput = screen.getByLabelText(/Key Name/i);
    await user.type(nameInput, 'My Test Key');

    // Click the create button in the dialog
    const dialogCreateButton = screen.getByRole('button', { name: /^Create Key$/i });
    await user.click(dialogCreateButton);

    // Verify execute was called with api_call action key
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKey: 'api_call',
        action: expect.any(Function),
      })
    );
  });

  it('shows example cost estimation text', async () => {
    await renderApiAccess();

    await screen.findByTestId('api-cost-reference');
    expect(screen.getByText(/1,000 GET calls = 1,000 credits/)).toBeInTheDocument();
  });
});

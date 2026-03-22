/**
 * WebhookSettings Credit Gate Tests
 *
 * Verifies that webhook configuration shows credit cost information:
 * 1. Free-tier users see the info banner about webhook trigger costs
 * 2. Non-free-tier users do NOT see the info banner
 * 3. trackCreditEvent is called for analytics on page view
 * 4. CreditCostBadge is rendered with the correct webhook_fired action key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockTrackCreditEvent = vi.fn();
let mockIsFreeTier = true;
let mockBalance = 500;

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
    admin: { id: 'test-admin-id' },
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    isFreeTier: mockIsFreeTier,
    balance: mockBalance,
    isLoading: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    lifetimeStats: { earned: 500, spent: 0, purchased: 0, expired: 0, refunded: 0 },
    subscription: { status: 'none', isFreeTier: mockIsFreeTier, creditsPerPeriod: 500, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    lifetimeEarned: 500,
    lifetimeSpent: 0,
    nextFreeGrantAt: null,
    percentUsed: 0,
    hasCredits: () => true,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true, newBalance: 495, creditsCost: 5 }),
    refetch: vi.fn(),
    invalidate: vi.fn(),
    error: null,
  }),
  useCreditGatedAction: () => ({
    execute: vi.fn(),
    isPerforming: false,
    isFreeTier: mockIsFreeTier,
  }),
}));

vi.mock('@/lib/credits', () => ({
  trackCreditEvent: (...args: unknown[]) => mockTrackCreditEvent(...args),
  getCreditCost: (key: string) => (key === 'webhook_fired' ? 5 : 0),
  getCreditCostInfo: (key: string) =>
    key === 'webhook_fired'
      ? { actionKey: 'webhook_fired', actionName: 'Webhook Fired', credits: 5, category: 'integrations', description: 'Webhook execution (API cost)' }
      : null,
}));

vi.mock('@/components/credits/CreditCostBadge', () => ({
  CreditCostBadge: ({ actionKey }: { actionKey: string }) => (
    <span data-testid="credit-cost-badge" data-action-key={actionKey}>
      5 credits
    </span>
  ),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    webhooks: { list: (tenantId?: string) => ['webhooks', 'list', tenantId] },
    credits: { balance: (tenantId?: string) => ['credits', 'balance', tenantId], all: ['credits'] },
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    }),
    channel: () => ({
      on: function () { return this; },
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/components/settings/SettingsSection', () => ({
  SettingsSection: ({ children, title, action }: { children: ReactNode; title: string; action: ReactNode }) => (
    <div data-testid="settings-section">
      <h3>{title}</h3>
      {action}
      {children}
    </div>
  ),
  SettingsCard: ({ children }: { children: ReactNode }) => <div data-testid="settings-card">{children}</div>,
  SettingsRow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SaveStatusIndicator: ({ status }: { status: string }) => <div data-testid="save-status">{status}</div>,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// Import component after mocks
// ============================================================================

import WebhookSettings from '../WebhookSettings';

// ============================================================================
// Test Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('WebhookSettings Credit Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFreeTier = true;
    mockBalance = 500;
  });

  it('shows credit info banner for free-tier users', async () => {
    render(<WebhookSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Webhook configuration is free.')).toBeInTheDocument();
    });

    expect(screen.getByText(/Each webhook trigger costs/)).toBeInTheDocument();
    expect(screen.getAllByText(/5 credits/i).length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT show credit info banner for non-free-tier users', async () => {
    mockIsFreeTier = false;

    render(<WebhookSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Webhook Configuration')).toBeInTheDocument();
    });

    expect(screen.queryByText('Webhook configuration is free.')).not.toBeInTheDocument();
  });

  it('renders CreditCostBadge with webhook_fired action key', async () => {
    render(<WebhookSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      const badge = screen.getByTestId('credit-cost-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-action-key', 'webhook_fired');
    });
  });

  it('tracks webhook config page view for free-tier analytics', async () => {
    render(<WebhookSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockTrackCreditEvent).toHaveBeenCalledWith(
        'test-tenant-id',
        'webhook_config_viewed',
        500
      );
    });
  });

  it('does NOT track page view for non-free-tier users', async () => {
    mockIsFreeTier = false;

    render(<WebhookSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Webhook Configuration')).toBeInTheDocument();
    });

    expect(mockTrackCreditEvent).not.toHaveBeenCalled();
  });

  it('shows the "Add Webhook" button regardless of free-tier status', async () => {
    render(<WebhookSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Add Webhook')).toBeInTheDocument();
    });
  });
});

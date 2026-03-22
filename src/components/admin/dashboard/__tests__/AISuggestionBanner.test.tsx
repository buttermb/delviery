/**
 * AISuggestionBanner Component Tests
 *
 * Tests credit-gated AI suggestions trigger:
 * 1. Renders banner with stale product count
 * 2. Shows "AI Feature — 100 credits" badge for free tier users
 * 3. Wraps "View products" action with useCreditGatedAction
 * 4. Shows OutOfCreditsModal when insufficient credits
 * 5. Hides badge for paid tier users
 * 6. Dismisses via localStorage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockNavigate = vi.fn();
const mockTriggerAISuggestions = vi.fn();
const mockCloseOutOfCreditsModal = vi.fn();

// Track the current mock state for useAISuggestions
let mockAISuggestionsState = {
  isTriggering: false,
  showOutOfCreditsModal: false,
  blockedAction: null as string | null,
  isFreeTier: true,
  balance: 1000,
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tenantSlug: 'test-tenant' }),
  };
});

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useCreditGatedAction', () => ({
  useAISuggestions: () => ({
    triggerAISuggestions: mockTriggerAISuggestions,
    closeOutOfCreditsModal: mockCloseOutOfCreditsModal,
    ...mockAISuggestionsState,
  }),
}));

vi.mock('@/components/credits', () => ({
  CreditCostBadge: ({ actionKey, compact, hoverMode }: { actionKey: string; compact?: boolean; hoverMode?: boolean }) => (
    <span data-testid="credit-cost-badge" data-action-key={actionKey} data-compact={compact} data-hover-mode={hoverMode}>
      100
    </span>
  ),
  OutOfCreditsModal: ({ open, onOpenChange, actionAttempted }: { open: boolean; onOpenChange: (open: boolean) => void; actionAttempted?: string }) => (
    open ? (
      <div data-testid="out-of-credits-modal" data-action={actionAttempted}>
        <button data-testid="close-modal" onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
  ),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [{ id: '1' }, { id: '2' }, { id: '3' }], error: null })),
        })),
        in: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: [{ product_id: '1' }], error: null })),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    dashboard: {
      stats: (tenantId?: string) => ['dashboard', 'stats', tenantId],
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

// Must import after mocks
import { AISuggestionBanner } from '../AISuggestionBanner';

describe('AISuggestionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    localStorage.clear();
    // Reset mock state
    mockAISuggestionsState = {
      isTriggering: false,
      showOutOfCreditsModal: false,
      blockedAction: null,
      isFreeTier: true,
      balance: 1000,
    };
    // Default: successful credit-gated action
    mockTriggerAISuggestions.mockResolvedValue({
      success: true,
      creditsCost: 100,
      wasBlocked: false,
    });
  });

  it('renders the AI suggestion banner with stale product count', async () => {
    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/products haven't/)).toBeInTheDocument();
    });
  });

  it('shows "AI Feature — 100 credits" badge for free tier users', async () => {
    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Feature — 100 credits')).toBeInTheDocument();
    });
  });

  it('hides credit badge for paid tier users', async () => {
    mockAISuggestionsState.isFreeTier = false;

    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/products haven't/)).toBeInTheDocument();
    });

    expect(screen.queryByText('AI Feature — 100 credits')).not.toBeInTheDocument();
  });

  it('triggers credit-gated action when "View products" is clicked', async () => {
    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('View products')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View products'));

    expect(mockTriggerAISuggestions).toHaveBeenCalledTimes(1);
    expect(mockTriggerAISuggestions).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('shows OutOfCreditsModal when action is blocked', async () => {
    mockAISuggestionsState.showOutOfCreditsModal = true;
    mockAISuggestionsState.blockedAction = 'ai_suggestions';

    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('out-of-credits-modal')).toBeInTheDocument();
    });

    expect(screen.getByTestId('out-of-credits-modal')).toHaveAttribute(
      'data-action',
      'ai_suggestions'
    );
  });

  it('does not show OutOfCreditsModal when action is not blocked', async () => {
    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/products haven't/)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('out-of-credits-modal')).not.toBeInTheDocument();
  });

  it('disables button while triggering', async () => {
    mockAISuggestionsState.isTriggering = true;

    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    const button = screen.getByText('Loading...').closest('button');
    expect(button).toBeDisabled();
  });

  it('renders CreditCostBadge on the View products button', async () => {
    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('credit-cost-badge')).toBeInTheDocument();
    });

    expect(screen.getByTestId('credit-cost-badge')).toHaveAttribute(
      'data-action-key',
      'ai_suggestions'
    );
  });

  it('dismisses banner and stores in localStorage', async () => {
    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Dismiss suggestion')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Dismiss suggestion'));

    expect(localStorage.getItem('floraiq_ai_suggestion_dismissed')).toBe('true');
  });

  it('does not render when already dismissed via localStorage', () => {
    localStorage.setItem('floraiq_ai_suggestion_dismissed', 'true');

    const { container } = render(<AISuggestionBanner />, { wrapper: createWrapper() });

    expect(container.innerHTML).toBe('');
  });

  it('navigates on successful credit-gated action', async () => {
    // Make the trigger actually invoke the action callback
    mockTriggerAISuggestions.mockImplementation(async (action: () => Promise<unknown>) => {
      await action();
      return { success: true, creditsCost: 100, wasBlocked: false };
    });

    render(<AISuggestionBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('View products')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View products'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/inventory-hub');
    });
  });
});

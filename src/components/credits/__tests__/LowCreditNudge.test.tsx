/**
 * LowCreditNudge Tests
 *
 * Verifies:
 * - Compact variant: shows header badge with balance + buy CTA
 * - Inline variant: shows contextual upgrade prompt with plan pricing
 * - Only shows for free tier users
 * - Hides when balance is above threshold
 * - Dismissible behavior
 * - Upgrade button navigates to select-plan
 * - Action context shown when actionKey provided
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LowCreditNudge } from '../LowCreditNudge';

// ============================================================================
// Mocks
// ============================================================================

let mockBalance = 50;
let mockIsFreeTier = true;
let mockIsLoading = false;
let mockIsOutOfCredits = false;
let mockIsCriticalCredits = true;

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: mockIsLoading,
    isOutOfCredits: mockIsOutOfCredits,
    isCriticalCredits: mockIsCriticalCredits,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenantSlug: 'test-shop',
  }),
}));

vi.mock('@/lib/credits', () => ({
  getCreditCostInfo: (actionKey: string) => {
    const costs: Record<string, { actionKey: string; actionName: string; credits: number; category: string; description: string }> = {
      menu_create: { actionKey: 'menu_create', actionName: 'Create Menu', credits: 100, category: 'menus', description: 'Create a new menu' },
      send_sms: { actionKey: 'send_sms', actionName: 'Send SMS', credits: 25, category: 'crm', description: 'Send an SMS message' },
    };
    return costs[actionKey] ?? null;
  },
}));

vi.mock('@/config/planPricing', () => ({
  PLAN_CONFIG: {
    free: { name: 'Free', priceMonthly: 0 },
    starter: { name: 'Starter', priceMonthly: 79 },
    professional: { name: 'Professional', priceMonthly: 150 },
    enterprise: { name: 'Enterprise', priceMonthly: 499 },
  },
}));

vi.mock('../CreditPurchaseModal', () => ({
  CreditPurchaseModal: ({ open }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="credit-purchase-modal">Purchase Modal</div> : null,
}));

// ============================================================================
// Helpers
// ============================================================================

function resetMocks() {
  mockBalance = 50;
  mockIsFreeTier = true;
  mockIsLoading = false;
  mockIsOutOfCredits = false;
  mockIsCriticalCredits = true;
  mockNavigate.mockClear();
}

// ============================================================================
// Tests
// ============================================================================

describe('LowCreditNudge', () => {
  beforeEach(resetMocks);

  describe('Compact variant (default)', () => {
    it('should render when balance is below threshold', () => {
      render(<LowCreditNudge />);
      expect(screen.getByTestId('low-credit-nudge')).toBeInTheDocument();
      expect(screen.getByText('50 credits left')).toBeInTheDocument();
    });

    it('should show "Out of credits!" when balance is 0', () => {
      mockBalance = 0;
      mockIsOutOfCredits = true;
      render(<LowCreditNudge />);
      expect(screen.getByText('Out of credits!')).toBeInTheDocument();
    });

    it('should show Buy Now badge', () => {
      render(<LowCreditNudge />);
      expect(screen.getByText('Buy Now')).toBeInTheDocument();
    });

    it('should open purchase modal on click', () => {
      render(<LowCreditNudge />);
      fireEvent.click(screen.getByTestId('low-credit-nudge'));
      expect(screen.getByTestId('credit-purchase-modal')).toBeInTheDocument();
    });

    it('should not render when balance is above threshold', () => {
      mockBalance = 200;
      mockIsCriticalCredits = false;
      render(<LowCreditNudge />);
      expect(screen.queryByTestId('low-credit-nudge')).not.toBeInTheDocument();
    });

    it('should not render for paid tier users', () => {
      mockIsFreeTier = false;
      render(<LowCreditNudge />);
      expect(screen.queryByTestId('low-credit-nudge')).not.toBeInTheDocument();
    });

    it('should not render while loading', () => {
      mockIsLoading = true;
      render(<LowCreditNudge />);
      expect(screen.queryByTestId('low-credit-nudge')).not.toBeInTheDocument();
    });

    it('should dismiss when X is clicked', () => {
      render(<LowCreditNudge />);
      expect(screen.getByTestId('low-credit-nudge')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('nudge-dismiss'));
      expect(screen.queryByTestId('low-credit-nudge')).not.toBeInTheDocument();
    });

    it('should respect custom threshold', () => {
      mockBalance = 150;
      mockIsCriticalCredits = false;
      render(<LowCreditNudge threshold={200} />);
      expect(screen.getByTestId('low-credit-nudge')).toBeInTheDocument();
    });

    it('should apply urgent styling when balance <= 25', () => {
      mockBalance = 20;
      render(<LowCreditNudge />);
      const nudge = screen.getByTestId('low-credit-nudge');
      expect(nudge.className).toContain('animate-pulse');
    });
  });

  describe('Inline variant', () => {
    it('should render inline card with upgrade messaging', () => {
      mockBalance = 200;
      mockIsCriticalCredits = false;
      render(<LowCreditNudge variant="inline" />);
      expect(screen.getByTestId('low-credit-nudge-inline')).toBeInTheDocument();
      expect(screen.getByText(/200 credits left/)).toBeInTheDocument();
      expect(screen.getByText(/Upgrade to a plan for unlimited actions/)).toBeInTheDocument();
    });

    it('should show upgrade button with starter plan pricing', () => {
      render(<LowCreditNudge variant="inline" />);
      const upgradeBtn = screen.getByTestId('nudge-upgrade-btn');
      expect(upgradeBtn).toBeInTheDocument();
      expect(upgradeBtn).toHaveTextContent('$79/mo');
    });

    it('should show buy credits button', () => {
      render(<LowCreditNudge variant="inline" />);
      expect(screen.getByTestId('nudge-buy-credits-btn')).toBeInTheDocument();
    });

    it('should navigate to select-plan on upgrade click', () => {
      render(<LowCreditNudge variant="inline" />);
      fireEvent.click(screen.getByTestId('nudge-upgrade-btn'));
      expect(mockNavigate).toHaveBeenCalledWith('/test-shop/admin/select-plan');
    });

    it('should open purchase modal on buy credits click', () => {
      render(<LowCreditNudge variant="inline" />);
      fireEvent.click(screen.getByTestId('nudge-buy-credits-btn'));
      expect(screen.getByTestId('credit-purchase-modal')).toBeInTheDocument();
    });

    it('should show action context when actionKey is provided', () => {
      mockBalance = 50;
      render(<LowCreditNudge variant="inline" actionKey="menu_create" />);
      expect(screen.getByText(/requires 100 credits/)).toBeInTheDocument();
    });

    it('should not show action cost text when user can afford the action', () => {
      mockBalance = 200;
      mockIsCriticalCredits = false;
      render(<LowCreditNudge variant="inline" actionKey="send_sms" />);
      // send_sms costs 25, balance is 200 — can afford
      expect(screen.queryByText(/requires 25 credits/)).not.toBeInTheDocument();
    });

    it('should use higher default threshold (500) than compact', () => {
      mockBalance = 400;
      mockIsCriticalCredits = false;

      // Compact variant with default threshold (100) should NOT show
      const { unmount } = render(<LowCreditNudge variant="compact" />);
      expect(screen.queryByTestId('low-credit-nudge')).not.toBeInTheDocument();
      unmount();

      // Inline variant with default threshold (500) SHOULD show
      render(<LowCreditNudge variant="inline" />);
      expect(screen.getByTestId('low-credit-nudge-inline')).toBeInTheDocument();
    });

    it('should show out-of-credits styling when balance is 0', () => {
      mockBalance = 0;
      mockIsOutOfCredits = true;
      render(<LowCreditNudge variant="inline" />);
      const nudge = screen.getByTestId('low-credit-nudge-inline');
      expect(nudge.className).toContain('bg-red-500/5');
      expect(screen.getByText(/no credits remaining/)).toBeInTheDocument();
    });

    it('should not render for paid tier users', () => {
      mockIsFreeTier = false;
      render(<LowCreditNudge variant="inline" />);
      expect(screen.queryByTestId('low-credit-nudge-inline')).not.toBeInTheDocument();
    });

    it('should dismiss when X is clicked', () => {
      render(<LowCreditNudge variant="inline" />);
      expect(screen.getByTestId('low-credit-nudge-inline')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('nudge-inline-dismiss'));
      expect(screen.queryByTestId('low-credit-nudge-inline')).not.toBeInTheDocument();
    });

    it('should call onDismiss callback when dismissed', () => {
      const onDismiss = vi.fn();
      render(<LowCreditNudge variant="inline" onDismiss={onDismiss} />);

      fireEvent.click(screen.getByTestId('nudge-inline-dismiss'));
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should hide dismiss button when dismissible is false', () => {
      render(<LowCreditNudge variant="inline" dismissible={false} />);
      expect(screen.queryByTestId('nudge-inline-dismiss')).not.toBeInTheDocument();
    });
  });
});

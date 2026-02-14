/**
 * OutOfCreditsModal Tests
 *
 * Verifies:
 * - Progress bar visualization showing required vs available credits
 * - Quick purchase buttons (5K, 15K)
 * - Auto top-up setup suggestion
 * - All packages link
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutOfCreditsModal } from '../OutOfCreditsModal';
import { BrowserRouter } from 'react-router-dom';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock external dependencies
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 25,
    lifetimeSpent: 1500,
    isFreeTier: true,
    isLoading: false,
  }),
}));

vi.mock('@/lib/credits', () => ({
  getCreditCostInfo: (actionKey: string) => {
    if (actionKey === 'menu_create') {
      return {
        actionKey: 'menu_create',
        actionName: 'Create Menu',
        credits: 100,
        category: 'menus',
        description: 'Create disposable menu',
      };
    }
    return null;
  },
  calculateCreditVsSubscription: () => ({
    savings: 500,
    creditPackCost: 150,
  }),
  CREDIT_PACKAGES: [
    { id: 'quick-boost', credits: 500, priceCents: 1999, slug: 'quick-boost' },
  ],
}));

const renderModal = (props = {}) => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    actionAttempted: 'menu_create',
    onBuyCredits: vi.fn(),
    onQuickPurchase: vi.fn(),
    onSetupAutoTopUp: vi.fn(),
  };

  return render(
    <BrowserRouter>
      <OutOfCreditsModal {...defaultProps} {...props} />
    </BrowserRouter>
  );
};

describe('OutOfCreditsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Progress Bar Visualization', () => {
    it('should show credits progress bar', () => {
      renderModal();

      const progressBar = screen.getByTestId('credits-progress');
      expect(progressBar).toBeInTheDocument();
    });

    it('should display required vs available credits', () => {
      renderModal();

      // Check for balance display
      expect(screen.getByText(/25 \/ 100/)).toBeInTheDocument();
    });

    it('should show how many more credits are needed', () => {
      renderModal();

      expect(screen.getByText(/Need 75 more credits/)).toBeInTheDocument();
    });

    it('should show percentage available', () => {
      renderModal();

      expect(screen.getByText(/25% available/)).toBeInTheDocument();
    });
  });

  describe('Quick Purchase Buttons', () => {
    it('should display 5K credits quick purchase button', () => {
      renderModal();

      const button = screen.getByTestId('quick-purchase-starter-pack');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('5K Credits')).toBeInTheDocument();
    });

    it('should display 15K credits quick purchase button', () => {
      renderModal();

      const button = screen.getByTestId('quick-purchase-growth-pack');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('15K Credits')).toBeInTheDocument();
    });

    it('should call onQuickPurchase with correct package id when clicking 5K button', () => {
      const onQuickPurchase = vi.fn();
      const onOpenChange = vi.fn();
      renderModal({ onQuickPurchase, onOpenChange });

      const button = screen.getByTestId('quick-purchase-starter-pack');
      fireEvent.click(button);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onQuickPurchase).toHaveBeenCalledWith('starter-pack');
    });

    it('should call onQuickPurchase with correct package id when clicking 15K button', () => {
      const onQuickPurchase = vi.fn();
      const onOpenChange = vi.fn();
      renderModal({ onQuickPurchase, onOpenChange });

      const button = screen.getByTestId('quick-purchase-growth-pack');
      fireEvent.click(button);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onQuickPurchase).toHaveBeenCalledWith('growth-pack');
    });
  });

  describe('All Packages Link', () => {
    it('should display view all packages link', () => {
      renderModal();

      const link = screen.getByTestId('view-all-packages');
      expect(link).toBeInTheDocument();
      expect(screen.getByText('View all packages')).toBeInTheDocument();
    });

    it('should navigate to billing page when clicking view all packages', () => {
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      const link = screen.getByTestId('view-all-packages');
      fireEvent.click(link);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/billing?tab=credits');
    });
  });

  describe('Auto Top-Up Suggestion', () => {
    it('should display auto top-up setup suggestion', () => {
      renderModal();

      expect(screen.getByText('Never run out again')).toBeInTheDocument();
      expect(screen.getByText(/Set up auto top-up/)).toBeInTheDocument();
    });

    it('should display auto top-up description', () => {
      renderModal();

      expect(
        screen.getByText(/automatically purchase credits when your balance is low/)
      ).toBeInTheDocument();
    });

    it('should call onSetupAutoTopUp when clicking setup link', () => {
      const onSetupAutoTopUp = vi.fn();
      const onOpenChange = vi.fn();
      renderModal({ onSetupAutoTopUp, onOpenChange });

      const link = screen.getByTestId('setup-auto-top-up');
      fireEvent.click(link);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSetupAutoTopUp).toHaveBeenCalled();
    });

    it('should navigate to billing page if no onSetupAutoTopUp provided', () => {
      const onOpenChange = vi.fn();
      renderModal({ onSetupAutoTopUp: undefined, onOpenChange });

      const link = screen.getByTestId('setup-auto-top-up');
      fireEvent.click(link);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/billing?tab=auto-top-up');
    });
  });

  describe('Action Cost Display', () => {
    it('should display action cost when actionAttempted is provided', () => {
      renderModal({ actionAttempted: 'menu_create' });

      expect(screen.getByText('Action Cost')).toBeInTheDocument();
      expect(screen.getByText('100 credits')).toBeInTheDocument();
    });

    it('should display current balance', () => {
      renderModal();

      expect(screen.getByText('Your Balance')).toBeInTheDocument();
      expect(screen.getByText('25 credits')).toBeInTheDocument();
    });
  });

  describe('Modal State', () => {
    it('should not render when closed', () => {
      renderModal({ open: false });

      expect(screen.queryByText("You're Out of Credits")).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      renderModal({ open: true });

      expect(screen.getByText("You're Out of Credits")).toBeInTheDocument();
    });
  });
});

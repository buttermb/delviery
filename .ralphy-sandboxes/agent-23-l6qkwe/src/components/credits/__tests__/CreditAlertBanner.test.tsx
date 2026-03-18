/**
 * CreditAlertBanner Tests
 *
 * Verifies:
 * - Shows at 2000, 1000, 500, 100 credits
 * - Dismissible but returns on balance change
 * - Buy credits button
 * - Different severity colors based on threshold
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreditAlertBanner } from '../CreditAlertBanner';
import { useCreditAlert } from '@/hooks/useCreditAlert';
import { renderHook } from '@testing-library/react';

// Create a mock for useCredits that can be updated
let mockBalance = 1500;
let mockIsFreeTier = true;
let mockIsLoading = false;

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: mockIsLoading,
  }),
}));

vi.mock('@/lib/credits', () => ({
  LOW_BALANCE_WARNING_LEVELS: [2000, 1000, 500, 100],
}));

const renderBanner = (props = {}) => {
  const defaultProps = {
    onBuyCredits: vi.fn(),
  };

  return render(<CreditAlertBanner {...defaultProps} {...props} />);
};

describe('CreditAlertBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default values
    mockBalance = 1500;
    mockIsFreeTier = true;
    mockIsLoading = false;
  });

  describe('Threshold Display', () => {
    it('should show banner at 2000 credits threshold', () => {
      mockBalance = 2000;
      renderBanner();

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('data-threshold', '2000');
    });

    it('should show banner at 1000 credits threshold', () => {
      mockBalance = 1000;
      renderBanner();

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('data-threshold', '1000');
    });

    it('should show banner at 500 credits threshold', () => {
      mockBalance = 500;
      renderBanner();

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('data-threshold', '500');
    });

    it('should show banner at 100 credits threshold', () => {
      mockBalance = 100;
      renderBanner();

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('data-threshold', '100');
    });

    it('should not show banner when balance is above 2000', () => {
      mockBalance = 2500;
      renderBanner();

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });

    it('should not show banner when balance is 0 (OutOfCreditsModal handles this)', () => {
      mockBalance = 0;
      renderBanner();

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });

    it('should not show banner when not on free tier', () => {
      mockBalance = 500;
      mockIsFreeTier = false;
      renderBanner();

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });

    it('should not show banner when loading', () => {
      mockBalance = 500;
      mockIsLoading = true;
      renderBanner();

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });
  });

  describe('Severity Colors', () => {
    it('should show info severity at 2000 threshold', () => {
      mockBalance = 2000;
      renderBanner();

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toHaveAttribute('data-severity', 'info');
    });

    it('should show warning severity at 1000 threshold', () => {
      mockBalance = 1000;
      renderBanner();

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toHaveAttribute('data-severity', 'warning');
    });

    it('should show critical severity at 500 threshold', () => {
      mockBalance = 500;
      renderBanner();

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toHaveAttribute('data-severity', 'critical');
    });

    it('should show danger severity at 100 threshold', () => {
      mockBalance = 100;
      renderBanner();

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toHaveAttribute('data-severity', 'danger');
    });
  });

  describe('Warning Messages', () => {
    it('should show appropriate title at 2000 threshold', () => {
      mockBalance = 2000;
      renderBanner();

      expect(screen.getByText('Credits Running Low')).toBeInTheDocument();
    });

    it('should show appropriate title at 1000 threshold', () => {
      mockBalance = 1000;
      renderBanner();

      expect(screen.getByText('Credit Balance Warning')).toBeInTheDocument();
    });

    it('should show appropriate title at 500 threshold', () => {
      mockBalance = 500;
      renderBanner();

      expect(screen.getByText('Low Credit Balance')).toBeInTheDocument();
    });

    it('should show appropriate title at 100 threshold', () => {
      mockBalance = 100;
      renderBanner();

      expect(screen.getByText('Critical Credit Balance')).toBeInTheDocument();
    });

    it('should display current balance in the banner', () => {
      mockBalance = 750;
      renderBanner();

      expect(screen.getByText('(750 credits)')).toBeInTheDocument();
    });
  });

  describe('Buy Credits Button', () => {
    it('should display buy credits button', () => {
      mockBalance = 1000;
      renderBanner();

      const button = screen.getByTestId('banner-buy-credits');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Buy Credits');
    });

    it('should call onBuyCredits when button is clicked', () => {
      mockBalance = 1000;
      const onBuyCredits = vi.fn();
      renderBanner({ onBuyCredits });

      const button = screen.getByTestId('banner-buy-credits');
      fireEvent.click(button);

      expect(onBuyCredits).toHaveBeenCalled();
    });
  });

  describe('Dismiss Functionality', () => {
    it('should display dismiss button', () => {
      mockBalance = 1000;
      renderBanner();

      const button = screen.getByTestId('banner-dismiss');
      expect(button).toBeInTheDocument();
    });

    it('should hide banner when dismissed', () => {
      mockBalance = 1000;
      const { rerender } = renderBanner();

      // Banner should be visible initially
      expect(screen.getByTestId('credit-alert-banner')).toBeInTheDocument();

      // Click dismiss
      fireEvent.click(screen.getByTestId('banner-dismiss'));

      // Force a rerender to see the state change
      rerender(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      // Banner should be hidden
      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });
  });
});

describe('useCreditAlert hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBalance = 1500;
    mockIsFreeTier = true;
    mockIsLoading = false;
  });

  it('should return shouldShowAlert true when below threshold', () => {
    mockBalance = 1500;
    const { result } = renderHook(() => useCreditAlert());

    expect(result.current.shouldShowAlert).toBe(true);
    expect(result.current.balance).toBe(1500);
    expect(result.current.isFreeTier).toBe(true);
  });

  it('should return shouldShowAlert false when above all thresholds', () => {
    mockBalance = 3000;
    const { result } = renderHook(() => useCreditAlert());

    expect(result.current.shouldShowAlert).toBe(false);
  });

  it('should return shouldShowAlert false when not on free tier', () => {
    mockBalance = 500;
    mockIsFreeTier = false;
    const { result } = renderHook(() => useCreditAlert());

    expect(result.current.shouldShowAlert).toBe(false);
  });

  it('should return correct threshold info', () => {
    mockBalance = 800;
    const { result } = renderHook(() => useCreditAlert());

    expect(result.current.shouldShowAlert).toBe(true);
    expect(result.current.currentThreshold?.threshold).toBe(1000);
    expect(result.current.currentThreshold?.severity).toBe('warning');
  });
});

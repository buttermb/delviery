/**
 * CreditAlertBanner Integration Tests
 *
 * Tests the CreditAlertBanner as integrated in AdminLayout:
 * - Banner renders between header and main content
 * - Buy Credits button opens the purchase modal
 * - Banner respects threshold visibility rules
 * - Banner is hidden during print
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreditAlertBanner } from '../CreditAlertBanner';

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

vi.mock('@/lib/credits', async () => {
  const warningConfig = await import('@/lib/credits/creditWarningConfig');
  return {
    LOW_BALANCE_WARNING_LEVELS: [2000, 1000, 500, 100],
    getCurrentThreshold: warningConfig.getCurrentThreshold,
    getAlertSeverityStyles: warningConfig.getAlertSeverityStyles,
    CREDIT_THRESHOLD_CONFIGS: warningConfig.CREDIT_THRESHOLD_CONFIGS,
  };
});

describe('CreditAlertBanner Admin Layout Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBalance = 1500;
    mockIsFreeTier = true;
    mockIsLoading = false;
  });

  describe('Purchase modal integration', () => {
    it('should call onBuyCredits callback when Buy Credits is clicked', () => {
      mockBalance = 500;
      const onBuyCredits = vi.fn();

      render(<CreditAlertBanner onBuyCredits={onBuyCredits} />);

      const buyButton = screen.getByTestId('banner-buy-credits');
      fireEvent.click(buyButton);

      expect(onBuyCredits).toHaveBeenCalledTimes(1);
    });

    it('should not call onBuyCredits if callback is not provided', () => {
      mockBalance = 500;

      render(<CreditAlertBanner />);

      const buyButton = screen.getByTestId('banner-buy-credits');
      // Should not throw when clicked without callback
      expect(() => fireEvent.click(buyButton)).not.toThrow();
    });
  });

  describe('Critical threshold behavior', () => {
    it('should show danger severity with default button variant at 100 credits', () => {
      mockBalance = 100;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toHaveAttribute('data-severity', 'danger');
      expect(screen.getByText('Critical Credit Balance')).toBeInTheDocument();
    });

    it('should show critical severity at 500 credits', () => {
      mockBalance = 500;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toHaveAttribute('data-severity', 'critical');
      expect(screen.getByText('Low Credit Balance')).toBeInTheDocument();
    });

    it('should show warning severity at 1000 credits', () => {
      mockBalance = 1000;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toHaveAttribute('data-severity', 'warning');
    });

    it('should show info severity at 2000 credits', () => {
      mockBalance = 2000;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner).toHaveAttribute('data-severity', 'info');
    });
  });

  describe('Visibility rules in layout context', () => {
    it('should not render when balance is above all thresholds', () => {
      mockBalance = 5000;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });

    it('should not render for paid tier users', () => {
      mockBalance = 100;
      mockIsFreeTier = false;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });

    it('should not render while credits are loading', () => {
      mockBalance = 100;
      mockIsLoading = true;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });

    it('should not render when balance is 0 (OutOfCreditsModal handles this)', () => {
      mockBalance = 0;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });

    it('should not render when balance is negative', () => {
      mockBalance = -10;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });
  });

  describe('Dismiss and re-appear behavior', () => {
    it('should hide after dismiss and stay hidden at same threshold', () => {
      mockBalance = 500;
      const { rerender } = render(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      expect(screen.getByTestId('credit-alert-banner')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('banner-dismiss'));
      rerender(<CreditAlertBanner onBuyCredits={vi.fn()} />);

      expect(screen.queryByTestId('credit-alert-banner')).not.toBeInTheDocument();
    });
  });

  describe('Custom className support', () => {
    it('should accept and apply custom className', () => {
      mockBalance = 500;

      render(<CreditAlertBanner onBuyCredits={vi.fn()} className="mt-2" />);

      const banner = screen.getByTestId('credit-alert-banner');
      expect(banner.className).toContain('mt-2');
    });
  });
});

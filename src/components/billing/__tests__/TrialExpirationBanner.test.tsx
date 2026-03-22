/**
 * TrialExpirationBanner Tests
 *
 * Verifies:
 * - Correct messages for 0, 1, ≤3, and ≤7 days remaining
 * - Hidden when payment method exists, dismissed, or > 7 days
 * - Persistent dismissal via localStorage
 * - "Add Payment Method" navigates to billing
 * - Destructive variant when ≤1 day
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrialExpirationBanner } from '../TrialExpirationBanner';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123', slug: 'test-tenant' },
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const defaultProps = {
  daysRemaining: 5,
  hasPaymentMethod: false,
  trialEndsAt: '2026-03-26T00:00:00Z',
};

const renderBanner = (props: Partial<React.ComponentProps<typeof TrialExpirationBanner>> = {}) =>
  render(<TrialExpirationBanner {...defaultProps} {...props} />);

describe('TrialExpirationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('Days Remaining Messages', () => {
    it('should show "trial has ended" when daysRemaining is 0', () => {
      renderBanner({ daysRemaining: 0 });

      expect(screen.getByText(/Your trial has ended/)).toBeInTheDocument();
      expect(
        screen.getByText(/Add a payment method to keep your current plan/)
      ).toBeInTheDocument();
    });

    it('should show "ends tomorrow" when daysRemaining is 1', () => {
      renderBanner({ daysRemaining: 1 });

      expect(screen.getByText(/Your trial ends tomorrow/)).toBeInTheDocument();
      expect(
        screen.getByText(/Add a payment method today to keep your current plan/)
      ).toBeInTheDocument();
    });

    it('should show urgent message when daysRemaining is 2-3', () => {
      renderBanner({ daysRemaining: 3 });

      expect(screen.getByText(/Your trial ends in 3 days/)).toBeInTheDocument();
      expect(
        screen.getByText(/Action required: Add a payment method/)
      ).toBeInTheDocument();
    });

    it('should show standard message when daysRemaining is 4-7', () => {
      renderBanner({ daysRemaining: 6 });

      expect(screen.getByText(/Your trial ends in 6 days/)).toBeInTheDocument();
      expect(
        screen.getByText(/Add a payment method to ensure a smooth transition/)
      ).toBeInTheDocument();
    });
  });

  describe('Visibility', () => {
    it('should not render when hasPaymentMethod is true', () => {
      renderBanner({ hasPaymentMethod: true });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should not render when daysRemaining is > 7', () => {
      renderBanner({ daysRemaining: 8 });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should not render when previously dismissed via localStorage', () => {
      localStorageMock.getItem.mockReturnValueOnce('true');

      renderBanner();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should render when within 7 days and no payment method', () => {
      renderBanner({ daysRemaining: 5, hasPaymentMethod: false });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Dismiss Functionality', () => {
    it('should hide banner when dismiss button is clicked', () => {
      renderBanner();

      expect(screen.getByRole('alert')).toBeInTheDocument();

      const dismissButton = screen.getByLabelText('Dismiss');
      fireEvent.click(dismissButton);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should persist dismissal to localStorage', () => {
      renderBanner();

      const dismissButton = screen.getByLabelText('Dismiss');
      fireEvent.click(dismissButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'trial_banner_dismissed_tenant-123',
        'true'
      );
    });
  });

  describe('Alert Variants', () => {
    it('should use destructive variant when daysRemaining is 0', () => {
      renderBanner({ daysRemaining: 0 });

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('text-destructive');
    });

    it('should use destructive variant when daysRemaining is 1', () => {
      renderBanner({ daysRemaining: 1 });

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('text-destructive');
    });

    it('should use default variant when daysRemaining is > 1', () => {
      renderBanner({ daysRemaining: 5 });

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('text-foreground');
      expect(alert.className).not.toContain('text-destructive');
    });
  });

  describe('Navigation', () => {
    it('should navigate to billing page when "Add Payment Method" is clicked', () => {
      renderBanner();

      const button = screen.getByRole('button', { name: /add payment method/i });
      fireEvent.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/billing');
    });
  });
});

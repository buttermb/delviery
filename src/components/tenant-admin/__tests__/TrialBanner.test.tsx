/**
 * TrialBanner Tests
 *
 * Verifies:
 * - Correct "days remaining" message for 0, 1, and N days
 * - Destructive variant when ≤1 day remains
 * - Default variant for >1 day
 * - Hidden when dismissed, expired (negative days), or no trial date
 * - "Manage Subscription" links to correct billing route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TrialBanner } from '../TrialBanner';

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
}));

const renderBanner = (props: Partial<React.ComponentProps<typeof TrialBanner>> = {}) => {
  const defaultProps = {
    daysRemaining: 5,
    trialEndsAt: '2026-03-26T00:00:00Z',
    tenantSlug: 'test-tenant',
  };

  return render(
    <MemoryRouter>
      <TrialBanner {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('TrialBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Days Remaining Messages', () => {
    it('should show "ends today" message when daysRemaining is 0', () => {
      renderBanner({ daysRemaining: 0, trialEndsAt: '2026-03-21T00:00:00Z' });

      expect(
        screen.getByText('Your trial ends today! Your subscription will activate automatically.')
      ).toBeInTheDocument();
    });

    it('should show "ends tomorrow" message when daysRemaining is 1', () => {
      renderBanner({ daysRemaining: 1, trialEndsAt: '2026-03-22T00:00:00Z' });

      expect(
        screen.getByText('Your trial ends tomorrow. Your card will be charged automatically.')
      ).toBeInTheDocument();
    });

    it('should show "ends in N days" message when daysRemaining is > 1', () => {
      renderBanner({ daysRemaining: 5, trialEndsAt: '2026-03-26T00:00:00Z' });

      expect(screen.getByText(/Your trial ends in 5 days/)).toBeInTheDocument();
      expect(screen.getByText(/Your card will be charged on/)).toBeInTheDocument();
    });

    it('should show correct day count for various values', () => {
      const { unmount } = renderBanner({ daysRemaining: 14, trialEndsAt: '2026-04-04T00:00:00Z' });
      expect(screen.getByText(/Your trial ends in 14 days/)).toBeInTheDocument();
      unmount();

      renderBanner({ daysRemaining: 3, trialEndsAt: '2026-03-24T00:00:00Z' });
      expect(screen.getByText(/Your trial ends in 3 days/)).toBeInTheDocument();
    });
  });

  describe('Alert Variants', () => {
    it('should use destructive variant when daysRemaining is 0', () => {
      renderBanner({ daysRemaining: 0, trialEndsAt: '2026-03-21T00:00:00Z' });

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border-destructive');
      expect(alert.className).toContain('text-destructive');
    });

    it('should use destructive variant when daysRemaining is 1', () => {
      renderBanner({ daysRemaining: 1, trialEndsAt: '2026-03-22T00:00:00Z' });

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border-destructive');
      expect(alert.className).toContain('text-destructive');
    });

    it('should use default variant when daysRemaining is > 1', () => {
      renderBanner({ daysRemaining: 5, trialEndsAt: '2026-03-26T00:00:00Z' });

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('text-foreground');
      expect(alert.className).not.toContain('text-destructive');
    });
  });

  describe('Visibility', () => {
    it('should not render when dismissed', async () => {
      const user = userEvent.setup();
      const { container } = renderBanner({ daysRemaining: 5 });

      const dismissButton = container.querySelector('button:last-child');
      expect(dismissButton).toBeTruthy();
      await user.click(dismissButton!);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should not render when daysRemaining is negative (expired)', () => {
      renderBanner({ daysRemaining: -1, trialEndsAt: '2026-03-20T00:00:00Z' });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should not render when trialEndsAt is null', () => {
      renderBanner({ trialEndsAt: null });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should render when daysRemaining is 0 and trialEndsAt is set', () => {
      renderBanner({ daysRemaining: 0, trialEndsAt: '2026-03-21T00:00:00Z' });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should link to billing page with correct tenant slug', () => {
      renderBanner({ tenantSlug: 'my-dispensary' });

      const link = screen.getByRole('link', { name: /manage subscription/i });
      expect(link).toHaveAttribute('href', '/my-dispensary/admin/settings?tab=billing');
    });

    it('includes tenant slug in the billing link', () => {
      renderBanner({ tenantSlug: 'green-leaf' });
      const link = screen.getByRole('link', { name: /manage subscription/i });
      expect(link).toHaveAttribute('href', '/green-leaf/admin/settings?tab=billing');
    });
  });
});

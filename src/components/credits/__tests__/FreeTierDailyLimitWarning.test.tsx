/**
 * FreeTierDailyLimitWarning Tests
 *
 * Verifies:
 * - Shows daily usage counters for free tier tenants
 * - Hides when not free tier or no usage
 * - Highlights limits that are reached
 * - Shows upgrade CTA when any limit is reached
 * - Dismissible
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FreeTierDailyLimitWarning } from '../FreeTierDailyLimitWarning';
import type { FreeTierUsage } from '@/hooks/useFreeTierLimits';

// ============================================================================
// Mocks
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let mockUsage: FreeTierUsage | null = null;
let mockLimitsApply = true;
let mockIsLoading = false;

const mockLimits = {
  max_menus_per_day: 1,
  max_orders_per_day: 3,
  max_sms_per_day: 2,
  max_emails_per_day: 5,
  max_pos_sales_per_day: 5,
  max_bulk_operations_per_day: 1,
  max_exports_per_month: 999999,
  max_invoices_per_month: 3,
  max_custom_reports_per_month: 0,
  max_ai_features_per_month: 0,
  max_products: 25,
  max_customers: 50,
  max_team_members: 1,
  max_locations: 1,
  blocked_features: [] as readonly string[],
};

vi.mock('@/hooks/useFreeTierLimits', () => ({
  useFreeTierLimits: () => ({
    usage: mockUsage,
    isLoading: mockIsLoading,
    limitsApply: mockLimitsApply,
    limits: mockLimits,
    isFreeTier: mockLimitsApply,
    checkLimit: vi.fn(),
    isFeatureBlocked: vi.fn(),
    recordAction: vi.fn(),
    allLimits: {},
    hasPurchasedCredits: false,
    hasActiveCredits: false,
    creditBalance: 0,
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123', slug: 'test-tenant' },
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

const defaultUsage: FreeTierUsage = {
  menusCreatedToday: 0,
  ordersCreatedToday: 1,
  smsSentToday: 0,
  emailsSentToday: 2,
  posSalesToday: 0,
  bulkOperationsToday: 0,
  exportsThisMonth: 0,
  invoicesThisMonth: 0,
  customReportsThisMonth: 0,
  aiFeaturesThisMonth: 0,
  totalProducts: 5,
  totalCustomers: 10,
  totalTeamMembers: 1,
  totalLocations: 1,
  lastDailyReset: null,
  lastMonthlyReset: null,
};

// ============================================================================
// Tests
// ============================================================================

describe('FreeTierDailyLimitWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsage = { ...defaultUsage };
    mockLimitsApply = true;
    mockIsLoading = false;
  });

  describe('Visibility', () => {
    it('shows when free tier with usage', () => {
      render(<FreeTierDailyLimitWarning />);
      expect(screen.getByTestId('free-tier-daily-limit-warning')).toBeInTheDocument();
    });

    it('hides when not free tier', () => {
      mockLimitsApply = false;
      render(<FreeTierDailyLimitWarning />);
      expect(screen.queryByTestId('free-tier-daily-limit-warning')).not.toBeInTheDocument();
    });

    it('hides when loading', () => {
      mockIsLoading = true;
      render(<FreeTierDailyLimitWarning />);
      expect(screen.queryByTestId('free-tier-daily-limit-warning')).not.toBeInTheDocument();
    });

    it('hides when no usage data', () => {
      mockUsage = null;
      render(<FreeTierDailyLimitWarning />);
      expect(screen.queryByTestId('free-tier-daily-limit-warning')).not.toBeInTheDocument();
    });

    it('hides when no daily usage at all', () => {
      mockUsage = {
        ...defaultUsage,
        ordersCreatedToday: 0,
        emailsSentToday: 0,
      };
      render(<FreeTierDailyLimitWarning />);
      expect(screen.queryByTestId('free-tier-daily-limit-warning')).not.toBeInTheDocument();
    });
  });

  describe('Daily Usage Counters', () => {
    it('displays correct usage counts', () => {
      mockUsage = {
        ...defaultUsage,
        menusCreatedToday: 1,
        ordersCreatedToday: 2,
        smsSentToday: 1,
        emailsSentToday: 3,
        posSalesToday: 4,
      };
      render(<FreeTierDailyLimitWarning />);

      expect(screen.getByTestId('daily-limit-menus')).toHaveTextContent('1/1 menus');
      expect(screen.getByTestId('daily-limit-orders')).toHaveTextContent('2/3 orders');
      expect(screen.getByTestId('daily-limit-sms')).toHaveTextContent('1/2 SMS');
      expect(screen.getByTestId('daily-limit-emails')).toHaveTextContent('3/5 emails');
      expect(screen.getByTestId('daily-limit-pos')).toHaveTextContent('4/5 POS sales');
    });

    it('shows "Today:" label', () => {
      render(<FreeTierDailyLimitWarning />);
      expect(screen.getByText('Today:')).toBeInTheDocument();
    });
  });

  describe('Limit Reached Behavior', () => {
    it('shows upgrade button when any limit is reached', () => {
      mockUsage = {
        ...defaultUsage,
        menusCreatedToday: 1, // 1/1 = reached
      };
      render(<FreeTierDailyLimitWarning />);

      expect(screen.getByTestId('daily-limit-upgrade')).toBeInTheDocument();
      expect(screen.getByTestId('daily-limit-upgrade')).toHaveTextContent('Upgrade');
    });

    it('does not show upgrade button when no limit is reached', () => {
      mockUsage = {
        ...defaultUsage,
        ordersCreatedToday: 1, // 1/3 = not reached
        emailsSentToday: 2,   // 2/5 = not reached
      };
      render(<FreeTierDailyLimitWarning />);

      expect(screen.queryByTestId('daily-limit-upgrade')).not.toBeInTheDocument();
    });

    it('navigates to settings on upgrade click', () => {
      mockUsage = {
        ...defaultUsage,
        menusCreatedToday: 1,
      };
      render(<FreeTierDailyLimitWarning />);

      fireEvent.click(screen.getByTestId('daily-limit-upgrade'));
      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/settings?tab=payments');
    });
  });

  describe('Dismiss Functionality', () => {
    it('hides when dismissed', () => {
      render(<FreeTierDailyLimitWarning />);
      expect(screen.getByTestId('free-tier-daily-limit-warning')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('daily-limit-dismiss'));

      expect(screen.queryByTestId('free-tier-daily-limit-warning')).not.toBeInTheDocument();
    });
  });
});

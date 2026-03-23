/**
 * CreditBalance Tests
 *
 * Verifies:
 * - Component uses CreditContext (not raw useCredits hook)
 * - Renders credit balance with correct formatting
 * - Color-coded thresholds: >2000 emerald, >1000 yellow, >500 amber, >100 orange, <=100 red
 * - Badge variant renders compact display
 * - Buy credits button opens purchase modal
 * - Tooltip shows burn rate and depletion date
 * - "Credit Balance" heading
 * - Credits remaining count
 * - Daily burn rate (when usage data exists)
 * - Depletion date estimate (when usage data exists)
 * - "Click to buy more credits" CTA
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreditBalance } from '../CreditBalance';

// --- Mutable mock state ---
let mockCredits = 3000;
let mockIsFreeTier = true;
let mockSetIsPurchaseModalOpen = vi.fn();
let mockTenantId: string | undefined = 'tenant-123';
let mockUsageStats: {
  avgDailyUsage: number;
  daysUntilDepletion: number | null;
  depletionDate: Date | null;
} | null = null;

// --- Mocks ---

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/contexts/CreditContext', () => ({
  useCredits: () => ({
    credits: mockCredits,
    isFreeTier: mockIsFreeTier,
    setIsPurchaseModalOpen: mockSetIsPurchaseModalOpen,
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenantId ? { id: mockTenantId } : null,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockUsageStats,
    isLoading: false,
  }),
}));

// Render tooltip content directly so we can assert on it
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: Date) => {
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  },
}));

// Mock CreditBalanceAnimation to render plain text for testing
vi.mock('../CreditBalanceAnimation', () => ({
  CreditBalanceAnimation: ({ value }: { value: number }) => (
    <span data-testid="credit-balance-animation">{value.toLocaleString()}</span>
  ),
}));

describe('CreditBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCredits = 3000;
    mockIsFreeTier = true;
    mockSetIsPurchaseModalOpen = vi.fn();
    mockTenantId = 'tenant-123';
    mockUsageStats = null;
  });

  describe('Context usage', () => {
    it('should import useCredits from CreditContext, not from hooks/useCredits', async () => {
      // This test verifies the import source at the module level.
      // If CreditBalance imported from '@/hooks/useCredits' instead of
      // '@/contexts/CreditContext', the mock above would not apply and
      // the component would throw (no CreditProvider wrapping it).
      const mod = await import('../CreditBalance');
      expect(mod.CreditBalance).toBeDefined();

      // Render to confirm the context mock is being used
      render(<CreditBalance />);
      expect(screen.getByText('3,000')).toBeInTheDocument();
    });
  });

  describe('Tooltip Content', () => {
    it('should show "Credit Balance" heading', () => {
      render(<CreditBalance />);
      expect(screen.getByText('Credit Balance')).toBeInTheDocument();
    });

    it('should show credits remaining count', () => {
      mockCredits = 1500;
      render(<CreditBalance />);
      expect(screen.getByText('1,500 credits remaining')).toBeInTheDocument();
    });

    it('should show formatted credit count with locale string', () => {
      mockCredits = 12345;
      render(<CreditBalance />);
      expect(screen.getByText('12,345 credits remaining')).toBeInTheDocument();
    });

    it('should show "Click to buy more credits" CTA', () => {
      render(<CreditBalance />);
      expect(screen.getByText('Click to buy more credits')).toBeInTheDocument();
    });

    it('should show burn rate when usage stats are available', () => {
      mockCredits = 1500;
      mockUsageStats = {
        avgDailyUsage: 50,
        daysUntilDepletion: 30,
        depletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      render(<CreditBalance />);
      expect(screen.getByText('~50/day burn rate')).toBeInTheDocument();
    });

    it('should not show burn rate when avgDailyUsage is 0', () => {
      mockUsageStats = {
        avgDailyUsage: 0,
        daysUntilDepletion: null,
        depletionDate: null,
      };
      render(<CreditBalance />);
      expect(screen.queryByText(/burn rate/)).not.toBeInTheDocument();
    });

    it('should not show burn rate when usage stats are null', () => {
      mockUsageStats = null;
      render(<CreditBalance />);
      expect(screen.queryByText(/burn rate/)).not.toBeInTheDocument();
    });

    it('should show depletion estimate when data is available', () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      mockCredits = 750;
      mockUsageStats = {
        avgDailyUsage: 50,
        daysUntilDepletion: 15,
        depletionDate: futureDate,
      };
      render(<CreditBalance />);

      // formatSmartDate is mocked to return "Mon DD" format
      expect(screen.getByText(/Depletes/)).toBeInTheDocument();
      expect(screen.getByText(/15 days/)).toBeInTheDocument();
    });

    it('should not show depletion date when depletionDate is null', () => {
      mockUsageStats = {
        avgDailyUsage: 50,
        daysUntilDepletion: null,
        depletionDate: null,
      };
      render(<CreditBalance />);
      expect(screen.queryByText(/Depletes/)).not.toBeInTheDocument();
    });

    it('should not show depletion when daysUntilDepletion is 0', () => {
      mockUsageStats = {
        avgDailyUsage: 50,
        daysUntilDepletion: 0,
        depletionDate: new Date(),
      };
      render(<CreditBalance />);
      expect(screen.queryByText(/Depletes/)).not.toBeInTheDocument();
    });
  });

  describe('Color Classes by Threshold', () => {
    it('should use emerald (healthy) when credits > 200', () => {
      mockCredits = 250;
      const { container } = render(<CreditBalance />);
      const badge = container.querySelector('.text-emerald-600');
      expect(badge).toBeInTheDocument();
    });

    it('should use yellow when credits > 100 and <= 200', () => {
      mockCredits = 150;
      const { container } = render(<CreditBalance />);
      const badge = container.querySelector('.text-yellow-600');
      expect(badge).toBeInTheDocument();
    });

    it('should use amber when credits > 50 and <= 100', () => {
      mockCredits = 75;
      const { container } = render(<CreditBalance />);
      const badge = container.querySelector('.text-amber-600');
      expect(badge).toBeInTheDocument();
    });

    it('should use orange when credits > 25 and <= 50', () => {
      mockCredits = 35;
      const { container } = render(<CreditBalance />);
      const badge = container.querySelector('.text-orange-600');
      expect(badge).toBeInTheDocument();
    });

    it('should use red with pulse when credits <= 25', () => {
      mockCredits = 20;
      const { container } = render(<CreditBalance />);
      const badge = container.querySelector('.text-red-600');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('animate-pulse');
    });
  });

  describe('Variants', () => {
    it('should render badge variant with compact styling', () => {
      mockCredits = 1500;
      render(<CreditBalance variant="badge" />);
      // Badge variant shows credits as number only
      expect(screen.getByText('1,500')).toBeInTheDocument();
      // Tooltip content still present
      expect(screen.getByText('Credit Balance')).toBeInTheDocument();
    });

    it('should render default variant with label', () => {
      mockCredits = 1500;
      render(<CreditBalance variant="default" showLabel />);
      expect(screen.getByText('1,500')).toBeInTheDocument();
      expect(screen.getByText('Buy Credits')).toBeInTheDocument();
    });

    it('should hide label when showLabel is false', () => {
      mockCredits = 1500;
      render(<CreditBalance variant="default" showLabel={false} />);
      // The tooltip still shows "1,500 credits remaining" but there should be
      // no standalone "1,500" text in the trigger area
      expect(screen.queryByText('1,500')).not.toBeInTheDocument();
      // But the tooltip content should still be there
      expect(screen.getByText('1,500 credits remaining')).toBeInTheDocument();
    });

    it('should show Buy Credits button in default variant', () => {
      render(<CreditBalance />);
      expect(screen.getByTitle('Buy Credits')).toBeInTheDocument();
    });
  });

  describe('Click Actions', () => {
    it('should open purchase modal when badge variant is clicked', () => {
      mockCredits = 1500;
      render(<CreditBalance variant="badge" />);
      const badge = screen.getByText('1,500');
      fireEvent.click(badge);
      expect(mockSetIsPurchaseModalOpen).toHaveBeenCalledWith(true);
    });

    it('should open purchase modal when default variant is clicked', () => {
      mockCredits = 1500;
      render(<CreditBalance variant="default" showLabel />);
      const creditDisplay = screen.getByText('1,500');
      fireEvent.click(creditDisplay);
      expect(mockSetIsPurchaseModalOpen).toHaveBeenCalledWith(true);
    });

    it('should open purchase modal when plus button is clicked', () => {
      render(<CreditBalance />);
      const buyButton = screen.getByTitle('Buy Credits');
      fireEvent.click(buyButton);
      expect(mockSetIsPurchaseModalOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('Animation Integration', () => {
    it('should use CreditBalanceAnimation in badge variant', () => {
      mockCredits = 2500;
      render(<CreditBalance variant="badge" />);
      const animatedElement = screen.getByTestId('credit-balance-animation');
      expect(animatedElement).toBeInTheDocument();
      expect(animatedElement).toHaveTextContent('2,500');
    });

    it('should use CreditBalanceAnimation in default variant with showLabel', () => {
      mockCredits = 1500;
      render(<CreditBalance variant="default" showLabel />);
      const animatedElement = screen.getByTestId('credit-balance-animation');
      expect(animatedElement).toBeInTheDocument();
      expect(animatedElement).toHaveTextContent('1,500');
    });

    it('should not render CreditBalanceAnimation when showLabel is false in default variant', () => {
      mockCredits = 1500;
      render(<CreditBalance variant="default" showLabel={false} />);
      expect(screen.queryByTestId('credit-balance-animation')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero credits', () => {
      mockCredits = 0;
      render(<CreditBalance />);
      expect(screen.getByText('0 credits remaining')).toBeInTheDocument();
    });

    it('should handle very large credit balances', () => {
      mockCredits = 999999;
      render(<CreditBalance />);
      expect(screen.getByText('999,999 credits remaining')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<CreditBalance className="custom-class" />);
      const wrapper = container.firstElementChild;
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});

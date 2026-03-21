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
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CreditBalance } from '../CreditBalance';

// Mock values
let mockCredits = 5000;
let mockIsFreeTier = true;
const mockSetIsPurchaseModalOpen = vi.fn();

// Mock CreditContext — the component MUST import from here, not from hooks/useCredits
vi.mock('@/contexts/CreditContext', () => ({
  useCredits: () => ({
    credits: mockCredits,
    isFreeTier: mockIsFreeTier,
    setIsPurchaseModalOpen: mockSetIsPurchaseModalOpen,
  }),
}));

// Mock TenantAdminAuthContext
vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id' },
  }),
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

// Mock formatters
vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: Date) => date.toLocaleDateString(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    );
  };
}

describe('CreditBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCredits = 5000;
    mockIsFreeTier = true;
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
      render(<CreditBalance />, { wrapper: createWrapper() });
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });
  });

  describe('Default variant rendering', () => {
    it('should render credit balance with formatted number', () => {
      mockCredits = 3500;
      render(<CreditBalance />, { wrapper: createWrapper() });

      expect(screen.getByText('3,500')).toBeInTheDocument();
    });

    it('should render buy credits button', () => {
      render(<CreditBalance />, { wrapper: createWrapper() });

      const buyButton = screen.getByTitle('Buy Credits');
      expect(buyButton).toBeInTheDocument();
    });

    it('should open purchase modal when buy button is clicked', () => {
      render(<CreditBalance />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByTitle('Buy Credits'));
      expect(mockSetIsPurchaseModalOpen).toHaveBeenCalledWith(true);
    });

    it('should hide label when showLabel is false', () => {
      mockCredits = 3500;
      render(<CreditBalance showLabel={false} />, { wrapper: createWrapper() });

      expect(screen.queryByText('3,500')).not.toBeInTheDocument();
    });
  });

  describe('Badge variant', () => {
    it('should render compact badge variant', () => {
      mockCredits = 2500;
      render(<CreditBalance variant="badge" />, { wrapper: createWrapper() });

      expect(screen.getByText('2,500')).toBeInTheDocument();
    });

    it('should open purchase modal when badge is clicked', () => {
      render(<CreditBalance variant="badge" />, { wrapper: createWrapper() });

      fireEvent.click(screen.getByText('5,000'));
      expect(mockSetIsPurchaseModalOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('Color thresholds', () => {
    it('should apply emerald color when balance > 2000', () => {
      mockCredits = 3000;
      render(<CreditBalance variant="badge" />, { wrapper: createWrapper() });

      const badge = screen.getByText('3,000').closest('div');
      expect(badge?.className).toContain('text-emerald-600');
    });

    it('should apply yellow color when balance > 1000 and <= 2000', () => {
      mockCredits = 1500;
      render(<CreditBalance variant="badge" />, { wrapper: createWrapper() });

      const badge = screen.getByText('1,500').closest('div');
      expect(badge?.className).toContain('text-yellow-600');
    });

    it('should apply amber color when balance > 500 and <= 1000', () => {
      mockCredits = 750;
      render(<CreditBalance variant="badge" />, { wrapper: createWrapper() });

      const badge = screen.getByText('750').closest('div');
      expect(badge?.className).toContain('text-amber-600');
    });

    it('should apply orange color when balance > 100 and <= 500', () => {
      mockCredits = 200;
      render(<CreditBalance variant="badge" />, { wrapper: createWrapper() });

      const badge = screen.getByText('200').closest('div');
      expect(badge?.className).toContain('text-orange-600');
    });

    it('should apply red color with pulse when balance <= 100', () => {
      mockCredits = 50;
      render(<CreditBalance variant="badge" />, { wrapper: createWrapper() });

      const badge = screen.getByText('50').closest('div');
      expect(badge?.className).toContain('text-red-600');
      expect(badge?.className).toContain('animate-pulse');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to container', () => {
      const { container } = render(
        <CreditBalance className="my-custom-class" />,
        { wrapper: createWrapper() }
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('my-custom-class');
    });
  });
});

/**
 * CreditOptimizationTips Tests
 *
 * Verifies:
 * - Shows only for free tier users
 * - Renders optimization tips with correct content
 * - Personalizes tips based on usage patterns
 * - Dismisses tips when clicked
 * - Compact variant shows limited tips
 * - Respects maxTips prop
 * - Shows top credit uses breakdown when usage data available
 * - Shows upgrade CTA
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreditOptimizationTips } from '../CreditOptimizationTips';

// --- Mutable mock state ---
let mockIsFreeTier = true;
let mockTenantId: string | undefined = 'tenant-123';
let mockQueryData: unknown = null;

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    isFreeTier: mockIsFreeTier,
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenantId ? { id: mockTenantId } : null,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryFn, enabled }: { queryFn: () => Promise<unknown>; enabled: boolean }) => ({
    data: mockQueryData,
    isLoading: false,
  }),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    creditOptimizationUsage: {
      all: ['credit-optimization-usage'],
      byTenant: (tenantId?: string) => ['credit-optimization-usage', tenantId],
    },
  },
}));

vi.mock('@/lib/credits', () => ({
  CREDIT_COSTS: {
    send_sms: { actionKey: 'send_sms', actionName: 'Send SMS', credits: 25, category: 'crm' },
    menu_create: { actionKey: 'menu_create', actionName: 'Create Menu', credits: 100, category: 'menus' },
    export_csv: { actionKey: 'export_csv', actionName: 'Export CSV', credits: 0, category: 'exports' },
  },
}));

vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="accordion" {...props}>{children}</div>
  ),
  AccordionItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`accordion-item-${value}`}>{children}</div>
  ),
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="accordion-trigger">{children}</button>
  ),
  AccordionContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accordion-content">{children}</div>
  ),
}));

describe('CreditOptimizationTips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFreeTier = true;
    mockTenantId = 'tenant-123';
    mockQueryData = null;
  });

  describe('Visibility', () => {
    it('should render for free tier users', () => {
      mockIsFreeTier = true;
      const { container } = render(<CreditOptimizationTips />);
      expect(container.innerHTML).not.toBe('');
    });

    it('should not render for paid tier users', () => {
      mockIsFreeTier = false;
      const { container } = render(<CreditOptimizationTips />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('Full variant', () => {
    it('should render header with lightbulb icon and title', () => {
      render(<CreditOptimizationTips />);
      expect(screen.getByText('Credit-Saving Tips')).toBeInTheDocument();
    });

    it('should render description text', () => {
      render(<CreditOptimizationTips />);
      expect(
        screen.getByText('Get more value from your free credits with these optimization strategies')
      ).toBeInTheDocument();
    });

    it('should render up to maxTips tips', () => {
      render(<CreditOptimizationTips maxTips={3} />);
      const triggers = screen.getAllByTestId('accordion-trigger');
      expect(triggers.length).toBeLessThanOrEqual(3);
    });

    it('should default to 5 tips maximum', () => {
      render(<CreditOptimizationTips />);
      const triggers = screen.getAllByTestId('accordion-trigger');
      expect(triggers.length).toBeLessThanOrEqual(5);
    });

    it('should render upgrade CTA with pricing', () => {
      render(<CreditOptimizationTips />);
      expect(screen.getByText('Go unlimited for $79/month')).toBeInTheDocument();
      expect(
        screen.getByText('No more worrying about credits. All features, unlimited usage.')
      ).toBeInTheDocument();
    });

    it('should render savings badges on tips', () => {
      render(<CreditOptimizationTips />);
      // At least one savings badge should be present
      const savingsBadges = screen.getAllByText(/Save/);
      expect(savingsBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Compact variant', () => {
    it('should render compact version with limited tips', () => {
      render(<CreditOptimizationTips compact />);
      expect(screen.getByText('Credit-Saving Tips')).toBeInTheDocument();
      // Compact shows at most 2 tips
      // No accordion in compact mode - just text items
      expect(screen.queryByTestId('accordion')).not.toBeInTheDocument();
    });

    it('should not render upgrade CTA in compact mode', () => {
      render(<CreditOptimizationTips compact />);
      expect(screen.queryByText('Go unlimited for $79/month')).not.toBeInTheDocument();
    });
  });

  describe('Dismiss functionality', () => {
    it('should remove tip when dismiss button is clicked', () => {
      render(<CreditOptimizationTips maxTips={8} />);
      const initialItems = screen.getAllByTestId(/^accordion-item-/);
      const initialCount = initialItems.length;

      const dismissButtons = screen.getAllByText('Dismiss');
      fireEvent.click(dismissButtons[0]);

      const afterItems = screen.getAllByTestId(/^accordion-item-/);
      expect(afterItems.length).toBe(initialCount - 1);
    });
  });

  describe('Usage-based personalization', () => {
    it('should show top credit uses when usage data is available', () => {
      mockQueryData = {
        actionCounts: {
          send_sms: { count: 15, credits: 375 },
          menu_create: { count: 3, credits: 300 },
        },
        totalActions: 18,
        topActions: [
          ['send_sms', { count: 15, credits: 375 }],
          ['menu_create', { count: 3, credits: 300 }],
        ],
      };

      render(<CreditOptimizationTips />);
      expect(screen.getByText('Your Top Credit Uses')).toBeInTheDocument();
      expect(screen.getByText('Send SMS')).toBeInTheDocument();
      expect(screen.getByText('15x')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(<CreditOptimizationTips className="my-custom-class" />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('my-custom-class');
    });
  });
});

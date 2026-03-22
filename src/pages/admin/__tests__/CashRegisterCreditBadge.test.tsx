/**
 * Tests for CreditCostBadge integration with POS checkout button.
 *
 * Validates that the badge renders correctly for free-tier users
 * and hides for paid-tier or zero-cost scenarios.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock useCredits before importing the component
const mockUseCredits = vi.fn();

vi.mock('@/hooks/useCredits', () => ({
  useCredits: (...args: unknown[]) => mockUseCredits(...args),
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: (key: string) => (key === 'pos_process_sale' ? 25 : 0),
  getCreditCostInfo: (key: string) =>
    key === 'pos_process_sale'
      ? {
          actionKey: 'pos_process_sale',
          actionName: 'POS Sale',
          credits: 25,
          category: 'pos',
          description: 'Process a POS sale',
        }
      : null,
}));

import { CreditCostBadge } from '@/components/credits/CreditCostBadge';

describe('CreditCostBadge on POS checkout button', () => {
  it('should render badge with cost of 25 for free tier users', () => {
    mockUseCredits.mockReturnValue({
      balance: 1000,
      isFreeTier: true,
      isLoading: false,
    });

    render(
      <CreditCostBadge
        actionKey="pos_process_sale"
        compact
        hoverMode
        className="ml-1.5"
      />
    );

    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('should not render badge for paid tier users', () => {
    mockUseCredits.mockReturnValue({
      balance: 5000,
      isFreeTier: false,
      isLoading: false,
    });

    const { container } = render(
      <CreditCostBadge
        actionKey="pos_process_sale"
        compact
        hoverMode
        className="ml-1.5"
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('should not render badge while loading', () => {
    mockUseCredits.mockReturnValue({
      balance: 0,
      isFreeTier: true,
      isLoading: true,
    });

    const { container } = render(
      <CreditCostBadge
        actionKey="pos_process_sale"
        compact
        hoverMode
        className="ml-1.5"
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('should show warning icon when balance is insufficient', () => {
    mockUseCredits.mockReturnValue({
      balance: 10,
      isFreeTier: true,
      isLoading: false,
    });

    render(
      <CreditCostBadge
        actionKey="pos_process_sale"
        compact
        hoverMode
        className="ml-1.5"
      />
    );

    expect(screen.getByText('25')).toBeInTheDocument();
    // The badge should have red styling when insufficient
    const badge = screen.getByText('25').closest('[class*="badge"]') ?? screen.getByText('25').parentElement;
    expect(badge?.className).toContain('red');
  });

  it('should have hoverMode classes for subtle display in POS', () => {
    mockUseCredits.mockReturnValue({
      balance: 1000,
      isFreeTier: true,
      isLoading: false,
    });

    render(
      <CreditCostBadge
        actionKey="pos_process_sale"
        compact
        hoverMode
        className="ml-1.5"
      />
    );

    const badge = screen.getByText('25').closest('[class*="badge"]') ?? screen.getByText('25').parentElement;
    expect(badge?.className).toContain('opacity-0');
    expect(badge?.className).toContain('group-hover:opacity-100');
  });
});

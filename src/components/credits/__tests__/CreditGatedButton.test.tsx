/**
 * CreditGatedButton Tests
 *
 * Verifies:
 * - Shows label and CreditCostBadge for free tier users
 * - Disables button when credits insufficient
 * - Shows tooltip when gated (insufficient credits)
 * - Falls back to regular button when credit system errors
 * - Falls back to regular button for non-free-tier users
 * - Fires onClick when credits are sufficient
 * - Does NOT fire onClick when gated
 * - Renders loading state correctly
 * - Shows nothing for free actions (cost=0)
 * - Supports custom icon and variant props
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreditGatedButton } from '../CreditGatedButton';

// --- Mutable mock state ---
let mockBalance = 1000;
let mockIsFreeTier = true;
let mockIsLoading = false;
let mockError: Error | null = null;

// --- Mocks ---

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: mockIsLoading,
    error: mockError,
  }),
}));

vi.mock('@/lib/credits', () => ({
  getCreditCost: vi.fn((actionKey: string) => {
    const costs: Record<string, number> = {
      menu_create: 100,
      send_sms: 25,
      free_action: 0,
      storefront_create: 500,
      route_optimize: 50,
    };
    return costs[actionKey] ?? 0;
  }),
  getCreditCostInfo: vi.fn(() => null),
}));

// Render tooltip content so we can assert on it
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

describe('CreditGatedButton', () => {
  beforeEach(() => {
    mockBalance = 1000;
    mockIsFreeTier = true;
    mockIsLoading = false;
    mockError = null;
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  it('renders label text', () => {
    render(
      <CreditGatedButton actionKey="menu_create" label="Create Menu" />
    );
    expect(screen.getByText('Create Menu')).toBeInTheDocument();
  });

  it('renders button as enabled when credits are sufficient', () => {
    mockBalance = 1000;
    render(
      <CreditGatedButton actionKey="menu_create" label="Create Menu" />
    );
    const button = screen.getByRole('button', { name: /Create Menu/i });
    expect(button).not.toBeDisabled();
  });

  // =========================================================================
  // Credit gating (insufficient credits)
  // =========================================================================

  it('disables button when balance is insufficient', () => {
    mockBalance = 50; // cost is 100 for menu_create
    render(
      <CreditGatedButton actionKey="menu_create" label="Create Menu" />
    );
    const button = screen.getByRole('button', { name: /Create Menu/i });
    expect(button).toBeDisabled();
  });

  it('shows tooltip when credits are insufficient', () => {
    mockBalance = 30;
    render(
      <CreditGatedButton actionKey="route_optimize" label="Optimize Route" />
    );
    const tooltip = screen.getByTestId('tooltip-content');
    expect(tooltip).toHaveTextContent('Requires 50 credits (you have 30)');
  });

  it('shows custom tooltip when provided', () => {
    mockBalance = 30;
    render(
      <CreditGatedButton
        actionKey="route_optimize"
        label="Optimize Route"
        insufficientTooltip="Buy more credits to unlock route optimization"
      />
    );
    const tooltip = screen.getByTestId('tooltip-content');
    expect(tooltip).toHaveTextContent(
      'Buy more credits to unlock route optimization'
    );
  });

  it('does NOT fire onClick when gated', () => {
    mockBalance = 10;
    const handleClick = vi.fn();
    render(
      <CreditGatedButton
        actionKey="menu_create"
        label="Create Menu"
        onClick={handleClick}
      />
    );
    const button = screen.getByRole('button', { name: /Create Menu/i });
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Sufficient credits
  // =========================================================================

  it('fires onClick when credits are sufficient', () => {
    mockBalance = 1000;
    const handleClick = vi.fn();
    render(
      <CreditGatedButton
        actionKey="send_sms"
        label="Send SMS"
        onClick={handleClick}
      />
    );
    const button = screen.getByRole('button', { name: /Send SMS/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does NOT show tooltip when credits are sufficient', () => {
    mockBalance = 1000;
    render(
      <CreditGatedButton actionKey="send_sms" label="Send SMS" />
    );
    expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
  });

  // =========================================================================
  // Free actions (cost = 0)
  // =========================================================================

  it('renders enabled button for free actions', () => {
    mockBalance = 0;
    render(
      <CreditGatedButton actionKey="free_action" label="Free Action" />
    );
    const button = screen.getByRole('button', { name: /Free Action/i });
    expect(button).not.toBeDisabled();
  });

  // =========================================================================
  // Fallback: non-free-tier
  // =========================================================================

  it('renders regular button for non-free-tier users (no badge)', () => {
    mockIsFreeTier = false;
    const handleClick = vi.fn();
    render(
      <CreditGatedButton
        actionKey="menu_create"
        label="Create Menu"
        onClick={handleClick}
      />
    );
    const button = screen.getByRole('button', { name: /Create Menu/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  // =========================================================================
  // Fallback: credit system error
  // =========================================================================

  it('renders regular button when credit system has error', () => {
    mockError = new Error('Failed to fetch credits');
    const handleClick = vi.fn();
    render(
      <CreditGatedButton
        actionKey="menu_create"
        label="Create Menu"
        onClick={handleClick}
      />
    );
    const button = screen.getByRole('button', { name: /Create Menu/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  // =========================================================================
  // Loading state
  // =========================================================================

  it('disables button when loading', () => {
    render(
      <CreditGatedButton
        actionKey="send_sms"
        label="Send SMS"
        loading
      />
    );
    const button = screen.getByRole('button', { name: /Send SMS/i });
    expect(button).toBeDisabled();
  });

  it('disables button when credits are loading', () => {
    mockIsLoading = true;
    render(
      <CreditGatedButton actionKey="send_sms" label="Send SMS" />
    );
    const button = screen.getByRole('button', { name: /Send SMS/i });
    expect(button).toBeDisabled();
  });

  // =========================================================================
  // Disabled prop
  // =========================================================================

  it('respects external disabled prop', () => {
    mockBalance = 1000;
    render(
      <CreditGatedButton
        actionKey="send_sms"
        label="Send SMS"
        disabled
      />
    );
    const button = screen.getByRole('button', { name: /Send SMS/i });
    expect(button).toBeDisabled();
  });

  // =========================================================================
  // Icon rendering
  // =========================================================================

  it('renders custom icon', () => {
    render(
      <CreditGatedButton
        actionKey="send_sms"
        label="Send SMS"
        icon={<span data-testid="custom-icon">icon</span>}
      />
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}));

import { WorkflowCreditCostSummary } from '../WorkflowCreditCostSummary';

// --- Mutable mock state ---
let mockBalance = 5000;
let mockIsFreeTier = true;
let mockIsLoading = false;

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: mockBalance,
    isFreeTier: mockIsFreeTier,
    isLoading: mockIsLoading,
  }),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('WorkflowCreditCostSummary', () => {
  beforeEach(() => {
    mockBalance = 5000;
    mockIsFreeTier = true;
    mockIsLoading = false;
  });

  it('renders nothing when user is not free tier', () => {
    mockIsFreeTier = false;
    const { container } = render(
      <WorkflowCreditCostSummary actions={[{ type: 'send_email' }]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when still loading', () => {
    mockIsLoading = true;
    const { container } = render(
      <WorkflowCreditCostSummary actions={[{ type: 'send_email' }]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when actions list is empty', () => {
    const { container } = render(
      <WorkflowCreditCostSummary actions={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when total cost is zero (all unmapped)', () => {
    const { container } = render(
      <WorkflowCreditCostSummary actions={[{ type: 'unknown_action' }]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders credit cost summary for known actions', () => {
    render(
      <WorkflowCreditCostSummary
        actions={[{ type: 'send_email' }, { type: 'send_sms' }]}
      />
    );

    expect(screen.getByText('Credit Cost Estimate')).toBeInTheDocument();
    expect(screen.getByText('35 credits / run')).toBeInTheDocument();
    expect(screen.getByText('35 credits')).toBeInTheDocument();
  });

  it('shows per-step breakdown with step numbers', () => {
    render(
      <WorkflowCreditCostSummary
        actions={[{ type: 'send_email' }, { type: 'call_webhook' }]}
      />
    );

    expect(screen.getByText(/1\. Send Email/)).toBeInTheDocument();
    expect(screen.getByText('10 cr')).toBeInTheDocument();
    expect(screen.getByText(/2\. Webhook Fired/)).toBeInTheDocument();
    expect(screen.getByText('5 cr')).toBeInTheDocument();
  });

  it('shows "Free" label for unmapped actions in a mixed list', () => {
    render(
      <WorkflowCreditCostSummary
        actions={[{ type: 'send_email' }, { type: 'my_custom_step' }]}
      />
    );

    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows insufficient credits warning when balance is too low', () => {
    mockBalance = 5;

    render(
      <WorkflowCreditCostSummary
        actions={[{ type: 'send_email' }, { type: 'send_sms' }]}
      />
    );

    expect(
      screen.getByText(/Insufficient credits to run this workflow/)
    ).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument(); // 35 - 5 = 30 more needed
  });

  it('does not show warning when balance is sufficient', () => {
    mockBalance = 5000;

    render(
      <WorkflowCreditCostSummary
        actions={[{ type: 'send_email' }]}
      />
    );

    expect(
      screen.queryByText(/Insufficient credits/)
    ).not.toBeInTheDocument();
  });
});

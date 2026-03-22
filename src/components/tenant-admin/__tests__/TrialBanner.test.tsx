import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TrialBanner } from '@/components/tenant-admin/TrialBanner';

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
}));

function renderBanner(props: Partial<Parameters<typeof TrialBanner>[0]> = {}) {
  const defaultProps = {
    daysRemaining: 5,
    trialEndsAt: '2026-04-01T00:00:00Z',
    tenantSlug: 'acme',
  };
  return render(
    <MemoryRouter>
      <TrialBanner {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe('TrialBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the trial banner with days remaining message', () => {
    renderBanner({ daysRemaining: 5 });
    expect(screen.getByText(/your trial ends in 5 days/i)).toBeInTheDocument();
  });

  it('renders "Manage Subscription" button linking to billing page', () => {
    renderBanner({ tenantSlug: 'acme' });
    const link = screen.getByRole('link', { name: /manage subscription/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/acme/admin/billing');
  });

  it('uses correct tenant slug in the billing link', () => {
    renderBanner({ tenantSlug: 'my-dispensary' });
    const link = screen.getByRole('link', { name: /manage subscription/i });
    expect(link).toHaveAttribute('href', '/my-dispensary/admin/billing');
  });

  it('shows "trial ends today" message when daysRemaining is 0', () => {
    renderBanner({ daysRemaining: 0 });
    expect(screen.getByText(/your trial ends today/i)).toBeInTheDocument();
  });

  it('shows "trial ends tomorrow" message when daysRemaining is 1', () => {
    renderBanner({ daysRemaining: 1 });
    expect(screen.getByText(/your trial ends tomorrow/i)).toBeInTheDocument();
  });

  it('renders destructive variant when daysRemaining is 0', () => {
    const { container } = renderBanner({ daysRemaining: 0 });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert?.className).toMatch(/destructive/);
  });

  it('renders destructive variant when daysRemaining is 1', () => {
    const { container } = renderBanner({ daysRemaining: 1 });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert?.className).toMatch(/destructive/);
  });

  it('does NOT render destructive variant when daysRemaining is 2', () => {
    const { container } = renderBanner({ daysRemaining: 2 });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert?.className).not.toMatch(/destructive/);
  });

  it('does NOT render destructive variant when daysRemaining is 7', () => {
    const { container } = renderBanner({ daysRemaining: 7 });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert?.className).not.toMatch(/destructive/);
  });

  it('dismisses the banner when close button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderBanner({ daysRemaining: 0 });

    const dismissBtn = container.querySelector('button:last-of-type');
    expect(dismissBtn).toBeInTheDocument();
    await user.click(dismissBtn!);

    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('returns null when daysRemaining is negative (expired)', () => {
    const { container } = renderBanner({ daysRemaining: -1 });
    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('returns null when trialEndsAt is null', () => {
    const { container } = renderBanner({ trialEndsAt: null });
    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });
});

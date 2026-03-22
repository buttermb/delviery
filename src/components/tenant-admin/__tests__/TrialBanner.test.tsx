import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TrialBanner } from '@/components/tenant-admin/TrialBanner';

vi.mock('@/lib/formatters', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
}));

function renderBanner(props: { daysRemaining: number; trialEndsAt: string | null; tenantSlug: string }) {
  return render(
    <MemoryRouter>
      <TrialBanner {...props} />
    </MemoryRouter>
  );
}

const futureDate = '2026-04-05T00:00:00Z';

describe('TrialBanner destructive variant for <=1 day', () => {
  it('renders destructive variant when daysRemaining is 0', () => {
    const { container } = renderBanner({
      daysRemaining: 0,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert?.className).toMatch(/destructive/);
  });

  it('renders destructive variant when daysRemaining is 1', () => {
    const { container } = renderBanner({
      daysRemaining: 1,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert?.className).toMatch(/destructive/);
  });

  it('does NOT render destructive variant when daysRemaining is 2', () => {
    const { container } = renderBanner({
      daysRemaining: 2,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert?.className).not.toMatch(/destructive/);
  });

  it('does NOT render destructive variant when daysRemaining is 7', () => {
    const { container } = renderBanner({
      daysRemaining: 7,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert?.className).not.toMatch(/destructive/);
  });

  it('shows "ends today" message for 0 days remaining', () => {
    renderBanner({
      daysRemaining: 0,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    expect(screen.getByText(/your trial ends today/i)).toBeInTheDocument();
  });

  it('shows "ends tomorrow" message for 1 day remaining', () => {
    renderBanner({
      daysRemaining: 1,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    expect(screen.getByText(/your trial ends tomorrow/i)).toBeInTheDocument();
  });

  it('shows days count message for >1 days remaining', () => {
    renderBanner({
      daysRemaining: 5,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    expect(screen.getByText(/your trial ends in 5 days/i)).toBeInTheDocument();
  });

  it('renders nothing when dismissed', async () => {
    const user = userEvent.setup();
    const { container } = renderBanner({
      daysRemaining: 0,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    const dismissBtn = container.querySelector('button:last-of-type');
    expect(dismissBtn).toBeInTheDocument();
    await user.click(dismissBtn!);

    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('renders nothing when daysRemaining is negative (expired)', () => {
    const { container } = renderBanner({
      daysRemaining: -1,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('renders nothing when trialEndsAt is null', () => {
    const { container } = renderBanner({
      daysRemaining: 5,
      trialEndsAt: null,
      tenantSlug: 'acme',
    });

    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('includes a link to the billing page with tenant slug', () => {
    renderBanner({
      daysRemaining: 1,
      trialEndsAt: futureDate,
      tenantSlug: 'acme',
    });

    const link = screen.getByRole('link', { name: /manage subscription/i });
    expect(link).toHaveAttribute('href', '/acme/admin/billing');
  });
});

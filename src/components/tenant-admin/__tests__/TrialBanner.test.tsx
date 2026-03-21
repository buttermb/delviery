import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TrialBanner } from '@/components/tenant-admin/TrialBanner';

function renderBanner(props: {
  daysRemaining: number;
  trialEndsAt: string | null;
  tenantSlug: string;
}) {
  return render(
    <MemoryRouter>
      <TrialBanner {...props} />
    </MemoryRouter>
  );
}

const defaultProps = {
  daysRemaining: 7,
  trialEndsAt: '2026-03-28T00:00:00Z',
  tenantSlug: 'acme',
};

describe('TrialBanner', () => {
  it('renders trial message with days remaining', () => {
    renderBanner(defaultProps);
    expect(screen.getByText(/your trial ends in 7 days/i)).toBeInTheDocument();
  });

  it('renders "ends today" message when daysRemaining is 0', () => {
    renderBanner({ ...defaultProps, daysRemaining: 0 });
    expect(screen.getByText(/your trial ends today/i)).toBeInTheDocument();
  });

  it('renders "ends tomorrow" message when daysRemaining is 1', () => {
    renderBanner({ ...defaultProps, daysRemaining: 1 });
    expect(screen.getByText(/your trial ends tomorrow/i)).toBeInTheDocument();
  });

  it('does not render when trialEndsAt is null', () => {
    renderBanner({ ...defaultProps, trialEndsAt: null });
    expect(screen.queryByText(/manage subscription/i)).not.toBeInTheDocument();
  });

  it('does not render when daysRemaining is negative (expired)', () => {
    renderBanner({ ...defaultProps, daysRemaining: -1 });
    expect(screen.queryByText(/manage subscription/i)).not.toBeInTheDocument();
  });

  it('Manage Subscription link points to settings billing tab', () => {
    renderBanner(defaultProps);
    const link = screen.getByRole('link', { name: /manage subscription/i });
    expect(link).toHaveAttribute('href', '/acme/admin/settings?tab=billing');
  });

  it('includes tenant slug in the billing link', () => {
    renderBanner({ ...defaultProps, tenantSlug: 'green-leaf' });
    const link = screen.getByRole('link', { name: /manage subscription/i });
    expect(link).toHaveAttribute('href', '/green-leaf/admin/settings?tab=billing');
  });

  it('can be dismissed by clicking the close button', async () => {
    const user = userEvent.setup();
    renderBanner(defaultProps);

    expect(screen.getByText(/your trial ends in 7 days/i)).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: '' });
    await user.click(closeButton);

    expect(screen.queryByText(/your trial ends in 7 days/i)).not.toBeInTheDocument();
  });
});

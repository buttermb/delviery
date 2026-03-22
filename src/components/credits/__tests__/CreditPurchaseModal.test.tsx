/**
 * CreditPurchaseModal Tests
 * Verifies correct package tiers, pricing, UI elements, and purchase flow
 * Uses CREDIT_PACKAGES from lib/credits as source of truth
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditPurchaseModal } from '../CreditPurchaseModal';
import { CREDIT_PACKAGES } from '@/lib/credits';
import { BrowserRouter } from 'react-router-dom';

// Use vi.hoisted so these are available inside vi.mock factories
const { mockInvoke, mockToast, mockUseTenantAdminAuth } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue({ data: { checkout_url: 'https://checkout.stripe.com/test' }, error: null }),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockUseTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: (...args: unknown[]) => mockUseTenantAdminAuth(...args),
}));

vi.mock('@/contexts/CreditContext', () => ({
  useCredits: () => ({
    balance: 5000,
    isLoading: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => typeof err === 'string' ? err : 'Something went wrong',
}));

const mockOnOpenChange = vi.fn();

const renderModal = (open = true, onOpenChange = mockOnOpenChange) => {
  return render(
    <BrowserRouter>
      <CreditPurchaseModal open={open} onOpenChange={onOpenChange} />
    </BrowserRouter>
  );
};

describe('CreditPurchaseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTenantAdminAuth.mockReturnValue({
      tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
    });
  });

  describe('Package Display', () => {
    it('should display all package names from CREDIT_PACKAGES', () => {
      renderModal();

      CREDIT_PACKAGES.forEach((pkg) => {
        expect(screen.getByText(pkg.name)).toBeInTheDocument();
      });
    });

    it('should display correct credit amounts from CREDIT_PACKAGES', () => {
      renderModal();

      CREDIT_PACKAGES.forEach((pkg) => {
        expect(screen.getByText(pkg.credits.toLocaleString())).toBeInTheDocument();
      });
    });

    it('should display correct prices from CREDIT_PACKAGES', () => {
      renderModal();

      CREDIT_PACKAGES.forEach((pkg) => {
        const priceDisplay = `$${(pkg.priceCents / 100).toFixed(2)}`;
        expect(screen.getByText(priceDisplay)).toBeInTheDocument();
      });
    });

    it('should display badge labels for packages that have them', () => {
      renderModal();

      const packagesWithBadges = CREDIT_PACKAGES.filter((pkg) => pkg.badge);
      packagesWithBadges.forEach((pkg) => {
        expect(screen.getByText(pkg.badge!)).toBeInTheDocument();
      });
    });
  });

  describe('Modal State', () => {
    it('should not render when closed', () => {
      renderModal(false);

      expect(screen.queryByText('Top Up Credits')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      renderModal(true);

      expect(screen.getByText('Top Up Credits')).toBeInTheDocument();
    });
  });

  describe('Buy Buttons', () => {
    it('should have a Buy Now button for each package', () => {
      renderModal();

      const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
      expect(buyButtons).toHaveLength(CREDIT_PACKAGES.length);
    });
  });

  describe('Package Features', () => {
    it('should show Instant delivery for all packages', () => {
      renderModal();

      const instantDeliveryLabels = screen.getAllByText('Instant delivery');
      expect(instantDeliveryLabels).toHaveLength(CREDIT_PACKAGES.length);
    });

    it('should show Never expires for all packages', () => {
      renderModal();

      const neverExpiresLabels = screen.getAllByText('Never expires');
      expect(neverExpiresLabels).toHaveLength(CREDIT_PACKAGES.length);
    });
  });
});

describe('CreditPurchaseModal - Purchase Flow', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: { checkout_url: 'https://checkout.stripe.com/test' }, error: null });
    // Stub window.open so tests don't actually open tabs
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should invoke purchase-credits edge function when Buy Now is clicked', async () => {
    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]); // Click Starter Pack

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('purchase-credits', {
        body: {
          tenant_id: 'test-tenant-id',
          package_slug: 'starter-pack',
          success_url: expect.stringContaining('/test-tenant/admin/credits/success'),
          cancel_url: expect.stringContaining('/test-tenant/admin/credits/cancelled'),
        },
      });
    });
  });

  it('should open Stripe checkout URL in new tab on success', async () => {
    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[1]); // Click Growth Pack

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        'https://checkout.stripe.com/test',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });

  it('should show success toast and close modal after checkout opens', async () => {
    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Checkout opened', {
        description: 'Complete your purchase in the new tab',
      });
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should show loading state while purchase is processing', async () => {
    // Make the invoke hang so we can observe loading state
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  it('should disable all Buy Now buttons while one purchase is processing', async () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      const allButtons = screen.getAllByRole('button');
      const purchaseButtons = allButtons.filter(
        btn => btn.textContent === 'Buy Now' || btn.textContent?.includes('Processing')
      );
      purchaseButtons.forEach(btn => {
        expect(btn).toBeDisabled();
      });
    });
  });

  it('should show error toast when edge function returns error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Stripe not configured' } });

    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to start purchase', {
        description: expect.any(String),
      });
    });
  });

  it('should show error toast when no checkout URL is returned', async () => {
    mockInvoke.mockResolvedValue({ data: { checkout_url: null }, error: null });

    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('No checkout URL returned');
    });
  });

  it('should show error toast on network/exception failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Purchase failed', {
        description: 'Please try again',
      });
    });
  });

  it('should pass correct package slug for each package tier', async () => {
    renderModal();

    const expectedSlugs = ['starter-pack', 'growth-pack', 'power-pack', 'enterprise-pack'];

    for (let i = 0; i < expectedSlugs.length; i++) {
      vi.clearAllMocks();
      mockInvoke.mockResolvedValue({ data: { checkout_url: 'https://checkout.stripe.com/test' }, error: null });
      vi.spyOn(window, 'open').mockImplementation(() => null);

      const { unmount } = renderModal();

      const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
      await user.click(buyButtons[i]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('purchase-credits', expect.objectContaining({
          body: expect.objectContaining({
            package_slug: expectedSlugs[i],
          }),
        }));
      });

      unmount();
    }
  });

  it('should include tenant slug in success and cancel URLs', async () => {
    renderModal();

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      const callArgs = mockInvoke.mock.calls[0];
      const body = callArgs[1].body;
      expect(body.success_url).toContain('/test-tenant/admin/credits/success');
      expect(body.cancel_url).toContain('/test-tenant/admin/credits/cancelled');
      expect(body.success_url).toContain('session_id={CHECKOUT_SESSION_ID}');
    });
  });

  it('should show error toast when no tenant is found', async () => {
    mockUseTenantAdminAuth.mockReturnValueOnce({ tenant: null });

    render(
      <BrowserRouter>
        <CreditPurchaseModal open={true} onOpenChange={mockOnOpenChange} />
      </BrowserRouter>
    );

    const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
    await user.click(buyButtons[0]);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('No tenant found');
    });
  });
});

describe('Package Pricing Verification', () => {
  it('all packages should have positive credit amounts', () => {
    CREDIT_PACKAGES.forEach((pkg) => {
      expect(pkg.credits).toBeGreaterThan(0);
    });
  });

  it('all packages should have positive prices', () => {
    CREDIT_PACKAGES.forEach((pkg) => {
      expect(pkg.priceCents).toBeGreaterThan(0);
    });
  });

  it('price per credit decreases with larger packages (better value)', () => {
    const pricePerCredit = CREDIT_PACKAGES.map(p => ({
      id: p.id,
      pricePerCredit: p.priceCents / p.credits,
    }));

    for (let i = 1; i < pricePerCredit.length; i++) {
      expect(pricePerCredit[i].pricePerCredit).toBeLessThan(
        pricePerCredit[i - 1].pricePerCredit
      );
    }
  });

  it('should have at least 4 package tiers', () => {
    expect(CREDIT_PACKAGES.length).toBeGreaterThanOrEqual(4);
  });
});

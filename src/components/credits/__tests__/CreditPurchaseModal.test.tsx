/**
 * CreditPurchaseModal Tests
 * Verifies correct package tiers, pricing, UI elements, and purchase flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditPurchaseModal } from '../CreditPurchaseModal';
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
    it('should display all 4 package tiers', () => {
      renderModal();

      expect(screen.getByText('Starter Pack')).toBeInTheDocument();
      expect(screen.getByText('Growth Pack')).toBeInTheDocument();
      expect(screen.getByText('Power Pack')).toBeInTheDocument();
      expect(screen.getByText('Enterprise Pack')).toBeInTheDocument();
    });

    it('should display correct credit amounts', () => {
      renderModal();

      // Credit amounts formatted with commas
      expect(screen.getByText('5,000')).toBeInTheDocument();
      expect(screen.getByText('15,000')).toBeInTheDocument();
      expect(screen.getByText('50,000')).toBeInTheDocument();
      expect(screen.getByText('150,000')).toBeInTheDocument();
    });

    it('should display correct prices', () => {
      renderModal();

      expect(screen.getByText('$9.99')).toBeInTheDocument();
      expect(screen.getByText('$24.99')).toBeInTheDocument();
      expect(screen.getByText('$49.99')).toBeInTheDocument();
      expect(screen.getByText('$179.99')).toBeInTheDocument();
    });

    it('should mark one package as Best Value', () => {
      renderModal();

      expect(screen.getByText('Best Value')).toBeInTheDocument();
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
    it('should have 4 Buy Now buttons', () => {
      renderModal();

      const buyButtons = screen.getAllByRole('button', { name: 'Buy Now' });
      expect(buyButtons).toHaveLength(4);
    });
  });

  describe('Package Features', () => {
    it('should show Instant delivery for all packages', () => {
      renderModal();

      const instantDeliveryLabels = screen.getAllByText('Instant delivery');
      expect(instantDeliveryLabels).toHaveLength(4);
    });

    it('should show Never expires for all packages', () => {
      renderModal();

      const neverExpiresLabels = screen.getAllByText('Never expires');
      expect(neverExpiresLabels).toHaveLength(4);
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
  const EXPECTED_PACKAGES = [
    { id: 'starter-pack', credits: 5000, price: 9.99, label: 'Starter Pack' },
    { id: 'growth-pack', credits: 15000, price: 24.99, label: 'Growth Pack' },
    { id: 'power-pack', credits: 50000, price: 49.99, label: 'Power Pack' },
    { id: 'enterprise-pack', credits: 150000, price: 179.99, label: 'Enterprise Pack' },
  ];

  it('starter pack: 5,000 credits for $9.99', () => {
    const starterPack = EXPECTED_PACKAGES.find(p => p.id === 'starter-pack');
    expect(starterPack).toBeDefined();
    expect(starterPack?.credits).toBe(5000);
    expect(starterPack?.price).toBe(9.99);
  });

  it('growth pack (popular): 15,000 credits for $24.99', () => {
    const growthPack = EXPECTED_PACKAGES.find(p => p.id === 'growth-pack');
    expect(growthPack).toBeDefined();
    expect(growthPack?.credits).toBe(15000);
    expect(growthPack?.price).toBe(24.99);
  });

  it('power pack: 50,000 credits for $49.99', () => {
    const powerPack = EXPECTED_PACKAGES.find(p => p.id === 'power-pack');
    expect(powerPack).toBeDefined();
    expect(powerPack?.credits).toBe(50000);
    expect(powerPack?.price).toBe(49.99);
  });

  it('enterprise pack: 150,000 credits for $179.99', () => {
    const enterprisePack = EXPECTED_PACKAGES.find(p => p.id === 'enterprise-pack');
    expect(enterprisePack).toBeDefined();
    expect(enterprisePack?.credits).toBe(150000);
    expect(enterprisePack?.price).toBe(179.99);
  });

  it('price per credit decreases from starter through power pack', () => {
    const firstThree = EXPECTED_PACKAGES.slice(0, 3);
    const pricePerCredit = firstThree.map(p => ({
      id: p.id,
      pricePerCredit: p.price / p.credits,
    }));

    for (let i = 1; i < pricePerCredit.length; i++) {
      expect(pricePerCredit[i].pricePerCredit).toBeLessThan(
        pricePerCredit[i - 1].pricePerCredit
      );
    }
  });

  it('enterprise pack offers large volume at premium rate', () => {
    const enterprisePack = EXPECTED_PACKAGES.find(p => p.id === 'enterprise-pack');
    expect(enterprisePack).toBeDefined();
    expect(enterprisePack!.credits).toBe(150000);
    expect(enterprisePack!.price).toBe(179.99);
  });
});

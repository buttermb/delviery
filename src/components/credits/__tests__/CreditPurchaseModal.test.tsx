/**
 * CreditPurchaseModal Tests
 * Verifies correct package tiers, pricing, and UI elements
 * Uses CREDIT_PACKAGES from lib/credits as source of truth
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditPurchaseModal } from '../CreditPurchaseModal';
import { BrowserRouter } from 'react-router-dom';
import { CREDIT_PACKAGES } from '@/lib/credits';

// Mock all external dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { checkout_url: 'https://test.com' }, error: null }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', slug: 'test-tenant' },
  }),
}));

vi.mock('@/contexts/CreditContext', () => ({
  useCredits: () => ({
    balance: 5000,
    isLoading: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const renderModal = (open = true) => {
  return render(
    <BrowserRouter>
      <CreditPurchaseModal open={open} onOpenChange={() => {}} />
    </BrowserRouter>
  );
};

describe('CreditPurchaseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

describe('Package Pricing Verification (from lib)', () => {
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
});

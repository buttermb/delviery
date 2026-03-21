/**
 * CreditPurchaseModal Tests
 * Verifies correct package tiers from CREDIT_PACKAGES, pricing, and UI elements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditPurchaseModal } from '../CreditPurchaseModal';
import { CREDIT_PACKAGES } from '@/lib/credits';
import { BrowserRouter } from 'react-router-dom';

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

    it('should display correct prices from CREDIT_PACKAGES', () => {
      renderModal();

      expect(screen.getByText('$9.99')).toBeInTheDocument();
      expect(screen.getByText('$24.99')).toBeInTheDocument();
      expect(screen.getByText('$49.99')).toBeInTheDocument();
      expect(screen.getByText('$179.99')).toBeInTheDocument();
    });

    it('should display badge text for packages with badges', () => {
      renderModal();

      const badgePackages = CREDIT_PACKAGES.filter(p => p.badge);
      for (const pkg of badgePackages) {
        expect(screen.getByText(pkg.badge!)).toBeInTheDocument();
      }
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

describe('CreditPurchaseModal uses CREDIT_PACKAGES from lib', () => {
  it('modal renders the same package names as CREDIT_PACKAGES', () => {
    render(
      <BrowserRouter>
        <CreditPurchaseModal open={true} onOpenChange={() => {}} />
      </BrowserRouter>
    );

    for (const pkg of CREDIT_PACKAGES) {
      expect(screen.getByText(pkg.name)).toBeInTheDocument();
    }
  });

  it('modal renders the same prices as CREDIT_PACKAGES', () => {
    render(
      <BrowserRouter>
        <CreditPurchaseModal open={true} onOpenChange={() => {}} />
      </BrowserRouter>
    );

    for (const pkg of CREDIT_PACKAGES) {
      const priceDisplay = `$${(pkg.priceCents / 100)}`;
      expect(screen.getByText(priceDisplay)).toBeInTheDocument();
    }
  });

  it('modal renders the same credit amounts as CREDIT_PACKAGES', () => {
    render(
      <BrowserRouter>
        <CreditPurchaseModal open={true} onOpenChange={() => {}} />
      </BrowserRouter>
    );

    for (const pkg of CREDIT_PACKAGES) {
      expect(screen.getByText(pkg.credits.toLocaleString())).toBeInTheDocument();
    }
  });
});

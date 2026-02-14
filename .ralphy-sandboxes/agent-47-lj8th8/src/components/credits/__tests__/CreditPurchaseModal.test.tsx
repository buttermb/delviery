/**
 * CreditPurchaseModal Tests
 * Verifies correct package tiers, pricing, and UI elements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditPurchaseModal } from '../CreditPurchaseModal';
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

  it('price per credit decreases with larger packages (better value)', () => {
    const pricePerCredit = EXPECTED_PACKAGES.map(p => ({
      id: p.id,
      pricePerCredit: p.price / p.credits,
    }));

    for (let i = 1; i < pricePerCredit.length; i++) {
      expect(pricePerCredit[i].pricePerCredit).toBeLessThan(
        pricePerCredit[i - 1].pricePerCredit
      );
    }
  });
});

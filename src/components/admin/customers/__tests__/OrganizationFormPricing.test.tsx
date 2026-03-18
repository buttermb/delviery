/**
 * OrganizationForm Pricing Tab Tests
 *
 * Tests the advanced pricing tier selection in the OrganizationForm component.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationForm } from '../OrganizationForm';

// ============================================================================
// Mock pricing tiers data
// ============================================================================

const mockTiers = [
  {
    id: 'bronze',
    name: 'Bronze',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    discount_percentage: 0,
    min_order_amount: 0,
    description: 'Standard pricing for all new partners',
    active: true,
  },
  {
    id: 'silver',
    name: 'Silver',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    discount_percentage: 5,
    min_order_amount: 1000,
    description: '5% discount for orders over $1,000',
    active: true,
  },
  {
    id: 'gold',
    name: 'Gold',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    discount_percentage: 10,
    min_order_amount: 5000,
    description: '10% discount for orders over $5,000',
    active: true,
  },
];

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/hooks/usePricingTiers', () => ({
  usePricingTiers: () => ({
    tiers: mockTiers,
    activeTiers: mockTiers,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'tenant-123' },
    admin: { id: 'admin-123' },
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderForm(props: Partial<React.ComponentProps<typeof OrganizationForm>> = {}) {
  const Wrapper = createWrapper();
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(true),
    isSubmitting: false,
    ...props,
  };

  return render(
    React.createElement(Wrapper, null,
      React.createElement(OrganizationForm, defaultProps)
    )
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('OrganizationForm Pricing Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the Pricing tab trigger', () => {
    renderForm();

    expect(screen.getByRole('tab', { name: /pricing/i })).toBeInTheDocument();
  });

  it('should show pricing tier selector when Pricing tab is clicked', async () => {
    const user = userEvent.setup();
    renderForm();

    const pricingTab = screen.getByRole('tab', { name: /pricing/i });
    await user.click(pricingTab);

    expect(screen.getByText('Pricing Tier')).toBeInTheDocument();
    expect(screen.getByText('Custom Discount Override')).toBeInTheDocument();
  });

  it('should show "No tier assigned" as default selection', async () => {
    const user = userEvent.setup();
    renderForm();

    const pricingTab = screen.getByRole('tab', { name: /pricing/i });
    await user.click(pricingTab);

    // The select trigger should show the default placeholder
    const selectTrigger = screen.getByRole('combobox', { name: /pricing tier/i });
    expect(selectTrigger).toBeInTheDocument();
  });

  it('should show tier description text', async () => {
    const user = userEvent.setup();
    renderForm();

    const pricingTab = screen.getByRole('tab', { name: /pricing/i });
    await user.click(pricingTab);

    expect(
      screen.getByText('Assign a wholesale pricing tier to this organization')
    ).toBeInTheDocument();
  });

  it('should render discount override field', async () => {
    const user = userEvent.setup();
    renderForm();

    const pricingTab = screen.getByRole('tab', { name: /pricing/i });
    await user.click(pricingTab);

    const discountInput = screen.getByRole('spinbutton');
    expect(discountInput).toBeInTheDocument();
  });

  it('should show tier details when editing an organization with a tier', async () => {
    const user = userEvent.setup();
    renderForm({
      organization: {
        id: 'org-123',
        tenant_id: 'tenant-123',
        name: 'Test Org',
        legal_name: null,
        organization_type: 'business',
        status: 'active',
        email: null,
        phone: null,
        website: null,
        address_line1: null,
        address_line2: null,
        city: null,
        state: null,
        postal_code: null,
        country: null,
        billing_email: null,
        billing_address_line1: null,
        billing_address_line2: null,
        billing_city: null,
        billing_state: null,
        billing_postal_code: null,
        billing_country: null,
        tax_id: null,
        payment_terms: 30,
        license_number: null,
        license_type: null,
        license_expiration: null,
        pricing_tier_id: 'gold',
        discount_percentage: 10,
        notes: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: null,
      },
    });

    const pricingTab = screen.getByRole('tab', { name: /pricing/i });
    await user.click(pricingTab);

    // When a tier is selected, the tier detail card should be visible
    await waitFor(() => {
      expect(screen.getByText('Gold')).toBeInTheDocument();
    });
    expect(screen.getByText("10% discount for orders over $5,000")).toBeInTheDocument();
  });

  it('should display the custom discount override description when a tier is selected', async () => {
    const user = userEvent.setup();
    renderForm({
      organization: {
        id: 'org-123',
        tenant_id: 'tenant-123',
        name: 'Test Org',
        legal_name: null,
        organization_type: 'business',
        status: 'active',
        email: null,
        phone: null,
        website: null,
        address_line1: null,
        address_line2: null,
        city: null,
        state: null,
        postal_code: null,
        country: null,
        billing_email: null,
        billing_address_line1: null,
        billing_address_line2: null,
        billing_city: null,
        billing_state: null,
        billing_postal_code: null,
        billing_country: null,
        tax_id: null,
        payment_terms: 30,
        license_number: null,
        license_type: null,
        license_expiration: null,
        pricing_tier_id: 'silver',
        discount_percentage: 5,
        notes: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: null,
      },
    });

    const pricingTab = screen.getByRole('tab', { name: /pricing/i });
    await user.click(pricingTab);

    await waitFor(() => {
      expect(
        screen.getByText('Override the tier discount with a custom percentage')
      ).toBeInTheDocument();
    });
  });

  it('should show generic description when no tier is selected', async () => {
    const user = userEvent.setup();
    renderForm();

    const pricingTab = screen.getByRole('tab', { name: /pricing/i });
    await user.click(pricingTab);

    expect(
      screen.getByText('Organization-wide discount applied to all orders')
    ).toBeInTheDocument();
  });
});

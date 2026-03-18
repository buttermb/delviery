/**
 * Tests for BulkCouponGenerator
 *
 * Verifies:
 * - Bulk insert includes tenant_id for each coupon
 * - Form renders correctly
 * - Uses shadcn Select component (not native select)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    warn: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant' },
    admin: { id: 'admin-1' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown) => String(err),
}));

const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      insert: mockInsert,
    })),
  },
}));

import { BulkCouponGenerator } from '../BulkCouponGenerator';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('BulkCouponGenerator', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it('renders dialog title when open', () => {
    renderWithProviders(
      <BulkCouponGenerator open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByText('Bulk Coupon Generator')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    renderWithProviders(
      <BulkCouponGenerator open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByLabelText(/Number of Coupons/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Prefix/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Discount Value/)).toBeInTheDocument();
  });

  it('uses shadcn Select component for discount type', () => {
    renderWithProviders(
      <BulkCouponGenerator open={true} onOpenChange={mockOnOpenChange} />
    );
    // shadcn Select uses role="combobox" for SelectTrigger
    const selectTriggers = screen.getAllByRole('combobox');
    expect(selectTriggers.length).toBeGreaterThanOrEqual(1);
    // Verify the trigger shows the default value (multiple elements may match)
    expect(screen.getAllByText('Percentage').length).toBeGreaterThan(0);
  });

  it('includes tenant_id in each generated coupon', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BulkCouponGenerator open={true} onOpenChange={mockOnOpenChange} />
    );

    // Default count is 10, just submit with defaults
    const submitButton = screen.getByText(/Generate 10 Coupons/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
      const insertedCoupons = mockInsert.mock.calls[0][0];
      expect(Array.isArray(insertedCoupons)).toBe(true);
      expect(insertedCoupons.length).toBe(10);
      for (const coupon of insertedCoupons) {
        expect(coupon).toHaveProperty('tenant_id', 'test-tenant-id');
      }
    });
  });

  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <BulkCouponGenerator open={false} onOpenChange={mockOnOpenChange} />
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });
});

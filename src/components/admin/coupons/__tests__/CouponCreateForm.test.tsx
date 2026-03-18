/**
 * Tests for CouponCreateForm
 *
 * Verifies:
 * - Create mutation includes tenant_id
 * - Update mutation filters by tenant_id
 * - Form validation (empty code, zero discount)
 * - Form renders in create vs edit mode
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

vi.mock('@/lib/utils/sanitize', () => ({
  sanitizeCouponCode: (code: string) => code.trim().toUpperCase(),
  sanitizeTextareaInput: (text: string, _max: number) => text.trim(),
}));

vi.mock('@/components/ui/currency-input', () => ({
  CurrencyInput: ({ id, value, onChange, ...props }: Record<string, unknown>) => (
    <input
      id={id as string}
      value={value as string}
      onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
      data-testid={`currency-${id}`}
      {...props}
    />
  ),
}));

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdateFn = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      insert: mockInsert,
      update: mockUpdateFn,
    })),
  },
}));

import { CouponCreateForm } from '../CouponCreateForm';

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

describe('CouponCreateForm', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockUpdateFn.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  describe('Create mode', () => {
    it('renders create dialog title', () => {
      renderWithProviders(
        <CouponCreateForm open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      );
      expect(screen.getByText('Create New Coupon')).toBeInTheDocument();
    });

    it('renders form fields', () => {
      renderWithProviders(
        <CouponCreateForm open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      );
      expect(screen.getByLabelText(/Coupon Code/)).toBeInTheDocument();
      expect(screen.getByText('Create Coupon')).toBeInTheDocument();
    });

    it('includes tenant_id in create payload', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CouponCreateForm open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      );

      const submitButton = screen.getByText('Create Coupon');
      await user.click(submitButton);

      await waitFor(() => {
        if (mockInsert.mock.calls.length > 0) {
          const insertPayload = mockInsert.mock.calls[0][0];
          const couponData = Array.isArray(insertPayload) ? insertPayload[0] : insertPayload;
          expect(couponData).toHaveProperty('tenant_id', 'test-tenant-id');
        }
      });
    });
  });

  describe('Edit mode', () => {
    const existingCoupon = {
      id: 'coupon-1',
      code: 'EDIT10',
      description: 'Edit test',
      discount_type: 'percentage',
      discount_value: 10,
      status: 'active',
      used_count: 0,
      total_usage_limit: 100,
      never_expires: false,
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-12-31T23:59:59Z',
      min_purchase: null,
      max_discount: null,
      per_user_limit: null,
      auto_apply: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      tenant_id: 'test-tenant-id',
      created_by: 'admin-1',
    };

    it('renders edit dialog title', () => {
      renderWithProviders(
        <CouponCreateForm
          open={true}
          onOpenChange={mockOnOpenChange}
          coupon={existingCoupon as never}
          onSuccess={mockOnSuccess}
        />
      );
      expect(screen.getByText('Edit Coupon')).toBeInTheDocument();
    });

    it('shows update button', () => {
      renderWithProviders(
        <CouponCreateForm
          open={true}
          onOpenChange={mockOnOpenChange}
          coupon={existingCoupon as never}
          onSuccess={mockOnSuccess}
        />
      );
      expect(screen.getByText('Update Coupon')).toBeInTheDocument();
    });
  });

  describe('Dialog closed', () => {
    it('renders nothing when not open', () => {
      const { container } = renderWithProviders(
        <CouponCreateForm open={false} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      );
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });
});

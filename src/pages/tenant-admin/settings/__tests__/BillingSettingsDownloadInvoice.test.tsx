/**
 * BillingSettings — Download Invoice Button Tests
 *
 * Verifies:
 * 1. Download button renders for each invoice row
 * 2. Clicking download creates and triggers an HTML blob download
 * 3. Success toast on successful download
 * 4. Error toast when download fails
 * 5. Empty state renders when no invoices exist
 * 6. Invoice number fallback when invoice_number is null
 * 7. Generated HTML contains correct invoice data
 * 8. Download filename uses invoice number
 * 9. Invoice loading via edge function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

// ── Mock data ──────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-test-123';
const TENANT_SLUG = 'test-dispensary';

const mockTenant = {
  id: TENANT_ID,
  name: 'Test Dispensary',
  slug: TENANT_SLUG,
  contact_email: 'billing@test.com',
  address: '123 Green St',
  created_at: '2025-01-01T00:00:00Z',
  payment_method_added: true,
  billing_cycle: 'monthly' as const,
  subscription_plan: 'professional',
  trial_ends_at: null,
  mrr: 149,
  limits: {},
  usage: {},
};

const mockInvoices = [
  {
    id: 'inv-001a',
    invoice_number: 'INV-2025-001',
    issue_date: '2025-03-01',
    due_date: '2025-03-31',
    total: 149,
    subtotal: 149,
    tax: 0,
    status: 'paid',
    line_items: [
      { description: 'Professional Plan', quantity: 1, amount: 149, total: 149 },
    ],
    tenant_id: TENANT_ID,
    amount_due: 149,
    amount_paid: 149,
  },
  {
    id: 'inv-002b',
    invoice_number: null,
    issue_date: '2025-02-01',
    due_date: '2025-02-28',
    total: 99,
    subtotal: 99,
    tax: 0,
    status: 'pending',
    line_items: null,
    tenant_id: TENANT_ID,
    amount_due: 99,
    amount_paid: 0,
  },
];

// ── Supabase query chain mocks ─────────────────────────────────────────

const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

const setupInvoiceQueryMock = (invoices: unknown[]) => {
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ eq: mockEq, order: mockOrder });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue({ data: invoices, error: null });
};

const mockFunctionsInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

// ── Context & hook mocks ───────────────────────────────────────────────

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: mockTenant,
    tenantSlug: TENANT_SLUG,
    isLoading: false,
    isAdmin: true,
  }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({
    isTrial: false,
    needsPaymentMethod: false,
    isActive: true,
  }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    currentTier: 'professional',
    currentTierName: 'Professional',
    hasAccess: () => true,
    getFeaturesByCategory: () => ({}),
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCredits: () => ({
    balance: 1000,
    isFreeTier: false,
    isLowCredits: false,
    isCriticalCredits: false,
    isOutOfCredits: false,
    nextFreeGrantAt: null,
    lifetimeSpent: 0,
  }),
}));

// ── Utility mocks ──────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock('@/lib/formatters', () => ({
  formatCurrency: (val: number) => `$${val.toFixed(2)}`,
  formatSmartDate: (date: string | Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: (err: unknown, fallback?: string) =>
    err instanceof Error ? err.message : fallback ?? 'Something went wrong',
}));

vi.mock('@/lib/featureConfig', () => ({
  TIER_PRICES: { starter: 49, professional: 149, enterprise: 499 },
  TIER_NAMES: { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' },
  getFeaturesByCategory: () => ({}),
}));

vi.mock('@/lib/tierMapping', () => ({
  businessTierToSubscriptionTier: (tier: string) => tier,
}));

vi.mock('@/components/billing/AddPaymentMethodDialog', () => ({
  AddPaymentMethodDialog: () => null,
}));

vi.mock('@/components/credits', () => ({
  CreditBalance: () => null,
  CreditUsageStats: () => null,
}));

vi.mock('@/lib/credits', () => ({
  FREE_TIER_MONTHLY_CREDITS: 1000,
}));

// ── Import component after all mocks ───────────────────────────────────

import BillingSettings from '@/pages/tenant-admin/settings/BillingSettings';

// ── Test helpers ───────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/${TENANT_SLUG}/admin/settings/billing`]}>
          <Routes>
            <Route path="/:tenantSlug/admin/settings/billing" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

async function renderAndWaitForInvoices() {
  render(<BillingSettings />, { wrapper: createWrapper() });
  return waitFor(() =>
    screen.getAllByRole('button', { name: /download invoice/i })
  );
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('BillingSettings — Download Invoice', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let capturedBlobContent: string | null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: edge function fails, falls back to direct query
    mockFunctionsInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({
          data: { configured: true, valid: true, testMode: false },
          error: null,
        });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({ data: null, error: new Error('edge fn unavailable') });
      }
      return Promise.resolve({ data: null, error: null });
    });

    setupInvoiceQueryMock(mockInvoices);

    // Mock URL APIs — capture blob content for HTML verification
    capturedBlobContent = null;
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      // Read blob content synchronously via FileReaderSync-like approach
      const reader = new FileReader();
      reader.readAsText(blob);
      reader.onloadend = () => {
        capturedBlobContent = reader.result as string;
      };
      // Trigger sync in jsdom
      reader.dispatchEvent(new Event('loadend'));
      return 'blob:test-url';
    });
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    appendChildSpy.mockRestore();
  });

  it('renders a download button for each invoice', async () => {
    const buttons = await renderAndWaitForInvoices();
    expect(buttons).toHaveLength(2);
  });

  it('renders invoice number with fallback when invoice_number is null', async () => {
    render(<BillingSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('INV-2025-001')).toBeInTheDocument();
      // Second invoice falls back to Invoice #<id-prefix>
      expect(screen.getByText('Invoice #inv-002b')).toBeInTheDocument();
    });
  });

  it('creates an HTML blob and triggers download', async () => {
    const user = userEvent.setup();
    const buttons = await renderAndWaitForInvoices();

    await user.click(buttons[0]);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    // Verify a Blob was passed to createObjectURL
    const blobArg = createObjectURLSpy.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);

    // Verify an anchor element was appended to trigger download
    const anchorCall = appendChildSpy.mock.calls.find(
      (call) => (call[0] as HTMLElement).tagName === 'A'
    );
    expect(anchorCall).toBeDefined();

    // Verify URL was revoked
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
  });

  it('shows success toast after successful download', async () => {
    const user = userEvent.setup();
    const buttons = await renderAndWaitForInvoices();

    await user.click(buttons[0]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Invoice Downloaded',
        expect.objectContaining({
          description: expect.stringContaining('INV-2025-001'),
        })
      );
    });
  });

  it('shows error toast when download fails', async () => {
    const user = userEvent.setup();

    // Force createObjectURL to throw
    createObjectURLSpy.mockImplementation(() => {
      throw new Error('Blob creation failed');
    });

    const buttons = await renderAndWaitForInvoices();

    await user.click(buttons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Download Failed',
        expect.objectContaining({
          description: 'Could not download the invoice. Please try again.',
        })
      );
    });
  });

  it('re-enables button after download completes', async () => {
    const user = userEvent.setup();
    const buttons = await renderAndWaitForInvoices();

    // Both buttons should be enabled initially
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();

    await user.click(buttons[0]);

    // After download completes, button should be re-enabled
    await waitFor(() => {
      expect(buttons[0]).not.toBeDisabled();
    });
  });

  it('renders empty state when no invoices exist', async () => {
    setupInvoiceQueryMock([]);

    render(<BillingSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    });

    expect(screen.queryAllByRole('button', { name: /download invoice/i })).toHaveLength(0);
  });

  it('renders invoice amounts and status badges', async () => {
    render(<BillingSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      // $149.00 appears multiple times (plan price + invoice) — use getAllByText
      const amount149 = screen.getAllByText('$149.00');
      expect(amount149.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('PAID')).toBeInTheDocument();
      expect(screen.getByText('$99.00')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
  });

  it('generates HTML content with correct invoice data', async () => {
    const user = userEvent.setup();
    const buttons = await renderAndWaitForInvoices();

    await user.click(buttons[0]);

    await waitFor(() => {
      expect(capturedBlobContent).not.toBeNull();
    });

    const html = capturedBlobContent!;
    expect(html).toContain('INV-2025-001');
    expect(html).toContain('INVOICE');
    expect(html).toContain('FloraIQ');
    expect(html).toContain('Test Dispensary');
    expect(html).toContain('billing@test.com');
    expect(html).toContain('Professional Plan');
  });

  it('uses fallback invoice number in downloaded HTML when invoice_number is null', async () => {
    const user = userEvent.setup();
    const buttons = await renderAndWaitForInvoices();

    // Click download on the second invoice (null invoice_number)
    await user.click(buttons[1]);

    await waitFor(() => {
      expect(capturedBlobContent).not.toBeNull();
    });

    // Fallback: INV-<first 8 chars of id>
    expect(capturedBlobContent).toContain('INV-inv-002');
  });

  it('sets the download filename with invoice number', async () => {
    const user = userEvent.setup();
    const buttons = await renderAndWaitForInvoices();

    await user.click(buttons[0]);

    await waitFor(() => {
      const anchorCall = appendChildSpy.mock.calls.find(
        (call) => (call[0] as HTMLElement).tagName === 'A'
      );
      expect(anchorCall).toBeDefined();
      const anchor = anchorCall![0] as HTMLAnchorElement;
      expect(anchor.download).toBe('invoice-INV-2025-001.html');
      expect(anchor.href).toContain('blob:');
    });
  });

  it('loads invoices from edge function when available', async () => {
    mockFunctionsInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'check-stripe-config') {
        return Promise.resolve({
          data: { configured: true, valid: true, testMode: false },
          error: null,
        });
      }
      if (fnName === 'invoice-management') {
        return Promise.resolve({
          data: { invoices: [mockInvoices[0]] },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<BillingSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /download invoice/i });
      expect(buttons).toHaveLength(1);
    });

    // Direct query should not have been called for invoices
    expect(mockFrom).not.toHaveBeenCalledWith('invoices');
  });

  it('renders the Billing History section heading', async () => {
    render(<BillingSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Billing History')).toBeInTheDocument();
      expect(screen.getByText('Download past invoices')).toBeInTheDocument();
    });
  });
});

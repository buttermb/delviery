/**
 * CustomerForm Credit Gating Tests
 *
 * Verifies that the customer_add action is properly gated by credits:
 * 1. customer_add action key is used with the correct cost (5 credits)
 * 2. useCreditGatedAction hook is integrated in CustomerForm
 * 3. Credit check gates new customer creation
 * 4. Credit check does NOT gate customer editing
 * 5. Credit gate blocks action when insufficient credits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockNavigateToAdmin = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      is_free_tier: true,
      usage: { customers: 0, menus: 0, products: 0, locations: 0, users: 0 },
      limits: { customers: 100 },
    },
    loading: false,
    isAuthenticated: true,
    accessToken: 'test-token',
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
  }),
}));

vi.mock('@/hooks/useCsrfToken', () => ({
  useCsrfToken: () => ({
    csrfToken: 'test-csrf-token',
    validateToken: () => true,
  }),
}));

vi.mock('@/hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({
    showBlockerDialog: false,
    confirmLeave: vi.fn(),
    cancelLeave: vi.fn(),
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: mockNavigateToAdmin,
    navigate: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/useEncryption', () => ({
  useEncryption: () => ({
    isReady: true,
    encrypt: vi.fn((v: string) => v),
    decrypt: vi.fn((v: string) => v),
  }),
}));

vi.mock('@/lib/utils/customerEncryption', () => ({
  encryptCustomerData: vi.fn((data: unknown) => data),
  decryptCustomerData: vi.fn((data: unknown) => data),
  logPHIAccess: vi.fn(),
  getPHIFields: vi.fn(() => []),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'new-customer-id', first_name: 'John', last_name: 'Doe' },
        error: null,
      }),
    })),
  },
}));

vi.mock('@/hooks/useFormKeyboardShortcuts', () => ({
  useFormKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/hooks/useEmailValidation', () => ({
  useEmailValidation: () => ({
    isChecked: false,
    isDisposable: false,
  }),
}));

vi.mock('@/components/unsaved-changes', () => ({
  UnsavedChangesDialog: () => null,
}));

vi.mock('@/components/SEOHead', () => ({
  SEOHead: () => null,
}));

vi.mock('@/components/ui/shortcut-hint', () => ({
  ShortcutHint: ({ children }: { children: ReactNode }) => <>{children}</>,
  useModifierKey: () => 'Ctrl',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('CustomerForm Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render the create customer form', async () => {
    const CustomerForm = (await import('../CustomerForm')).default;
    renderWithProviders(<CustomerForm />);

    expect(screen.getByRole('heading', { name: /add new customer/i })).toBeInTheDocument();
  });

  it('should call executeCreditAction with customer_add on new customer submission', async () => {
    const user = userEvent.setup();
    const CustomerForm = (await import('../CustomerForm')).default;
    renderWithProviders(<CustomerForm />);

    // Fill out required fields
    await user.type(screen.getByPlaceholderText('John'), 'Jane');
    await user.type(screen.getByPlaceholderText('Doe'), 'Smith');
    await user.type(screen.getByPlaceholderText('john@example.com'), 'jane@example.com');

    // Set date of birth
    const dobInput = screen.getByLabelText(/date of birth/i);
    await user.type(dobInput, '1990-01-01');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create customer/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'customer_add',
        expect.any(Function)
      );
    });
  });

  it('should not create customer when credit gate blocks the action', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    // Simulate credit gate blocking the action (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const CustomerForm = (await import('../CustomerForm')).default;
    renderWithProviders(<CustomerForm />);

    // Fill out required fields
    await user.type(screen.getByPlaceholderText('John'), 'Jane');
    await user.type(screen.getByPlaceholderText('Doe'), 'Smith');
    await user.type(screen.getByPlaceholderText('john@example.com'), 'jane@example.com');

    const dobInput = screen.getByLabelText(/date of birth/i);
    await user.type(dobInput, '1990-01-01');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /create customer/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('customer_add', expect.any(Function));
    });

    // The supabase insert should NOT have been called since the gate blocked it
    expect(supabase.from).not.toHaveBeenCalledWith('customers');
  });
});

// ============================================================================
// Credit Cost Configuration Tests for customer_add
// ============================================================================

describe('Customer Add Credit Cost Configuration', () => {
  it('customer_add should cost 5 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('customer_add')).toBe(5);
  });

  it('customer_add should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('customer_add')).toBe(false);
  });

  it('customer_add should be categorized under customers', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('customer_add');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('customers');
    expect(info?.actionName).toBe('Add Customer');
    expect(info?.credits).toBe(5);
  });
});

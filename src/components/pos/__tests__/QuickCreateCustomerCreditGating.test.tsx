/**
 * QuickCreateCustomerDialog Credit Gating Tests
 *
 * Verifies that POS quick customer creation is gated by credits:
 * 1. customer_add action key (5 credits) is used
 * 2. useCreditGatedAction wraps the mutation
 * 3. Credit gate blocks creation when insufficient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

// ============================================================================
// Mocks
// ============================================================================

const mockExecute = vi.fn();
const mockOnSuccess = vi.fn();
const mockOnOpenChange = vi.fn();

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCredits', () => ({
  useCreditGatedAction: () => ({
    execute: mockExecute,
    isPerforming: false,
    isFreeTier: true,
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
  logPHIAccess: vi.fn(),
  getPHIFields: vi.fn(() => []),
}));

const mockInsert = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: 'new-customer-id',
        first_name: 'Jane',
        last_name: 'Smith',
        customer_type: 'recreational',
        loyalty_points: 0,
        email: 'jane@example.com',
        phone: null,
      },
      error: null,
    }),
  }),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  },
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
      {ui}
    </QueryClientProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('QuickCreateCustomerDialog Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should render the quick create customer dialog', async () => {
    const { QuickCreateCustomerDialog } = await import('../QuickCreateCustomerDialog');
    renderWithProviders(
      <QuickCreateCustomerDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        tenantId="test-tenant-id"
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Quick Add Customer')).toBeInTheDocument();
  });

  it('should call executeCreditAction with customer_add on submit', async () => {
    const user = userEvent.setup();
    const { QuickCreateCustomerDialog } = await import('../QuickCreateCustomerDialog');
    renderWithProviders(
      <QuickCreateCustomerDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        tenantId="test-tenant-id"
        onSuccess={mockOnSuccess}
      />
    );

    // Fill required fields
    const firstNameInputs = screen.getAllByPlaceholderText('John');
    await user.type(firstNameInputs[0], 'Jane');
    const lastNameInputs = screen.getAllByPlaceholderText('Doe');
    await user.type(lastNameInputs[0], 'Smith');

    // Submit the form
    const addBtn = screen.getByRole('button', { name: /add customer/i });
    await user.click(addBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'customer_add',
        expect.any(Function)
      );
    });
  });

  it('should not create customer when credit gate blocks', async () => {
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const { QuickCreateCustomerDialog } = await import('../QuickCreateCustomerDialog');
    renderWithProviders(
      <QuickCreateCustomerDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        tenantId="test-tenant-id"
        onSuccess={mockOnSuccess}
      />
    );

    // Fill required fields
    const firstNameInputs = screen.getAllByPlaceholderText('John');
    await user.type(firstNameInputs[0], 'Jane');
    const lastNameInputs = screen.getAllByPlaceholderText('Doe');
    await user.type(lastNameInputs[0], 'Smith');

    // Submit the form
    const addBtn = screen.getByRole('button', { name: /add customer/i });
    await user.click(addBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('customer_add', expect.any(Function));
    });

    // The supabase insert should NOT have been called
    expect(mockInsert).not.toHaveBeenCalled();
    // onSuccess callback should NOT have been called
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});

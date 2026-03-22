/**
 * AppointmentForm Credit Gating Tests
 *
 * Verifies that appointment creation is properly gated by credits:
 * 1. appointment_create action key is used with the correct cost (10 credits)
 * 2. useCreditGatedAction hook is integrated in AppointmentForm
 * 3. Credit check blocks action when insufficient credits
 * 4. Credit check allows action when sufficient credits
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
const mockInsert = vi.fn();

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
    },
    tenantSlug: 'test-tenant',
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
  useCredits: () => ({
    balance: 1000,
    isFreeTier: true,
    isLoading: false,
    canPerformAction: vi.fn().mockResolvedValue(true),
    performAction: vi.fn().mockResolvedValue({ success: true }),
    lifetimeSpent: 0,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
    }),
  },
}));

vi.mock('@/components/crm/ClientSelector', () => ({
  ClientSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="client-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select client</option>
      <option value="customer-1">Test Customer</option>
    </select>
  ),
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

describe('AppointmentForm Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockInsert.mockResolvedValue({ error: null });
  });

  it('should render the appointment form dialog', async () => {
    const { AppointmentForm } = await import('../AppointmentForm');
    renderWithProviders(
      <AppointmentForm open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByRole('heading', { name: /schedule appointment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /schedule appointment/i })).toBeInTheDocument();
  });

  it('should call executeCreditAction with appointment_create action key on submit', async () => {
    const user = userEvent.setup();
    const { AppointmentForm } = await import('../AppointmentForm');
    const onOpenChange = vi.fn();

    renderWithProviders(
      <AppointmentForm open={true} onOpenChange={onOpenChange} />
    );

    // Select a customer
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'customer-1');

    // Set date/time
    const dateInput = screen.getByLabelText(/date & time/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-04-01T10:00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /schedule appointment/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'appointment_create',
        expect.any(Function)
      );
    });
  });

  it('should not create appointment when credit gate blocks the action', async () => {
    // Simulate credit gate blocking the action (returns null)
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const { AppointmentForm } = await import('../AppointmentForm');

    renderWithProviders(
      <AppointmentForm open={true} onOpenChange={vi.fn()} />
    );

    // Select a customer
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'customer-1');

    // Set date/time
    const dateInput = screen.getByLabelText(/date & time/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-04-01T10:00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /schedule appointment/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('appointment_create', expect.any(Function));
    });

    // The insert should NOT have been called because the credit gate blocked it
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should create appointment when credit gate allows the action', async () => {
    const user = userEvent.setup();
    const { AppointmentForm } = await import('../AppointmentForm');

    renderWithProviders(
      <AppointmentForm open={true} onOpenChange={vi.fn()} />
    );

    // Select a customer
    const clientSelector = screen.getByTestId('client-selector');
    await user.selectOptions(clientSelector, 'customer-1');

    // Set date/time
    const dateInput = screen.getByLabelText(/date & time/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-04-01T10:00');

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /schedule appointment/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    // Verify the insert was called with expected appointment data
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        customer_id: 'customer-1',
        appointment_type: 'consultation',
        status: 'scheduled',
        duration_minutes: 30,
        account_id: 'test-tenant-id',
      }),
    ]);
  });
});

// ============================================================================
// Credit Cost Configuration Tests for appointment_create
// ============================================================================

describe('Appointment Credit Cost Configuration', () => {
  it('appointment_create should cost 10 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('appointment_create')).toBe(10);
  });

  it('appointment_create should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('appointment_create')).toBe(false);
  });

  it('appointment_create should be categorized under operations', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('appointment_create');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('operations');
    expect(info?.actionName).toBe('Create Appointment');
    expect(info?.credits).toBe(10);
  });
});

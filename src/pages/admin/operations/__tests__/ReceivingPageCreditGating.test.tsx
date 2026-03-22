/**
 * ReceivingPage Credit Gating Tests
 *
 * Verifies that the receiving log create action is properly gated by credits:
 * 1. receiving_log action key is used with the correct cost (10 credits)
 * 2. useCreditGatedAction hook is integrated in ReceivingPage
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

vi.mock('@/hooks/useLocations', () => ({
  useLocationOptions: () => ({
    options: [],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockSupabaseInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSupabaseSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'receiving_records') {
        return {
          select: mockSupabaseSelect,
          insert: mockSupabaseInsert,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    }),
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

describe('ReceivingPage Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
    mockSupabaseInsert.mockResolvedValue({ data: null, error: null });
  });

  it('should render the receiving page', async () => {
    const ReceivingPage = (await import('../../operations/ReceivingPage')).default;
    renderWithProviders(<ReceivingPage />);

    expect(screen.getByRole('heading', { name: /receiving & packaging/i })).toBeInTheDocument();
  });

  it('should call executeCreditAction with receiving_log action key on create', async () => {
    const user = userEvent.setup();
    const ReceivingPage = (await import('../../operations/ReceivingPage')).default;
    renderWithProviders(<ReceivingPage />);

    // Open the create dialog
    const newReceiptBtn = screen.getByRole('button', { name: /new receipt/i });
    await user.click(newReceiptBtn);

    // Fill required fields
    const shipmentInput = screen.getByLabelText(/shipment number/i);
    await user.type(shipmentInput, 'SHIP-2024-001');

    const vendorInput = screen.getByLabelText(/vendor/i);
    await user.type(vendorInput, 'Test Vendor');

    // Submit the form
    const createBtn = screen.getByRole('button', { name: /create receipt/i });
    await user.click(createBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'receiving_log',
        expect.any(Function)
      );
    });
  });

  it('should not create receipt when credit gate blocks the action', async () => {
    // Simulate credit gate blocking
    mockExecute.mockResolvedValue(null);

    const user = userEvent.setup();
    const ReceivingPage = (await import('../../operations/ReceivingPage')).default;
    renderWithProviders(<ReceivingPage />);

    // Open the create dialog
    const newReceiptBtn = screen.getByRole('button', { name: /new receipt/i });
    await user.click(newReceiptBtn);

    // Fill required fields
    const shipmentInput = screen.getByLabelText(/shipment number/i);
    await user.type(shipmentInput, 'SHIP-2024-001');

    const vendorInput = screen.getByLabelText(/vendor/i);
    await user.type(vendorInput, 'Test Vendor');

    // Submit the form
    const createBtn = screen.getByRole('button', { name: /create receipt/i });
    await user.click(createBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('receiving_log', expect.any(Function));
    });

    // The supabase insert should NOT have been called
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for receiving_log
// ============================================================================

describe('Receiving Log Credit Cost Configuration', () => {
  it('receiving_log should cost 10 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('receiving_log')).toBe(10);
  });

  it('receiving_log should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('receiving_log')).toBe(false);
  });

  it('receiving_log should be categorized under inventory', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('receiving_log');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('inventory');
    expect(info?.actionName).toBe('Log Received Inventory');
    expect(info?.credits).toBe(10);
  });

  it('receiving_view should be free (0 credits)', async () => {
    const { getCreditCost, isActionFree } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('receiving_view')).toBe(0);
    expect(isActionFree('receiving_view')).toBe(true);
  });
});

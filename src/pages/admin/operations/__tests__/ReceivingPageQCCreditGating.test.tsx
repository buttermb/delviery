/**
 * ReceivingPage QC Check Credit Gating Tests
 *
 * Verifies that the QC check logging action is properly gated by credits:
 * 1. qc_log_check action key is used with the correct cost (10 credits)
 * 2. useCreditGatedAction hook is integrated in ReceivingPage QC dialog
 * 3. Credit check blocks QC action when insufficient credits
 * 4. Credit check allows QC action when sufficient credits
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
const mockSupabaseUpdate = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseEq = vi.fn();

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

vi.mock('@/integrations/supabase/client', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  };

  return {
    supabase: {
      from: vi.fn().mockReturnValue(mockChain),
    },
  };
});

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

describe('ReceivingPage QC Check Credit Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockImplementation(
      async (_actionKey: string, action: () => Promise<unknown>) => {
        return action();
      }
    );
  });

  it('should import useCreditGatedAction from useCredits', async () => {
    // Verify ReceivingPage imports and initializes the hook
    const ReceivingPage = (await import('../ReceivingPage')).default;
    renderWithProviders(<ReceivingPage />);

    // The page should render without errors (hook is initialized)
    expect(screen.getByText('Receiving & Packaging')).toBeInTheDocument();
  });

  it('should call executeCreditAction with qc_log_check on QC submit', async () => {
    // Mock supabase to return a receipt with 'received' status
    const { supabase } = await import('@/integrations/supabase/client');
    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'receipt-1',
                shipment_number: 'SHIP-001',
                vendor: 'Test Vendor',
                received_date: '2026-03-22',
                status: 'received',
                expected_items: 10,
                notes: '',
                tenant_id: 'test-tenant-id',
                location: null,
              },
            ],
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    const user = userEvent.setup();
    const ReceivingPage = (await import('../ReceivingPage')).default;
    renderWithProviders(<ReceivingPage />);

    // Wait for receipts to load and find QC Check button
    await waitFor(() => {
      expect(screen.getByText('SHIP-001', { exact: false })).toBeInTheDocument();
    });

    const qcButton = screen.getByRole('button', { name: /qc check/i });
    await user.click(qcButton);

    // QC dialog should open
    await waitFor(() => {
      expect(screen.getByText('Quality Control Check')).toBeInTheDocument();
    });

    // Click Complete QC button
    const completeQcBtn = screen.getByRole('button', { name: /complete qc/i });
    await user.click(completeQcBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith(
        'qc_log_check',
        expect.any(Function)
      );
    });
  });

  it('should not update receipt when credit gate blocks the action', async () => {
    // Simulate credit gate blocking
    mockExecute.mockResolvedValue(null);

    const { supabase } = await import('@/integrations/supabase/client');
    const mockUpdateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const mockFrom = vi.mocked(supabase.from);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'receipt-1',
                shipment_number: 'SHIP-002',
                vendor: 'Test Vendor',
                received_date: '2026-03-22',
                status: 'received',
                expected_items: 5,
                notes: '',
                tenant_id: 'test-tenant-id',
                location: null,
              },
            ],
            error: null,
          }),
        }),
      }),
      update: mockUpdateFn,
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as ReturnType<typeof supabase.from>);

    const user = userEvent.setup();
    const ReceivingPage = (await import('../ReceivingPage')).default;
    renderWithProviders(<ReceivingPage />);

    // Wait for receipts to load
    await waitFor(() => {
      expect(screen.getByText('SHIP-002', { exact: false })).toBeInTheDocument();
    });

    // Open QC dialog
    const qcButton = screen.getByRole('button', { name: /qc check/i });
    await user.click(qcButton);

    await waitFor(() => {
      expect(screen.getByText('Quality Control Check')).toBeInTheDocument();
    });

    // Click Complete QC
    const completeQcBtn = screen.getByRole('button', { name: /complete qc/i });
    await user.click(completeQcBtn);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith('qc_log_check', expect.any(Function));
    });

    // The update mutation should NOT have been called (blocked by gate)
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Credit Cost Configuration Tests for qc_log_check
// ============================================================================

describe('QC Log Check Credit Cost Configuration', () => {
  it('qc_log_check should cost 10 credits', async () => {
    const { getCreditCost } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('qc_log_check')).toBe(10);
  });

  it('qc_log_check should not be a free action', async () => {
    const { isActionFree } = await import('@/lib/credits/creditCosts');
    expect(isActionFree('qc_log_check')).toBe(false);
  });

  it('qc_log_check should be categorized under operations', async () => {
    const { getCreditCostInfo } = await import('@/lib/credits/creditCosts');
    const info = getCreditCostInfo('qc_log_check');
    expect(info).not.toBeNull();
    expect(info?.category).toBe('operations');
    expect(info?.actionName).toBe('Log QC Check');
    expect(info?.credits).toBe(10);
  });

  it('qc_view should be free (0 credits)', async () => {
    const { getCreditCost, isActionFree } = await import('@/lib/credits/creditCosts');
    expect(getCreditCost('qc_view')).toBe(0);
    expect(isActionFree('qc_view')).toBe(true);
  });
});

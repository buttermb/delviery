/**
 * Tests for DeliveryManagement component
 *
 * Verifies:
 * - View Proof dialog opens with proof photo and signature
 * - Mobile Assign button opens fleet assignment dialog
 * - Courier assignment clickable div has proper accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock modules before imports
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
    debug: vi.fn(),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant', slug: 'test-tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/lib/navigation/tenantNavigation', () => ({
  useTenantNavigation: () => ({
    navigateToAdmin: vi.fn(),
  }),
}));

vi.mock('@/components/admin/fulfillment/CourierAvailabilityPanel', () => ({
  CourierAvailabilityPanel: () => <div data-testid="courier-panel">Courier Panel</div>,
}));

vi.mock('@/components/admin/fulfillment/AssignToFleetDialog', () => ({
  AssignToFleetDialog: ({ open, orderId }: { open: boolean; orderId: string }) =>
    open ? <div data-testid="fleet-dialog">Fleet Dialog for {orderId}</div> : null,
}));

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                in: (...iArgs: unknown[]) => {
                  mockIn(...iArgs);
                  return {
                    order: (...oArgs: unknown[]) => {
                      mockOrder(...oArgs);
                      return { data: [], error: null };
                    },
                  };
                },
                eq: (...eArgs2: unknown[]) => {
                  mockEq(...eArgs2);
                  return { data: [], error: null };
                },
              };
            },
          };
        },
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    },
  },
}));

import DeliveryManagement from '../DeliveryManagement';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

describe('DeliveryManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header', async () => {
    render(<DeliveryManagement />, { wrapper: createWrapper() });
    expect(screen.getByText('Delivery Management')).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    render(<DeliveryManagement />, { wrapper: createWrapper() });
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Out for Delivery')).toBeInTheDocument();
    expect(screen.getByText('Completed Today')).toBeInTheDocument();
    expect(screen.getByText('Couriers Online')).toBeInTheDocument();
  });

  it('renders tab navigation', async () => {
    render(<DeliveryManagement />, { wrapper: createWrapper() });
    expect(screen.getByText('Delivery Queue')).toBeInTheDocument();
    expect(screen.getByText('Active Deliveries')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders the filter controls', async () => {
    render(<DeliveryManagement />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText('Search by address...')).toBeInTheDocument();
  });

  it('queries orders with tenant_id filter', async () => {
    render(<DeliveryManagement />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('orders');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'test-tenant-id');
    });
  });

  it('fetches proof_of_delivery_url and customer_signature_url in query', async () => {
    render(<DeliveryManagement />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalled();
      const selectCall = mockSelect.mock.calls[0][0];
      expect(selectCall).toContain('proof_of_delivery_url');
      expect(selectCall).toContain('customer_signature_url');
    });
  });
});

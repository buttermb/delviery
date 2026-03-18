import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditDriverDialog } from '../EditDriverDialog';
import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => ({
    eq: vi.fn(() => ({ error: null })),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriersAdmin: { byTenant: (id: string) => ['couriers', id] },
    couriers: { detail: (id: string) => ['couriers', 'detail', id] },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDriver(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    id: 'driver-1',
    user_id: 'user-1',
    full_name: 'Jane Doe',
    display_name: 'JD',
    email: 'jane@example.com',
    phone: '5551234567',
    vehicle_type: 'car',
    vehicle_make: null,
    vehicle_model: null,
    vehicle_year: null,
    vehicle_color: null,
    vehicle_plate: null,
    zone_id: null,
    zone_name: null,
    status: 'active',
    availability: 'online',
    commission_rate: null,
    is_active: true,
    is_online: true,
    notes: 'Test notes',
    last_seen_at: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    suspended_at: null,
    suspended_until: null,
    suspend_reason: null,
    current_lat: null,
    current_lng: null,
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditDriverDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render content when closed', () => {
    renderWithProviders(
      <EditDriverDialog
        open={false}
        onOpenChange={vi.fn()}
        driver={makeDriver()}
        tenantId="tenant-1"
      />,
    );

    expect(screen.queryByText('Edit Driver Profile')).not.toBeInTheDocument();
  });

  it('renders form fields with driver data when open', () => {
    renderWithProviders(
      <EditDriverDialog
        open={true}
        onOpenChange={vi.fn()}
        driver={makeDriver()}
        tenantId="tenant-1"
      />,
    );

    expect(screen.getByText('Edit Driver Profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('JD')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5551234567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument();
  });

  it('resets form values when reopened with new driver data', () => {
    const onOpenChange = vi.fn();
    const driver1 = makeDriver({ full_name: 'Alice', email: 'alice@example.com' });
    const driver2 = makeDriver({ full_name: 'Bob', email: 'bob@example.com' });

    const { rerender } = renderWithProviders(
      <EditDriverDialog
        open={true}
        onOpenChange={onOpenChange}
        driver={driver1}
        tenantId="tenant-1"
      />,
    );

    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();

    // Close and reopen with different driver
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditDriverDialog
          open={true}
          onOpenChange={onOpenChange}
          driver={driver2}
          tenantId="tenant-1"
        />
      </QueryClientProvider>,
    );

    expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();
    expect(screen.getByDisplayValue('bob@example.com')).toBeInTheDocument();
  });

  it('shows Save Changes and Cancel buttons', () => {
    renderWithProviders(
      <EditDriverDialog
        open={true}
        onOpenChange={vi.fn()}
        driver={makeDriver()}
        tenantId="tenant-1"
      />,
    );

    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <EditDriverDialog
        open={true}
        onOpenChange={onOpenChange}
        driver={makeDriver()}
        tenantId="tenant-1"
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows validation error for empty full name', async () => {
    renderWithProviders(
      <EditDriverDialog
        open={true}
        onOpenChange={vi.fn()}
        driver={makeDriver()}
        tenantId="tenant-1"
      />,
    );

    const nameInput = screen.getByDisplayValue('Jane Doe');
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeInTheDocument();
    });
  });
});

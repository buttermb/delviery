import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileHeader } from '../ProfileHeader';
import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({ token: 'test-token' }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      })),
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

// Mock UI components with testable behavior
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: { children?: React.ReactNode; onClick?: () => void; [key: string]: unknown }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="dropdown-trigger" {...props}>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, disabled, ...props }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean; [key: string]: unknown }) => (
    <button data-testid="dropdown-item" onClick={onClick} disabled={disabled} role="menuitem" {...props}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// Track EditDriverDialog open state
const editDriverDialogMock = vi.fn();
vi.mock('@/components/drivers/profile/EditDriverDialog', () => ({
  EditDriverDialog: (props: { open: boolean; onOpenChange: (v: boolean) => void; driver: unknown; tenantId: string }) => {
    editDriverDialogMock(props);
    return props.open ? <div data-testid="edit-driver-dialog">EditDriverDialog</div> : null;
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
    display_name: null,
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
    notes: null,
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

describe('ProfileHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders driver name and contact info', () => {
    renderWithProviders(
      <ProfileHeader driver={makeDriver()} tenantId="tenant-1" />,
    );

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('5551234567')).toBeInTheDocument();
  });

  it('renders display_name when available', () => {
    renderWithProviders(
      <ProfileHeader
        driver={makeDriver({ display_name: 'Janey D' })}
        tenantId="tenant-1"
      />,
    );

    // Display name shown as heading (initials also show, so check the heading specifically)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Janey D');
  });

  it('renders Edit Profile dropdown item', () => {
    renderWithProviders(
      <ProfileHeader driver={makeDriver()} tenantId="tenant-1" />,
    );

    const items = screen.getAllByTestId('dropdown-item');
    const editItem = items.find((el) => el.textContent === 'Edit Profile');
    expect(editItem).toBeTruthy();
  });

  it('opens EditDriverDialog when Edit Profile is clicked', () => {
    renderWithProviders(
      <ProfileHeader driver={makeDriver()} tenantId="tenant-1" />,
    );

    // Dialog should not be visible initially
    expect(screen.queryByTestId('edit-driver-dialog')).not.toBeInTheDocument();

    // Click Edit Profile
    const items = screen.getAllByTestId('dropdown-item');
    const editItem = items.find((el) => el.textContent === 'Edit Profile');
    fireEvent.click(editItem!);

    // Dialog should now be visible
    expect(screen.getByTestId('edit-driver-dialog')).toBeInTheDocument();
  });

  it('passes correct props to EditDriverDialog', () => {
    const driver = makeDriver();
    renderWithProviders(
      <ProfileHeader driver={driver} tenantId="tenant-1" />,
    );

    // Click Edit Profile to open
    const items = screen.getAllByTestId('dropdown-item');
    const editItem = items.find((el) => el.textContent === 'Edit Profile');
    fireEvent.click(editItem!);

    // Verify props passed to dialog
    const lastCall = editDriverDialogMock.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      open: true,
      driver,
      tenantId: 'tenant-1',
    });
    expect(typeof lastCall.onOpenChange).toBe('function');
  });

  it('shows status badge', () => {
    renderWithProviders(
      <ProfileHeader driver={makeDriver({ status: 'active' })} tenantId="tenant-1" />,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows availability badge', () => {
    renderWithProviders(
      <ProfileHeader driver={makeDriver({ availability: 'on_delivery' })} tenantId="tenant-1" />,
    );

    expect(screen.getByText('On Delivery')).toBeInTheDocument();
  });

  it('shows online indicator when driver is online', () => {
    const { container } = renderWithProviders(
      <ProfileHeader driver={makeDriver({ availability: 'online' })} tenantId="tenant-1" />,
    );

    // Online indicator has animate-ping class
    const pingElement = container.querySelector('.animate-ping');
    expect(pingElement).toBeInTheDocument();
  });

  it('does not show online indicator when driver is offline', () => {
    const { container } = renderWithProviders(
      <ProfileHeader driver={makeDriver({ availability: 'offline' })} tenantId="tenant-1" />,
    );

    const pingElement = container.querySelector('.animate-ping');
    expect(pingElement).not.toBeInTheDocument();
  });
});

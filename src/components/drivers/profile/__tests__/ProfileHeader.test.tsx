import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({ token: 'mock-token' }),
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriersAdmin: { byTenant: (id: string) => ['couriers-admin', id] },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
    'aria-label': ariaLabel,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    'aria-label'?: string;
    [key: string]: unknown;
  }) => (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      data-variant={props.variant}
      data-size={props.size}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <div role="menuitem" onClick={disabled ? undefined : onClick}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/drivers/profile/EditDriverDialog', () => ({
  EditDriverDialog: () => null,
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};
vi.mock('sonner', () => ({
  toast: mockToast,
}));

// Mock window.open
const mockWindowOpen = vi.fn();

describe('ProfileHeader – Track button', () => {
  const baseDriver: DriverProfile = {
    id: 'driver-1',
    user_id: 'user-1',
    full_name: 'John Doe',
    display_name: null,
    email: 'john@example.com',
    phone: '+15551234567',
    vehicle_type: 'car',
    vehicle_make: 'Toyota',
    vehicle_model: 'Camry',
    vehicle_year: 2022,
    vehicle_color: 'White',
    vehicle_plate: 'ABC123',
    zone_id: 'zone-1',
    zone_name: 'Downtown',
    status: 'active',
    availability: 'online',
    commission_rate: 15,
    is_active: true,
    is_online: true,
    notes: null,
    last_seen_at: new Date().toISOString(),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    suspended_at: null,
    suspended_until: null,
    suspend_reason: null,
    current_lat: 34.0522,
    current_lng: -118.2437,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen.mockReset();
    Object.defineProperty(window, 'open', { value: mockWindowOpen, writable: true });
  });

  async function renderHeader(driverOverrides: Partial<DriverProfile> = {}) {
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const { ProfileHeader } = await import('@/components/drivers/profile/ProfileHeader');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const driver = { ...baseDriver, ...driverOverrides };
    return render(
      <QueryClientProvider client={client}>
        <ProfileHeader driver={driver} tenantId="tenant-1" />
      </QueryClientProvider>,
    );
  }

  it('renders the Track button', async () => {
    await renderHeader();
    const btn = screen.getByRole('button', { name: /track driver location/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Track');
  });

  it('opens Google Maps when driver has coordinates', async () => {
    await renderHeader({ current_lat: 34.0522, current_lng: -118.2437 });
    const btn = screen.getByRole('button', { name: /track driver location/i });

    fireEvent.click(btn);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://www.google.com/maps?q=34.0522,-118.2437',
      '_blank',
    );
  });

  it('is disabled when driver has no coordinates', async () => {
    await renderHeader({ current_lat: null, current_lng: null });
    const btn = screen.getByRole('button', { name: /track driver location/i });

    expect(btn).toBeDisabled();
  });

  it('shows tooltip explaining missing location when disabled', async () => {
    await renderHeader({ current_lat: null, current_lng: null });
    const btn = screen.getByRole('button', { name: /track driver location/i });

    expect(btn).toHaveAttribute('title', 'No location data available');
  });

  it('shows tooltip for enabled Track button', async () => {
    await renderHeader({ current_lat: 34.0522, current_lng: -118.2437 });
    const btn = screen.getByRole('button', { name: /track driver location/i });

    expect(btn).toHaveAttribute('title', 'Track driver on map');
  });

  it('is disabled when only lat is missing', async () => {
    await renderHeader({ current_lat: null, current_lng: -118.2437 });
    const btn = screen.getByRole('button', { name: /track driver location/i });

    expect(btn).toBeDisabled();
  });

  it('is disabled when only lng is missing', async () => {
    await renderHeader({ current_lat: 34.0522, current_lng: null });
    const btn = screen.getByRole('button', { name: /track driver location/i });

    expect(btn).toBeDisabled();
  });

  it('does not call window.open when button is disabled', async () => {
    await renderHeader({ current_lat: null, current_lng: null });
    const btn = screen.getByRole('button', { name: /track driver location/i });

    fireEvent.click(btn);

    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('handles coordinates at zero (valid location)', async () => {
    await renderHeader({ current_lat: 0, current_lng: 0 });
    const btn = screen.getByRole('button', { name: /track driver location/i });

    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://www.google.com/maps?q=0,0',
      '_blank',
    );
  });
});

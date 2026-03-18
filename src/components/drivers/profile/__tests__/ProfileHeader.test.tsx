import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ProfileHeader } from '../ProfileHeader';
import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({ token: 'test-token' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriersAdmin: { byTenant: (id: string) => ['couriers-admin', id] },
  },
}));

vi.mock('@/components/drivers/profile/EditDriverDialog', () => ({
  EditDriverDialog: () => <div data-testid="edit-dialog" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
  }: {
    children?: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      data-testid="dropdown-item"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
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
    phone: '+15551234567',
    vehicle_type: 'car',
    vehicle_make: null,
    vehicle_model: null,
    vehicle_year: null,
    vehicle_color: null,
    vehicle_plate: null,
    zone_id: null,
    zone_name: null,
    status: 'pending',
    availability: 'offline',
    commission_rate: null,
    is_active: true,
    is_online: false,
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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileHeader — Resend Invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Resend Invite dropdown item', () => {
    renderWithProviders(
      <ProfileHeader driver={makeDriver()} tenantId="tenant-1" />,
    );

    const items = screen.getAllByTestId('dropdown-item');
    const resendItem = items.find((el) =>
      el.textContent?.includes('Resend Invite'),
    );
    expect(resendItem).toBeDefined();
  });

  it('calls add-driver edge function with resend_invite flag on click', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    renderWithProviders(
      <ProfileHeader driver={makeDriver()} tenantId="tenant-1" />,
    );

    const items = screen.getAllByTestId('dropdown-item');
    const resendItem = items.find((el) =>
      el.textContent?.includes('Resend Invite'),
    )!;

    fireEvent.click(resendItem);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add-driver', {
        body: { resend_invite: true, driver_id: 'driver-1' },
        headers: { Authorization: 'Bearer test-token' },
      });
    });
  });

  it('disables Resend Invite when driver status is active', () => {
    renderWithProviders(
      <ProfileHeader
        driver={makeDriver({ status: 'active' })}
        tenantId="tenant-1"
      />,
    );

    const items = screen.getAllByTestId('dropdown-item');
    const resendItem = items.find((el) =>
      el.textContent?.includes('Resend Invite'),
    )!;

    expect(resendItem).toHaveAttribute('disabled');
  });

  it('is enabled when driver status is pending', () => {
    renderWithProviders(
      <ProfileHeader
        driver={makeDriver({ status: 'pending' })}
        tenantId="tenant-1"
      />,
    );

    const items = screen.getAllByTestId('dropdown-item');
    const resendItem = items.find((el) =>
      el.textContent?.includes('Resend Invite'),
    )!;

    expect(resendItem).not.toHaveAttribute('disabled');
  });

  it('shows loading text while mutation is pending', async () => {
    // Never resolve — keeps mutation pending
    mockInvoke.mockReturnValue(new Promise(() => {}));

    renderWithProviders(
      <ProfileHeader driver={makeDriver()} tenantId="tenant-1" />,
    );

    const items = screen.getAllByTestId('dropdown-item');
    const resendItem = items.find((el) =>
      el.textContent?.includes('Resend Invite'),
    )!;

    fireEvent.click(resendItem);

    await waitFor(() => {
      const updatedItems = screen.getAllByTestId('dropdown-item');
      const sendingItem = updatedItems.find((el) =>
        el.textContent?.includes('Sending'),
      );
      expect(sendingItem).toBeDefined();
    });
  });
});

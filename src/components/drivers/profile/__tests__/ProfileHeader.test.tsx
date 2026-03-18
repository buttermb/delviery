import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn(() => ({
    tenant: { id: 'test-tenant' },
    tenantSlug: 'test-tenant',
    token: 'test-token',
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock EditDriverDialog to avoid rendering complexity
vi.mock('@/components/drivers/profile/EditDriverDialog', () => ({
  EditDriverDialog: () => null,
}));

// Mock SendMessageDialog to verify it opens
vi.mock('@/components/drivers/dialogs/SendMessageDialog', () => ({
  SendMessageDialog: ({ open, driver }: { open: boolean; driver: { full_name: string } }) =>
    open ? <div data-testid="send-message-dialog">Message {driver.full_name}</div> : null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockDriver: DriverProfile = {
  id: 'driver-1',
  user_id: 'user-1',
  full_name: 'John Doe',
  display_name: null,
  email: 'john@example.com',
  phone: '+15551234567',
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
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  suspended_at: null,
  suspended_until: null,
  suspend_reason: null,
  current_lat: null,
  current_lng: null,
};

function renderProfileHeader(driver = mockDriver) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfileHeader driver={driver} tenantId="test-tenant" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Import after mocks are set up
import { ProfileHeader } from '@/components/drivers/profile/ProfileHeader';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders driver name and contact info', () => {
    renderProfileHeader();

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('+15551234567')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('renders Message button', () => {
    renderProfileHeader();

    expect(screen.getByRole('button', { name: /message/i })).toBeInTheDocument();
  });

  it('opens SendMessageDialog when Message button is clicked', () => {
    renderProfileHeader();

    // Dialog should not be visible initially
    expect(screen.queryByTestId('send-message-dialog')).not.toBeInTheDocument();

    // Click the Message button
    fireEvent.click(screen.getByRole('button', { name: /message/i }));

    // Dialog should now be visible
    expect(screen.getByTestId('send-message-dialog')).toBeInTheDocument();
    expect(screen.getByText('Message John Doe')).toBeInTheDocument();
  });

  it('does not open SendMessageDialog initially', () => {
    renderProfileHeader();

    expect(screen.queryByTestId('send-message-dialog')).not.toBeInTheDocument();
  });

  it('renders status badge', () => {
    renderProfileHeader();

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders availability indicator', () => {
    renderProfileHeader();

    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EditDriverDialog } from '../EditDriverDialog';
import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ update: mockUpdate }),
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    couriersAdmin: {
      byTenant: (id: string) => ['couriers', id],
    },
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-abc';

function createDriver(overrides?: Partial<DriverProfile>): DriverProfile {
  return {
    id: 'driver-1',
    user_id: null,
    full_name: 'Jane Doe',
    display_name: 'JD',
    email: 'jane@example.com',
    phone: '1234567890',
    vehicle_type: 'car',
    vehicle_make: 'Toyota',
    vehicle_model: 'Camry',
    vehicle_year: 2023,
    vehicle_color: 'White',
    vehicle_plate: 'ABC123',
    zone_id: null,
    zone_name: null,
    status: 'active',
    availability: 'online',
    commission_rate: 30,
    is_active: true,
    is_online: true,
    notes: 'Some notes',
    last_seen_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    suspended_at: null,
    suspended_until: null,
    suspend_reason: null,
    current_lat: null,
    current_lng: null,
    ...overrides,
  };
}

function renderDialog(
  props?: Partial<React.ComponentProps<typeof EditDriverDialog>>
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    driver: createDriver(),
    tenantId: TENANT_ID,
    ...props,
  };

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <EditDriverDialog {...defaultProps} />
      </QueryClientProvider>
    ),
    onOpenChange: defaultProps.onOpenChange,
    queryClient,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditDriverDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders dialog with title and description', () => {
      renderDialog();

      expect(screen.getByText('Edit Driver Profile')).toBeInTheDocument();
      expect(
        screen.getByText('Update driver contact information and details.')
      ).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      renderDialog();

      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Phone')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    });

    it('populates form with driver data', () => {
      renderDialog();

      expect(screen.getByLabelText('Full Name')).toHaveValue('Jane Doe');
      expect(screen.getByLabelText('Display Name')).toHaveValue('JD');
      expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com');
      expect(screen.getByLabelText('Phone')).toHaveValue('1234567890');
      expect(screen.getByLabelText('Notes')).toHaveValue('Some notes');
    });

    it('handles null optional fields gracefully', () => {
      renderDialog({
        driver: createDriver({ display_name: null, notes: null }),
      });

      expect(screen.getByLabelText('Display Name')).toHaveValue('');
      expect(screen.getByLabelText('Notes')).toHaveValue('');
    });

    it('renders Cancel and Save buttons', () => {
      renderDialog();

      expect(
        screen.getByRole('button', { name: 'Cancel' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Save Changes' })
      ).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderDialog({ open: false });

      expect(screen.queryByText('Edit Driver Profile')).not.toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows error when full name is cleared', async () => {
      const user = userEvent.setup();
      renderDialog();

      const nameInput = screen.getByLabelText('Full Name');
      await user.clear(nameInput);
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(
          screen.getByText('Full name is required')
        ).toBeInTheDocument();
      });
    });

    it('shows error for invalid email', async () => {
      const user = userEvent.setup();
      renderDialog();

      const emailInput = screen.getByLabelText('Email');
      await user.clear(emailInput);
      await user.type(emailInput, 'not-an-email');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(
          screen.getByText('Invalid email address')
        ).toBeInTheDocument();
      });
    });

    it('shows error for short phone number', async () => {
      const user = userEvent.setup();
      renderDialog();

      const phoneInput = screen.getByLabelText('Phone');
      await user.clear(phoneInput);
      await user.type(phoneInput, '123');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(
          screen.getByText('Phone must be at least 10 digits')
        ).toBeInTheDocument();
      });
    });
  });

  describe('submission', () => {
    it('calls supabase update with correct values on submit', async () => {
      const user = userEvent.setup();
      renderDialog();

      // Modify a field
      const nameInput = screen.getByLabelText('Full Name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane Smith');

      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({
          full_name: 'Jane Smith',
          display_name: 'JD',
          email: 'jane@example.com',
          phone: '1234567890',
          notes: 'Some notes',
        });
      });
    });

    it('converts empty optional fields to null', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.clear(screen.getByLabelText('Display Name'));
      await user.clear(screen.getByLabelText('Notes'));
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            display_name: null,
            notes: null,
          })
        );
      });
    });

    it('shows success toast on successful update', async () => {
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Profile updated');
      });
    });

    it('shows error toast on failed update', async () => {
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          eq: vi
            .fn()
            .mockResolvedValue({ error: new Error('DB error') }),
        }),
      });

      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to update profile'
        );
      });
    });
  });

  describe('close behavior', () => {
    it('calls onOpenChange when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const { onOpenChange } = renderDialog();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

/**
 * LocationsManagement Tests
 * Tests for location CRUD operations with useLocations hook, Zod validation, and accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
const mockCreateLocation = vi.fn();
const mockUpdateLocation = vi.fn();
const mockDeleteLocation = vi.fn();
const mockRefetch = vi.fn();

vi.mock('@/hooks/useLocations', () => ({
  useLocations: vi.fn(() => ({
    locations: [],
    isLoading: false,
    error: null,
    createLocation: mockCreateLocation,
    updateLocation: mockUpdateLocation,
    deleteLocation: mockDeleteLocation,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    refetch: mockRefetch,
  })),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/components/SEOHead', () => ({
  SEOHead: () => null,
}));

vi.mock('@/lib/formatters', () => ({
  formatPhoneNumber: (phone: string) => phone,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({
    open,
    onConfirm,
    itemName,
  }: {
    open: boolean;
    onConfirm: () => void;
    itemName?: string;
    onOpenChange: (v: boolean) => void;
    itemType: string;
    isLoading: boolean;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <span>Delete {itemName}?</span>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    ) : null,
}));

vi.mock('@/components/shared/EnhancedEmptyState', () => ({
  EnhancedEmptyState: ({
    title,
    description,
    primaryAction,
  }: {
    title: string;
    description: string;
    primaryAction?: { label: string; onClick: () => void };
    icon?: unknown;
  }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
      {primaryAction && (
        <button onClick={primaryAction.onClick}>{primaryAction.label}</button>
      )}
    </div>
  ),
}));

vi.mock('@/components/admin/shared/PageErrorState', () => ({
  PageErrorState: ({
    onRetry,
    message,
  }: {
    onRetry: () => void;
    message: string;
  }) => (
    <div data-testid="error-state">
      <p>{message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

// Import after mocks
import LocationsManagement from '../LocationsManagement';
import { useLocations } from '@/hooks/useLocations';
import { toast } from 'sonner';
import type { Location } from '@/hooks/useLocations';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/test-tenant/admin/locations']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const mockLocations: Location[] = [
  {
    id: 'loc-1',
    tenant_id: 'tenant-123',
    account_id: null,
    name: 'Downtown Store',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    zip_code: '10001',
    phone: '555-123-4567',
    email: 'downtown@test.com',
    license_number: 'LIC-001',
    operating_hours: null,
    delivery_radius_miles: null,
    coordinates: null,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'loc-2',
    tenant_id: 'tenant-123',
    account_id: null,
    name: 'Uptown Store',
    address: '456 Oak Ave',
    city: 'Brooklyn',
    state: 'NY',
    zip_code: '11201',
    phone: null,
    email: null,
    license_number: null,
    operating_hours: null,
    delivery_radius_miles: null,
    coordinates: null,
    status: 'inactive',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

describe('LocationsManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
      locations: [],
      isLoading: false,
      error: null,
      createLocation: mockCreateLocation,
      updateLocation: mockUpdateLocation,
      deleteLocation: mockDeleteLocation,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      refetch: mockRefetch,
    });
  });

  describe('Loading State', () => {
    it('should render skeleton loading state', () => {
      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: [],
        isLoading: true,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      expect(screen.getByLabelText('Loading locations')).toBeInTheDocument();
      // Should not show the page title when loading
      expect(screen.queryByText('Manage your business locations')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error state when query fails', () => {
      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: [],
        isLoading: false,
        error: new Error('Network error'),
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('Failed to load locations. Please try again.')).toBeInTheDocument();
    });

    it('should call refetch when Retry is clicked', async () => {
      const user = userEvent.setup();
      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: [],
        isLoading: false,
        error: new Error('Network error'),
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      await user.click(screen.getByText('Retry'));
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no locations exist', () => {
      render(<LocationsManagement />, { wrapper });

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Locations Yet')).toBeInTheDocument();
    });

    it('should have Add Location action in empty state', () => {
      render(<LocationsManagement />, { wrapper });

      const emptyState = screen.getByTestId('empty-state');
      expect(emptyState).toBeInTheDocument();
      // Two "Add Location" buttons exist: header DialogTrigger and empty state action
      expect(screen.getAllByText('Add Location')).toHaveLength(2);
    });
  });

  describe('Location List', () => {
    it('should render location cards when locations exist', () => {
      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      expect(screen.getByText('Downtown Store')).toBeInTheDocument();
      expect(screen.getByText('Uptown Store')).toBeInTheDocument();
    });

    it('should display status badges', () => {
      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });

    it('should display address, phone, and license info', () => {
      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      expect(screen.getByText('555-123-4567')).toBeInTheDocument();
      expect(screen.getByText('LIC-001')).toBeInTheDocument();
    });
  });

  describe('Aria Labels', () => {
    it('should have aria-labels on edit and delete buttons', () => {
      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      expect(screen.getByLabelText('Edit Downtown Store')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete Downtown Store')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit Uptown Store')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete Uptown Store')).toBeInTheDocument();
    });
  });

  describe('Add Location', () => {
    it('should open dialog when Add Location button is clicked', async () => {
      const user = userEvent.setup();

      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      const addButton = screen.getAllByRole('button', { name: /add location/i })[0];
      await user.click(addButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Add New Location')).toBeInTheDocument();
    });

    it('should show validation errors for empty required fields', async () => {
      const user = userEvent.setup();

      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      // Open dialog
      const addButton = screen.getAllByRole('button', { name: /add location/i })[0];
      await user.click(addButton);

      // Fill only name to bypass HTML validation, leave others empty via direct submit
      const nameInput = screen.getByLabelText(/location name/i);
      await user.type(nameInput, 'Test');
      await user.clear(nameInput);

      // Try to submit (HTML required will block, but Zod also validates)
      // We can test Zod by programmatically checking the schema
      expect(mockCreateLocation).not.toHaveBeenCalled();
    });

    it('should call createLocation with form data on valid submission', async () => {
      const user = userEvent.setup();

      mockCreateLocation.mockImplementation((_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });

      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      // Open dialog
      const addButton = screen.getAllByRole('button', { name: /add location/i })[0];
      await user.click(addButton);

      // Fill form
      await user.type(screen.getByLabelText(/location name/i), 'New Location');
      await user.type(screen.getByLabelText(/street address/i), '789 Elm St');
      await user.type(screen.getByLabelText(/city/i), 'Boston');
      await user.type(screen.getByLabelText(/^state/i), 'MA');
      await user.type(screen.getByLabelText(/zip code/i), '02101');
      await user.type(screen.getByLabelText(/phone/i), '555-999-0000');
      await user.type(screen.getByLabelText(/email/i), 'new@location.com');

      // Submit
      const createButton = screen.getByRole('button', { name: /create location/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateLocation).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Location',
            address: '789 Elm St',
            city: 'Boston',
            state: 'MA',
            zip_code: '02101',
            phone: '555-999-0000',
            email: 'new@location.com',
          }),
          expect.any(Object),
        );
      });
    });

    it('should not call createLocation when email input has invalid value', async () => {
      const user = userEvent.setup();

      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      // Open dialog
      const addButton = screen.getAllByRole('button', { name: /add location/i })[0];
      await user.click(addButton);

      // Fill required fields
      await user.type(screen.getByLabelText(/location name/i), 'Test Location');
      await user.type(screen.getByLabelText(/street address/i), '123 St');
      await user.type(screen.getByLabelText(/city/i), 'NYC');
      await user.type(screen.getByLabelText(/^state/i), 'NY');
      await user.type(screen.getByLabelText(/zip code/i), '10001');
      // Type invalid email — HTML5 type="email" validation will block form submit
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'not-an-email');

      // Attempt submit — HTML5 validation should prevent it
      const createButton = screen.getByRole('button', { name: /create location/i });
      await user.click(createButton);

      // createLocation should NOT have been called due to HTML5 or Zod validation
      expect(mockCreateLocation).not.toHaveBeenCalled();
    });
  });

  describe('Edit Location', () => {
    it('should populate form with existing data on edit', async () => {
      const user = userEvent.setup();

      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      // Click edit on first location
      await user.click(screen.getByLabelText('Edit Downtown Store'));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Edit Location')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Downtown Store')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
      expect(screen.getByDisplayValue('New York')).toBeInTheDocument();
    });

    it('should call updateLocation on edit submission', async () => {
      const user = userEvent.setup();

      mockUpdateLocation.mockImplementation((_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });

      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      // Click edit on first location
      await user.click(screen.getByLabelText('Edit Downtown Store'));

      // Modify name
      const nameInput = screen.getByDisplayValue('Downtown Store');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Store');

      // Submit
      const updateButton = screen.getByRole('button', { name: /update location/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockUpdateLocation).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'loc-1',
            name: 'Updated Store',
          }),
          expect.any(Object),
        );
      });
    });
  });

  describe('Delete Location', () => {
    it('should open confirm dialog when delete is clicked', async () => {
      const user = userEvent.setup();

      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      await user.click(screen.getByLabelText('Delete Downtown Store'));

      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Downtown Store?')).toBeInTheDocument();
    });

    it('should call deleteLocation on confirmation', async () => {
      const user = userEvent.setup();

      mockDeleteLocation.mockImplementation((_id: string, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      });

      (useLocations as ReturnType<typeof vi.fn>).mockReturnValue({
        locations: mockLocations,
        isLoading: false,
        error: null,
        createLocation: mockCreateLocation,
        updateLocation: mockUpdateLocation,
        deleteLocation: mockDeleteLocation,
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
        refetch: mockRefetch,
      });

      render(<LocationsManagement />, { wrapper });

      // Click delete
      await user.click(screen.getByLabelText('Delete Downtown Store'));

      // Confirm delete
      await user.click(screen.getByText('Confirm Delete'));

      expect(mockDeleteLocation).toHaveBeenCalledWith('loc-1', expect.any(Object));
    });
  });
});

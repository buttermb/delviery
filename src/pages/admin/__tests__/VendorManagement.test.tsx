/**
 * VendorManagement Tests
 * Tests for vendor CRUD with React Hook Form + Zod validation and Supabase types
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
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

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({ open, onConfirm, itemName }: { open: boolean; onConfirm: () => void; itemName?: string }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <span>Delete {itemName}?</span>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    ) : null,
}));

vi.mock('@/components/admin/shared/PageErrorState', () => ({
  PageErrorState: ({ message, onRetry }: { message?: string; onRetry?: () => void }) => (
    <div data-testid="page-error-state" role="alert">
      <p>{message ?? 'Something went wrong'}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import { VendorManagement } from '../VendorManagement';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/vendors']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const mockVendors = [
  {
    id: 'vendor-1',
    name: 'Test Vendor 1',
    contact_name: 'John Doe',
    contact_email: 'john@vendor.com',
    contact_phone: '555-1234',
    address: '123 Main St',
    city: 'Denver',
    state: 'CO',
    zip_code: '80202',
    license_number: 'LIC-001',
    tax_id: null,
    payment_terms: 'Net 30',
    notes: 'Good vendor',
    status: 'active',
    account_id: 'tenant-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'vendor-2',
    name: 'Test Vendor 2',
    contact_name: 'Jane Smith',
    contact_email: 'jane@vendor.com',
    contact_phone: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
    license_number: null,
    tax_id: null,
    payment_terms: null,
    notes: null,
    status: 'inactive',
    account_id: 'tenant-123',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

function setupSupabaseMock(vendors = mockVendors) {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteMock = vi.fn().mockReturnThis();
  const eqMock = vi.fn().mockReturnThis();

  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: eqMock,
    order: vi.fn().mockResolvedValue({ data: vendors, error: null }),
    update: vi.fn().mockReturnThis(),
    insert: insertMock,
    delete: deleteMock,
  });

  return { insertMock, deleteMock, eqMock };
}

describe('VendorManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    setupSupabaseMock([]);
  });

  describe('Initial Render', () => {
    it('should render loading skeleton when accountLoading is true', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        tenant: null,
        loading: true,
        admin: null,
        tenantSlug: null,
      });

      render(<VendorManagement />, { wrapper });

      expect(screen.getByRole('status', { name: /loading vendors/i })).toBeInTheDocument();
    });

    it('should render empty state when no vendors exist', async () => {
      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });
    });

    it('should render vendor list when vendors exist', async () => {
      setupSupabaseMock();

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Vendor 1')).toBeInTheDocument();
        expect(screen.getByText('Test Vendor 2')).toBeInTheDocument();
      });
    });

    it('should display vendor contact info and address', async () => {
      setupSupabaseMock();

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@vendor.com')).toBeInTheDocument();
        expect(screen.getByText('555-1234')).toBeInTheDocument();
        expect(screen.getByText('123 Main St, Denver, CO, 80202')).toBeInTheDocument();
      });
    });

    it('should display license number and payment terms', async () => {
      setupSupabaseMock();

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('LIC-001')).toBeInTheDocument();
        expect(screen.getByText('Net 30')).toBeInTheDocument();
      });
    });

    it('should show correct status badges', async () => {
      setupSupabaseMock();

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
        expect(screen.getByText('inactive')).toBeInTheDocument();
      });
    });
  });

  describe('Add Vendor', () => {
    it('should open dialog when Add Vendor button is clicked', async () => {
      const user = userEvent.setup();
      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });

      const addButton = screen.getAllByRole('button', { name: /add vendor/i })[0];
      await user.click(addButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Add New Vendor')).toBeInTheDocument();
    });

    it('should show form fields for all vendor data', async () => {
      const user = userEvent.setup();
      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });

      const addButton = screen.getAllByRole('button', { name: /add vendor/i })[0];
      await user.click(addButton);

      // Verify form fields
      expect(screen.getByLabelText(/vendor name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/contact name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^address$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/zip code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/license number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tax id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/payment terms/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it('should validate vendor name is required', async () => {
      const user = userEvent.setup();
      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });

      const addButton = screen.getAllByRole('button', { name: /add vendor/i })[0];
      await user.click(addButton);

      // Submit without filling the name field
      const createButton = screen.getByRole('button', { name: /create vendor/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Vendor name is required')).toBeInTheDocument();
      });
    });

    it('should not submit form with invalid email', async () => {
      const user = userEvent.setup();
      const { insertMock } = setupSupabaseMock([]);

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });

      const addButton = screen.getAllByRole('button', { name: /add vendor/i })[0];
      await user.click(addButton);

      await user.type(screen.getByLabelText(/vendor name/i), 'Test Vendor');
      await user.type(screen.getByLabelText(/email/i), 'not-an-email');

      const createButton = screen.getByRole('button', { name: /create vendor/i });
      await user.click(createButton);

      // Wait a tick for any async validation to resolve
      await waitFor(() => {
        // The form should NOT have submitted with invalid email
        expect(insertMock).not.toHaveBeenCalled();
      });

      // Dialog should still be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should submit form with correct data', async () => {
      const user = userEvent.setup();
      const { insertMock } = setupSupabaseMock([]);

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });

      const addButton = screen.getAllByRole('button', { name: /add vendor/i })[0];
      await user.click(addButton);

      await user.type(screen.getByLabelText(/vendor name/i), 'New Vendor');
      await user.type(screen.getByLabelText(/contact name/i), 'Contact Person');
      await user.type(screen.getByLabelText(/email/i), 'vendor@test.com');

      const createButton = screen.getByRole('button', { name: /create vendor/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Vendor',
            contact_name: 'Contact Person',
            contact_email: 'vendor@test.com',
            account_id: 'tenant-123',
          })
        );
      });
    });
  });

  describe('Edit Vendor', () => {
    it('should open dialog with pre-filled data when edit button is clicked', async () => {
      const user = userEvent.setup();
      setupSupabaseMock();

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Vendor 1')).toBeInTheDocument();
      });

      const editButton = screen.getByLabelText('Edit Test Vendor 1');
      await user.click(editButton);

      expect(screen.getByText('Edit Vendor')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Vendor 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('john@vendor.com')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Vendor', () => {
    it('should open confirm dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      setupSupabaseMock();

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Vendor 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete Test Vendor 1');
      await user.click(deleteButton);

      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Test Vendor 1?')).toBeInTheDocument();
    });
  });

  describe('Tenant Context', () => {
    it('should filter vendors by account_id', async () => {
      const { eqMock } = setupSupabaseMock([]);

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('account_id', 'tenant-123');
      });
    });

    it('should call supabase.from with vendors table', async () => {
      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('vendors');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error state when query fails', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error', code: '42000' } }),
      });

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId('page-error-state')).toBeInTheDocument();
        expect(screen.getByText(/failed to load vendors/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });
});

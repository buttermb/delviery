/**
 * VendorManagement Tests
 * Tests for vendor CRUD operations with type-safe Supabase operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

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

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn().mockReturnValue({
    toast: vi.fn(),
  }),
}));

vi.mock('@/components/SEOHead', () => ({
  SEOHead: () => null,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
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
import VendorManagement from '../VendorManagement';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/test-tenant/admin/vendors']}>
    {children}
  </MemoryRouter>
);

describe('VendorManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset useTenantAdminAuth mock to default
    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    // Reset supabase mock
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
    });
  });

  describe('Initial Render', () => {
    it('should render loading state when accountLoading is true', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        tenant: null,
        loading: true,
        admin: null,
        tenantSlug: null,
      });

      render(<VendorManagement />, { wrapper });

      // Loading state shows a spinner
      const spinnerContainer = document.querySelector('.animate-spin');
      expect(spinnerContainer).toBeInTheDocument();
    });

    it('should render empty state when no vendors exist', async () => {
      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });
      expect(screen.getByText('Add your first vendor to get started')).toBeInTheDocument();
    });

    it('should render vendor list when vendors exist', async () => {
      const mockVendors = [
        {
          id: 'vendor-1',
          name: 'Test Vendor 1',
          contact_name: 'John Doe',
          email: 'john@vendor.com',
          phone: '555-1234',
          status: 'active',
        },
        {
          id: 'vendor-2',
          name: 'Test Vendor 2',
          contact_name: 'Jane Smith',
          email: 'jane@vendor.com',
          status: 'inactive',
        },
      ];

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockVendors, error: null }),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Vendor 1')).toBeInTheDocument();
        expect(screen.getByText('Test Vendor 2')).toBeInTheDocument();
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

    it('should submit form with correct data using Record<string, unknown> type cast', async () => {
      const user = userEvent.setup();
      const mockToast = vi.fn();
      (useToast as ReturnType<typeof vi.fn>).mockReturnValue({ toast: mockToast });

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        update: vi.fn().mockReturnThis(),
        insert: insertMock,
        delete: vi.fn().mockReturnThis(),
      });

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });

      // Open dialog
      const addButton = screen.getAllByRole('button', { name: /add vendor/i })[0];
      await user.click(addButton);

      // Fill form
      await user.type(screen.getByLabelText(/vendor name/i), 'New Vendor');
      await user.type(screen.getByLabelText(/contact name/i), 'Contact Person');
      await user.type(screen.getByLabelText(/email/i), 'vendor@test.com');

      // Submit
      const createButton = screen.getByRole('button', { name: /create vendor/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalled();
      });
    });
  });

  describe('Type Safety', () => {
    it('should handle formData with Record<string, unknown> type cast in insert', async () => {
      // This test verifies the type cast doesn't break runtime behavior
      const user = userEvent.setup();

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: insertMock,
      });

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No vendors yet')).toBeInTheDocument();
      });

      // Open dialog
      const addButton = screen.getAllByRole('button', { name: /add vendor/i })[0];
      await user.click(addButton);

      // Fill required field
      await user.type(screen.getByLabelText(/vendor name/i), 'Type Safe Vendor');

      // Submit
      const createButton = screen.getByRole('button', { name: /create vendor/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Type Safe Vendor',
            tenant_id: 'tenant-123',
          })
        );
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
    it('should handle database errors gracefully', async () => {
      const { handleError } = await import('@/utils/errorHandling/handlers');

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') }),
      });

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(handleError).toHaveBeenCalled();
      });
    });

    it('should show loading spinner without tenant context', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: null,
        tenantSlug: null,
      });

      render(<VendorManagement />, { wrapper });

      // Component renders loading state when tenant is null and loading is false
      // because `loading` useState is initialized to true and only set to false
      // after loadVendors completes - but loadVendors returns early without tenant
      const spinnerContainer = document.querySelector('.animate-spin');
      expect(spinnerContainer).toBeInTheDocument();
    });
  });

  describe('Tenant Context', () => {
    it('should filter vendors by tenant_id', async () => {
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
        eq: eqMock,
        order: orderMock,
      });

      render(<VendorManagement />, { wrapper });

      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });
  });
});

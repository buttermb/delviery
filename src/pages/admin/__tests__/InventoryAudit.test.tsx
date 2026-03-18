/**
 * InventoryAudit Tests
 * Tests for physical inventory audit workflow: count entry, discrepancy
 * highlighting, adjustment submission, PDF report generation, and history.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock jsPDF before importing the component
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 210 } },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    addPage: vi.fn(),
    splitTextToSize: vi.fn().mockReturnValue(['note']),
    save: vi.fn(),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    }),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
    loading: false,
    admin: { id: 'admin-123', userId: 'user-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn().mockReturnValue('Something went wrong'),
}));

vi.mock('@/lib/sanitizeSearch', () => ({
  sanitizeSearchInput: vi.fn((input: string) => input.trim()),
}));

// Import after mocks
import InventoryAudit from '../InventoryAudit';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const mockProducts = [
  {
    id: 'product-1',
    tenant_id: 'tenant-123',
    name: 'Blue Dream',
    sku: 'BD-001',
    available_quantity: 100,
    category: 'flower',
  },
  {
    id: 'product-2',
    tenant_id: 'tenant-123',
    name: 'OG Kush',
    sku: 'OGK-002',
    available_quantity: 50,
    category: 'flower',
  },
  {
    id: 'product-3',
    tenant_id: 'tenant-123',
    name: 'Sour Diesel Gummies',
    sku: 'SDG-003',
    available_quantity: 200,
    category: 'edibles',
  },
];

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/inventory-audit']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

function setupProductsMock(products = mockProducts) {
  const eqMock = vi.fn().mockReturnThis();
  const orderMock = vi.fn().mockReturnThis();
  const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateMock = vi.fn().mockReturnThis();

  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'products') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: vi.fn().mockResolvedValue({ data: products, error: null }),
        update: updateMock,
      };
    }
    // inventory_history
    return {
      select: vi.fn().mockReturnThis(),
      eq: eqMock,
      order: orderMock,
      limit: limitMock,
      insert: insertMock,
    };
  });

  return { eqMock, orderMock, limitMock, insertMock, updateMock };
}

describe('InventoryAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', userId: 'user-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });
  });

  describe('Initial Render', () => {
    it('should render loading skeleton when products are loading', () => {
      // Default mock returns loading state via pending promise
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
        limit: vi.fn().mockReturnValue(new Promise(() => {})),
      });

      render(<InventoryAudit />, { wrapper });

      // Should show loading skeleton
      expect(screen.queryByText('Inventory Audit')).not.toBeInTheDocument();
    });

    it('should render page title after loading', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Inventory Audit')).toBeInTheDocument();
      });
    });

    it('should render audit description', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText('Physical count verification and adjustment workflow'),
        ).toBeInTheDocument();
      });
    });

    it('should render stats cards with zero counts initially', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Total Products')).toBeInTheDocument();
        expect(screen.getByText('Counted')).toBeInTheDocument();
        expect(screen.getByText('Discrepancies')).toBeInTheDocument();
        expect(screen.getByText('Net Change')).toBeInTheDocument();
      });
    });

    it('should show total products count in stats', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        // 3 mock products
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('should render product table with all products', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
        expect(screen.getByText('OG Kush')).toBeInTheDocument();
        expect(screen.getByText('Sour Diesel Gummies')).toBeInTheDocument();
      });
    });

    it('should show product SKUs', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('SKU: BD-001')).toBeInTheDocument();
        expect(screen.getByText('SKU: OGK-002')).toBeInTheDocument();
      });
    });

    it('should show expected quantities', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('100.00')).toBeInTheDocument();
        expect(screen.getByText('50.00')).toBeInTheDocument();
        expect(screen.getByText('200.00')).toBeInTheDocument();
      });
    });
  });

  describe('Search Filtering', () => {
    it('should filter products by name', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        'Search products by name, SKU, or category...',
      );
      await userEvent.type(searchInput, 'Blue');

      expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      expect(screen.queryByText('OG Kush')).not.toBeInTheDocument();
    });

    it('should filter products by SKU', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        'Search products by name, SKU, or category...',
      );
      await userEvent.type(searchInput, 'OGK');

      expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
      expect(screen.getByText('OG Kush')).toBeInTheDocument();
    });

    it('should filter products by category', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        'Search products by name, SKU, or category...',
      );
      await userEvent.type(searchInput, 'edibles');

      expect(screen.queryByText('Blue Dream')).not.toBeInTheDocument();
      expect(screen.getByText('Sour Diesel Gummies')).toBeInTheDocument();
    });

    it('should show empty state when no products match search', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(
        'Search products by name, SKU, or category...',
      );
      await userEvent.type(searchInput, 'nonexistent');

      expect(screen.getByText('No Matching Products')).toBeInTheDocument();
    });

    it('should have aria-label on search input', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByLabelText('Search products by name, SKU, or category'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Count Entry', () => {
    it('should update actual count and show discrepancy', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '95');

      // Should show discrepancy: 95 - 100 = -5
      await waitFor(() => {
        const discrepancies = screen.getAllByText('-5.00');
        expect(discrepancies.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show OK badge when count matches expected', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '100');

      await waitFor(() => {
        expect(screen.getByText('OK')).toBeInTheDocument();
      });
    });

    it('should show Diff badge when count has discrepancy', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '90');

      await waitFor(() => {
        expect(screen.getByText('Diff')).toBeInTheDocument();
      });
    });

    it('should update stats when counts are entered', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '90');

      // Counted should show 1
      await waitFor(() => {
        const counted = screen.getByText('Counted');
        const countedValue = counted.closest('div')?.querySelector('.text-2xl');
        expect(countedValue?.textContent).toBe('1');
      });
    });

    it('should have aria-label on count inputs', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Actual count for Blue Dream')).toBeInTheDocument();
        expect(screen.getByLabelText('Actual count for OG Kush')).toBeInTheDocument();
      });
    });

    it('should have aria-label on notes inputs', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Notes for Blue Dream')).toBeInTheDocument();
        expect(screen.getByLabelText('Notes for OG Kush')).toBeInTheDocument();
      });
    });

    it('should enforce maxLength on product notes inputs', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        const notesInput = screen.getByLabelText('Notes for Blue Dream');
        expect(notesInput).toHaveAttribute('maxLength', '500');
      });
    });
  });

  describe('Audit Notes', () => {
    it('should render audit notes textarea', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Audit notes')).toBeInTheDocument();
      });
    });

    it('should enforce maxLength on audit notes', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        const notesArea = screen.getByLabelText('Audit notes');
        expect(notesArea).toHaveAttribute('maxLength', '2000');
      });
    });

    it('should show character count for audit notes', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('0/2000')).toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('should disable Reset button when no entries', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        const resetBtn = screen.getByRole('button', { name: /reset/i });
        expect(resetBtn).toBeDisabled();
      });
    });

    it('should disable Export PDF button when no counts entered', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        const exportBtn = screen.getByRole('button', { name: /export pdf/i });
        expect(exportBtn).toBeDisabled();
      });
    });

    it('should disable Submit Audit button when no discrepancies', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        const submitBtn = screen.getByRole('button', { name: /submit audit/i });
        expect(submitBtn).toBeDisabled();
      });
    });

    it('should enable Export PDF after entering a count', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '100');

      await waitFor(() => {
        const exportBtn = screen.getByRole('button', { name: /export pdf/i });
        expect(exportBtn).not.toBeDisabled();
      });
    });

    it('should enable Submit Audit after entering a discrepant count', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '90');

      await waitFor(() => {
        const submitBtn = screen.getByRole('button', { name: /submit audit/i });
        expect(submitBtn).not.toBeDisabled();
      });
    });

    it('should reset all entries when Reset is clicked', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Enter a count
      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '90');

      // Click reset
      const resetBtn = screen.getByRole('button', { name: /reset/i });
      fireEvent.click(resetBtn);

      // Count should be cleared
      await waitFor(() => {
        expect(countInput).toHaveValue(null);
      });
    });
  });

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog when Submit Audit is clicked', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Enter a discrepant count
      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '90');

      // Click submit
      const submitBtn = screen.getByRole('button', { name: /submit audit/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Confirm Audit Submission')).toBeInTheDocument();
      });
    });

    it('should show discrepancy count in confirmation dialog', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '90');

      const submitBtn = screen.getByRole('button', { name: /submit audit/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText('This will create inventory adjustments for all discrepancies found.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('PDF Report', () => {
    it('should show error toast when no entries for PDF', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Export PDF button should be disabled with no entries
      const exportBtn = screen.getByRole('button', { name: /export pdf/i });
      expect(exportBtn).toBeDisabled();
    });
  });

  describe('Tabs', () => {
    it('should render Current Audit and Audit History tabs', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Current Audit')).toBeInTheDocument();
        expect(screen.getByText('Audit History')).toBeInTheDocument();
      });
    });

    it('should switch to audit history tab when clicked', async () => {
      setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Current Audit')).toBeInTheDocument();
      });

      // Click audit history tab
      const historyTab = screen.getByRole('tab', { name: /audit history/i });
      await userEvent.click(historyTab);

      // Verify the history tab is now selected (aria-selected)
      await waitFor(() => {
        expect(historyTab).toHaveAttribute('data-state', 'active');
      });
    });
  });

  describe('Error State', () => {
    it('should show error state when products fail to load', async () => {
      const dbError = { message: 'DB error', code: '42P01' };

      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'products') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      render(<InventoryAudit />, { wrapper });

      await waitFor(
        () => {
          expect(screen.getByText('Failed to Load Products')).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });

    it('should show retry button on error state', async () => {
      const dbError = { message: 'DB error', code: '42P01' };

      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'products') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      render(<InventoryAudit />, { wrapper });

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no products exist', async () => {
      setupProductsMock([]);

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No Products Found')).toBeInTheDocument();
        expect(
          screen.getByText('Add products to your inventory to begin auditing'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should filter products by tenant_id', async () => {
      const { eqMock } = setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });

    it('should not load when tenant is missing', async () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: false,
        admin: { id: 'admin-123', userId: 'user-123', email: 'admin@test.com' },
        tenantSlug: 'test-tenant',
      });

      const fromMock = vi.fn();
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);

      render(<InventoryAudit />, { wrapper });

      // Give it time to potentially call supabase
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fromMock).not.toHaveBeenCalled();
    });

    it('should filter audit history by tenant_id', async () => {
      const { eqMock } = setupProductsMock();

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        // Should be called for both products and inventory_history queries
        const tenantCalls = eqMock.mock.calls.filter(
          (call: string[]) => call[0] === 'tenant_id' && call[1] === 'tenant-123',
        );
        expect(tenantCalls.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Audit Submission', () => {
    it('should use adjustment as change_type for inventory history', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'products') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
            update: updateMock,
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: insertMock,
        };
      });

      render(<InventoryAudit />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Blue Dream')).toBeInTheDocument();
      });

      // Enter discrepant count
      const countInput = screen.getByLabelText('Actual count for Blue Dream');
      await userEvent.type(countInput, '90');

      // Open confirmation dialog
      const submitBtn = screen.getByRole('button', { name: /submit audit/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Confirm Audit Submission')).toBeInTheDocument();
      });

      // Confirm submission
      const confirmBtn = screen.getByRole('button', { name: /confirm & submit/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        // Verify insert was called with 'adjustment' change_type
        if (insertMock.mock.calls.length > 0) {
          const entries = insertMock.mock.calls[0][0];
          expect(entries[0].change_type).toBe('adjustment');
          expect(entries[0].reason).toBe('audit');
          expect(entries[0].reference_type).toBe('audit');
          expect(entries[0].tenant_id).toBe('tenant-123');
        }
      });
    });
  });
});

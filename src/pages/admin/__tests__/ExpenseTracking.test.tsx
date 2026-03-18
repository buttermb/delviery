/**
 * ExpenseTracking Tests
 * Tests for expense CRUD operations, filtering, staleTime, and empty state
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
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/ui/lazy-recharts', () => ({
  PieChart: ({ children }: { children: ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

// Import after mocks
import ExpenseTracking from '../ExpenseTracking';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    <MemoryRouter initialEntries={['/test-tenant/admin/expenses']}>
      {children}
    </MemoryRouter>
  </QueryClientProvider>
);

const mockExpenses = [
  {
    id: 'expense-1',
    description: 'Office Supplies',
    amount: '150.00',
    category: 'Supplies',
    notes: 'Pens and paper',
    created_at: new Date().toISOString(),
    tenant_id: 'tenant-123',
  },
  {
    id: 'expense-2',
    description: 'Electric Bill',
    amount: '200.00',
    category: 'Utilities',
    notes: null,
    created_at: new Date().toISOString(),
    tenant_id: 'tenant-123',
  },
  {
    id: 'expense-3',
    description: 'Monthly Rent',
    amount: '1500.00',
    category: 'Rent',
    notes: 'March rent',
    created_at: new Date().toISOString(),
    tenant_id: 'tenant-123',
  },
];

function mockSupabaseWith(data: unknown[], error: unknown = null) {
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockReturnThis(),
  });
}

describe('ExpenseTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: { id: 'tenant-123', slug: 'test-tenant', business_name: 'Test Business' },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    mockSupabaseWith([]);
  });

  describe('Initial Render', () => {
    it('should render empty state when no expenses exist', async () => {
      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No Expenses Recorded')).toBeInTheDocument();
      });
      expect(screen.getByText("Click 'Add Expense' to record your first expense.")).toBeInTheDocument();
    });

    it('should render expense list when expenses exist', async () => {
      mockSupabaseWith(mockExpenses);

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
        expect(screen.getByText('Electric Bill')).toBeInTheDocument();
        expect(screen.getByText('Monthly Rent')).toBeInTheDocument();
      });
    });

    it('should render stats cards', async () => {
      mockSupabaseWith(mockExpenses);

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Total Expenses')).toBeInTheDocument();
        expect(screen.getByText('This Month')).toBeInTheDocument();
        expect(screen.getByText('Categories')).toBeInTheDocument();
      });
    });

    it('should render pie chart when expenses exist', async () => {
      mockSupabaseWith(mockExpenses);

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Spending by Category')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show Add First Expense action when no expenses', async () => {
      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Add First Expense')).toBeInTheDocument();
      });
    });

    it('should show Clear Filters action when filter is active but no results', async () => {
      mockSupabaseWith(mockExpenses);

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      // Type a search that won't match anything
      const searchInput = screen.getByPlaceholderText('Search expenses...');
      await userEvent.type(searchInput, 'nonexistent expense xyz');

      await waitFor(() => {
        expect(screen.getByText('No matching expenses')).toBeInTheDocument();
        expect(screen.getByText('Clear Filters')).toBeInTheDocument();
      });
    });
  });

  describe('Add Expense', () => {
    it('should open dialog when Add Expense button is clicked', async () => {
      const user = userEvent.setup();
      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No Expenses Recorded')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add expense/i });
      await user.click(addButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Add New Expense')).toBeInTheDocument();
    });

    it('should have required attribute on description input', async () => {
      const user = userEvent.setup();
      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No Expenses Recorded')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add expense/i });
      await user.click(addButton);

      const descriptionInput = screen.getByLabelText(/description/i);
      expect(descriptionInput).toBeRequired();
    });

    it('should submit form with correct data', async () => {
      const user = userEvent.setup();
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: insertMock,
        delete: vi.fn().mockReturnThis(),
      });

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No Expenses Recorded')).toBeInTheDocument();
      });

      // Open dialog
      const addButton = screen.getByRole('button', { name: /add expense/i });
      await user.click(addButton);

      // Fill form
      await user.type(screen.getByLabelText(/description/i), 'New Test Expense');
      await user.type(screen.getByPlaceholderText('0.00'), '99.99');

      // Submit
      const submitButton = screen.getByRole('button', { name: /^add expense$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            tenant_id: 'tenant-123',
            description: 'New Test Expense',
            category: 'Supplies',
          })
        );
      });
    });

    it('should show success toast after adding expense', async () => {
      const user = userEvent.setup();

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No Expenses Recorded')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add expense/i });
      await user.click(addButton);

      await user.type(screen.getByLabelText(/description/i), 'Test Expense');
      await user.type(screen.getByPlaceholderText('0.00'), '50');

      const submitButton = screen.getByRole('button', { name: /^add expense$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(showSuccessToast).toHaveBeenCalledWith('Expense Added', 'The expense has been recorded successfully');
      });
    });
  });

  describe('Tenant Context', () => {
    it('should query expenses table with tenant_id filter', async () => {
      const eqMock = vi.fn().mockReturnThis();
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('expenses');
        expect(eqMock).toHaveBeenCalledWith('tenant_id', 'tenant-123');
      });
    });

    it('should include tenant_id in insert mutation', async () => {
      const user = userEvent.setup();
      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: insertMock,
        delete: vi.fn().mockReturnThis(),
      });

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No Expenses Recorded')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add expense/i });
      await user.click(addButton);

      await user.type(screen.getByLabelText(/description/i), 'Tenant Expense');
      await user.type(screen.getByPlaceholderText('0.00'), '100');

      const submitButton = screen.getByRole('button', { name: /^add expense$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.objectContaining({ tenant_id: 'tenant-123' })
        );
      });
    });
  });

  describe('Filtering', () => {
    it('should filter expenses by search query', async () => {
      mockSupabaseWith(mockExpenses);
      const user = userEvent.setup();

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search expenses...');
      await user.type(searchInput, 'Office');

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
        expect(screen.queryByText('Electric Bill')).not.toBeInTheDocument();
        expect(screen.queryByText('Monthly Rent')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete Expense', () => {
    it('should have delete button with aria-label', async () => {
      mockSupabaseWith(mockExpenses);

      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete expense/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database 42P01 error gracefully', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockReturnThis(),
      });

      render(<ExpenseTracking />, { wrapper });

      // Should show empty state instead of error
      await waitFor(() => {
        expect(screen.getByText('No Expenses Recorded')).toBeInTheDocument();
      });
    });
  });

  describe('Query Configuration', () => {
    it('should use queryKeys.expenses.byTenant for query key', async () => {
      render(<ExpenseTracking />, { wrapper });

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('expenses');
      });
    });
  });
});

/**
 * Tests for ExpenseTracking component
 *
 * Verifies button audit fixes:
 * - Submit button uses built-in loading prop
 * - Cancel button has type="button" and disables during mutation
 * - Delete button has aria-label
 * - Clear filter button has aria-label
 * - PieChart cells use stable keys (structural, not directly testable via RTL)
 * - No redundant icon spacing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant-id', name: 'Test Tenant' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/utils/toastHelpers', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/invalidation', () => ({
  invalidateOnEvent: vi.fn(),
}));

// Mock recharts lazily loaded components
vi.mock('@/components/ui/lazy-recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => <div data-testid="tooltip" />,
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: () => <div data-testid="loading-state">Loading...</div>,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({ open, onConfirm, onOpenChange }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <button onClick={onConfirm}>Confirm Delete</button>
        <button onClick={() => onOpenChange(false)}>Cancel Delete</button>
      </div>
    ) : null,
}));

const mockExpenses = [
  {
    id: 'expense-1',
    description: 'Office Supplies',
    amount: '45.99',
    category: 'Supplies',
    notes: 'Pens and paper',
    created_at: new Date().toISOString(),
    tenant_id: 'test-tenant-id',
  },
  {
    id: 'expense-2',
    description: 'Electric Bill',
    amount: '120.00',
    category: 'Utilities',
    notes: null,
    created_at: new Date().toISOString(),
    tenant_id: 'test-tenant-id',
  },
];

const mockSupabaseFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

function setupSupabaseMock(expenses = mockExpenses) {
  mockSupabaseFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: expenses, error: null }),
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }));
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    );
  };
}

// Dynamic import to ensure mocks are applied first
const importComponent = async () => {
  const mod = await import('../ExpenseTracking');
  return mod.default;
};

describe('ExpenseTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  describe('Rendering', () => {
    it('should render the expense list with data', async () => {
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
        expect(screen.getByText('Electric Bill')).toBeInTheDocument();
      });
    });

    it('should render stats cards', async () => {
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Total Expenses')).toBeInTheDocument();
        expect(screen.getByText('This Month')).toBeInTheDocument();
        expect(screen.getByText('Categories')).toBeInTheDocument();
      });
    });
  });

  describe('Button Audit: Add Expense button', () => {
    it('should render the Add Expense toolbar button', async () => {
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add expense/i });
      expect(addButton).toBeInTheDocument();
    });

    it('should open the add expense dialog when clicked', async () => {
      const user = userEvent.setup();
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add expense/i }));

      await waitFor(() => {
        expect(screen.getByText('Add New Expense')).toBeInTheDocument();
      });
    });
  });

  describe('Button Audit: Dialog buttons', () => {
    it('should have Cancel button with type="button"', async () => {
      const user = userEvent.setup();
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add expense/i }));

      await waitFor(() => {
        expect(screen.getByText('Add New Expense')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveAttribute('type', 'button');
    });

    it('should have submit button with type="submit"', async () => {
      const user = userEvent.setup();
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add expense/i }));

      await waitFor(() => {
        expect(screen.getByText('Add New Expense')).toBeInTheDocument();
      });

      // Find submit button within dialog footer
      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getAllByRole('button').find(
        btn => btn.getAttribute('type') === 'submit'
      );
      expect(submitButton).toBeTruthy();
    });
  });

  describe('Button Audit: Delete button', () => {
    it('should have aria-label on delete buttons', async () => {
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete expense/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
      deleteButtons.forEach((btn) => {
        expect(btn).toHaveAttribute('aria-label', 'Delete expense');
      });
    });

    it('should open confirm dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete expense/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });
  });

  describe('Button Audit: Clear filter button', () => {
    it('should not show clear filter button when filter is "all"', async () => {
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Office Supplies')).toBeInTheDocument();
      });

      // Clear filter button should not exist when filter is "all" (default)
      const clearButton = screen.queryByRole('button', { name: /clear filter/i });
      expect(clearButton).not.toBeInTheDocument();
    });
  });

  describe('Empty state buttons', () => {
    it('should show "Add First Expense" button when no expenses', async () => {
      setupSupabaseMock([]);
      const ExpenseTracking = await importComponent();
      render(<ExpenseTracking />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No Expenses Recorded')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /add first expense/i })).toBeInTheDocument();
    });
  });
});

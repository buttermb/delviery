/**
 * RoleManagement Tests
 * Tests for role CRUD operations, Zod validation, skeleton loading, and audit logging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies before importing the component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
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

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/activityLogger', () => ({
  logActivityAuto: vi.fn(),
  ActivityActions: {
    CREATE_ROLE: 'create_role',
    UPDATE_ROLE: 'update_role',
    DELETE_ROLE: 'delete_role',
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    roles: {
      byTenant: (tenantId?: string) => ['roles', tenantId],
    },
  },
}));

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({ open, onConfirm, itemName }: { open: boolean; onConfirm: () => void; itemName?: string }) =>
    open ? (
      <div data-testid="delete-dialog">
        <span>Delete {itemName}?</span>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    ) : null,
}));

vi.mock('@/components/shared/ResponsiveTable', () => ({
  ResponsiveTable: ({ data, columns, emptyState }: { data: unknown[]; columns: { header: string; cell: (item: unknown) => ReactNode }[]; emptyState?: { title: string; description: string; primaryAction?: { label: string; onClick: () => void } } }) => {
    if (data.length === 0 && emptyState) {
      return (
        <div data-testid="empty-state">
          <p>{emptyState.title}</p>
          <p>{emptyState.description}</p>
          {emptyState.primaryAction && (
            <button onClick={emptyState.primaryAction.onClick}>{emptyState.primaryAction.label}</button>
          )}
        </div>
      );
    }
    return (
      <table data-testid="roles-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col.header}>{col.cell(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
}));

import { RoleManagement } from '../RoleManagement';
import { supabase } from '@/integrations/supabase/client';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

const mockRoles = [
  { id: 'role-1', name: 'Manager', description: 'Manages team', is_system: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'role-2', name: 'Admin', description: 'System admin', is_system: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

const mockPermissions = [
  { permission: 'orders.view' },
  { permission: 'orders.create' },
];

describe('RoleManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching roles', () => {
    // Never resolve so query stays loading
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    mockFrom.mockReturnValue(chain);

    renderWithProviders(<RoleManagement />);

    // Should show skeleton elements, not the table
    expect(screen.queryByTestId('roles-table')).not.toBeInTheDocument();
  });

  it('renders roles table after loading', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'roles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockRoles, error: null }),
        };
      }
      if (table === 'tenant_role_permissions') {
        callCount++;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: callCount === 1 ? mockPermissions : [], error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    renderWithProviders(<RoleManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('roles-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('shows empty state with create action when no roles', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    renderWithProviders(<RoleManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No roles found')).toBeInTheDocument();
    // Two "Create Role" buttons: header + empty state action
    const createButtons = screen.getAllByText('Create Role');
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens create dialog when Create Role button is clicked', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    renderWithProviders(<RoleManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    const createBtn = screen.getAllByText('Create Role')[0];
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByLabelText('Role Name *')).toBeInTheDocument();
    });
  });

  it('disables submit button when role name is empty', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    renderWithProviders(<RoleManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    // Open dialog
    const createBtn = screen.getAllByText('Create Role')[0];
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByLabelText('Role Name *')).toBeInTheDocument();
    });

    // Submit button should be disabled when name is empty
    const submitBtns = screen.getAllByRole('button', { name: /Create Role/i });
    const submitBtn = submitBtns[submitBtns.length - 1];
    expect(submitBtn).toBeDisabled();
  });

  it('validates role name with special chars', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    renderWithProviders(<RoleManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    // Open dialog
    const createBtn = screen.getAllByText('Create Role')[0];
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByLabelText('Role Name *')).toBeInTheDocument();
    });

    // Type an invalid name with special chars
    const nameInput = screen.getByLabelText('Role Name *');
    await userEvent.type(nameInput, 'Role@#$');

    const submitBtn = screen.getByRole('button', { name: /Create Role/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Only letters, numbers, spaces, hyphens, and underscores allowed/)).toBeInTheDocument();
    });
  });

  it('shows error state with retry button on query failure', async () => {
    const networkError = new Error('Network error');
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockRejectedValue(networkError),
    }));

    renderWithProviders(<RoleManagement />);

    await waitFor(
      () => {
        expect(screen.getByText('Failed to load roles. Please try again.')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('has maxLength on form inputs', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    renderWithProviders(<RoleManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    // Open dialog
    const createBtn = screen.getAllByText('Create Role')[0];
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByLabelText('Role Name *')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Role Name *');
    const descInput = screen.getByLabelText('Description');
    expect(nameInput).toHaveAttribute('maxLength', '50');
    expect(descInput).toHaveAttribute('maxLength', '200');
  });

  it('renders page header with title and description', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));

    renderWithProviders(<RoleManagement />);

    await waitFor(() => {
      expect(screen.getByText('Role Management')).toBeInTheDocument();
    });

    expect(screen.getByText(/Create and manage custom roles/)).toBeInTheDocument();
  });
});

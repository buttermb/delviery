/**
 * RoleManagement Tests
 * Tests button accessibility, loading states, and disabled states during mutations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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

vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn(),
}));

vi.mock('@/utils/errorHandling/typeGuards', () => ({
  isPostgrestError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/activityLogger', () => ({
  logActivityAuto: vi.fn(),
  ActivityActions: {
    CREATE_ROLE: 'create_role',
    UPDATE_ROLE: 'update_role',
    DELETE_ROLE: 'delete_role',
  },
}));

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/EnhancedLoadingState', () => ({
  EnhancedLoadingState: ({ message }: { message?: string }) => (
    <div data-testid="loading-state">{message}</div>
  ),
}));

vi.mock('@/components/shared/ConfirmDeleteDialog', () => ({
  ConfirmDeleteDialog: ({
    open,
    onConfirm,
    itemName,
    isLoading,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    itemName?: string;
    itemType?: string;
    description?: string;
    isLoading?: boolean;
  }) =>
    open ? (
      <div data-testid="confirm-delete-dialog">
        <p>Delete {itemName}?</p>
        <button onClick={onConfirm} disabled={isLoading}>
          {isLoading ? 'Deleting...' : 'Confirm Delete'}
        </button>
      </div>
    ) : null,
}));

// Import after mocks
import { RoleManagement } from '../RoleManagement';
import { supabase } from '@/integrations/supabase/client';

const mockRoles = [
  {
    id: 'role-1',
    name: 'Sales Manager',
    description: 'Manages sales team',
    is_system: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-2',
    name: 'Administrator',
    description: 'Full system access',
    is_system: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/test-tenant/admin/roles']}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function mockSupabaseWithRoles(roles = mockRoles) {
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'roles') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: roles, error: null }),
        insert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new-role' }, error: null }),
      };
    }
    if (table === 'tenant_role_permissions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockReturnThis(),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
  });

  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(fromMock);
}

describe('RoleManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseWithRoles();
  });

  describe('Button Accessibility', () => {
    it('should render "Create Role" button with aria-label', async () => {
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create new role/i });
        expect(createButton).toBeInTheDocument();
        expect(createButton).toHaveAttribute('aria-label', 'Create new role');
      });
    });

    it('should render edit buttons with role-specific aria-labels', async () => {
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit role/i });
      expect(editButtons.length).toBeGreaterThanOrEqual(1);
      expect(editButtons[0]).toHaveAttribute('aria-label', 'Edit role Sales Manager');
    });

    it('should render delete button with role-specific aria-label for non-system roles', async () => {
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete role sales manager/i });
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete role Sales Manager');
    });

    it('should not render delete button for system roles', async () => {
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Administrator')).toBeInTheDocument();
      });

      const deleteButtons = screen.queryAllByRole('button', { name: /delete role administrator/i });
      expect(deleteButtons).toHaveLength(0);
    });

    it('should render retry button with aria-label in error state', async () => {
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error', code: '500', details: '', hint: '' },
        }),
      }));

      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(
        () => {
          const retryButton = screen.getByRole('button', { name: /retry loading roles/i });
          expect(retryButton).toBeInTheDocument();
          expect(retryButton).toHaveAttribute('aria-label', 'Retry loading roles');
        },
        { timeout: 10000 }
      );
    });

    it('should render dialog cancel and submit buttons with aria-labels', async () => {
      const user = userEvent.setup();
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /create new role/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const cancelButton = within(dialog).getByRole('button', { name: /cancel role form/i });
      const submitButton = within(dialog).getByRole('button', { name: /create role/i });

      expect(cancelButton).toHaveAttribute('aria-label', 'Cancel role form');
      expect(submitButton).toHaveAttribute('aria-label', 'Create role');
    });

    it('should show "Update role" aria-label when editing an existing role', async () => {
      const user = userEvent.setup();
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit role sales manager/i });
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /update role/i });
      expect(submitButton).toHaveAttribute('aria-label', 'Update role');
    });
  });

  describe('Button Disabled States', () => {
    it('should disable submit button when role name is empty', async () => {
      const user = userEvent.setup();
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create new role/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /create role/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when role name is provided', async () => {
      const user = userEvent.setup();
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create new role/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/role name/i);
      await user.type(nameInput, 'New Role');

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /create role/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('should render loading state when data is fetching', () => {
      // Mock supabase to never resolve (simulating loading)
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue(new Promise(() => {})),
      }));

      render(<RoleManagement />, { wrapper: createWrapper() });
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no roles exist', async () => {
      mockSupabaseWithRoles([]);

      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('No roles found')).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Behavior', () => {
    it('should open create dialog when Create Role button is clicked', async () => {
      const user = userEvent.setup();
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create new role/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Define a new role with specific permissions for your team members.')).toBeInTheDocument();
    });

    it('should open edit dialog with role data when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /edit role sales manager/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/role name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Sales Manager');
    });

    it('should reset form when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create new role/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/role name/i);
      await user.type(nameInput, 'Test Role');

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: /cancel role form/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete Flow', () => {
    it('should open delete confirmation when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<RoleManagement />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Sales Manager')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /delete role sales manager/i }));

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
        expect(screen.getByText('Delete Sales Manager?')).toBeInTheDocument();
      });
    });
  });
});

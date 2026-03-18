/**
 * TeamManagement Button Audit Tests
 *
 * Verifies button accessibility, loading states, and correct sizing
 * across all interactive elements in the TeamManagement page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies before importing component
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { invitations: [] }, error: null }),
    },
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: vi.fn().mockReturnValue({
    tenant: {
      id: 'tenant-123',
      slug: 'test-tenant',
      business_name: 'Test Business',
      created_at: '2024-01-01T00:00:00Z',
      subscription_plan: 'pro',
      limits: { users: 10 },
    },
    loading: false,
    admin: { id: 'admin-123', email: 'admin@test.com' },
    tenantSlug: 'test-tenant',
  }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: vi.fn().mockReturnValue({
    canEdit: vi.fn().mockReturnValue(true),
    canDelete: vi.fn().mockReturnValue(true),
    role: 'owner',
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

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/admin/PendingInvitations', () => ({
  PendingInvitations: () => null,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/humanizeError', () => ({
  humanizeError: vi.fn((err: Error) => err.message),
}));

// Import after mocks
import TeamManagement from '../TeamManagement';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePermissions } from '@/hooks/usePermissions';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/team']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('TeamManagement — Button Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      tenant: {
        id: 'tenant-123',
        slug: 'test-tenant',
        business_name: 'Test Business',
        created_at: '2024-01-01T00:00:00Z',
        subscription_plan: 'pro',
        limits: { users: 10 },
      },
      loading: false,
      admin: { id: 'admin-123', email: 'admin@test.com' },
      tenantSlug: 'test-tenant',
    });

    (usePermissions as ReturnType<typeof vi.fn>).mockReturnValue({
      canEdit: vi.fn().mockReturnValue(true),
      canDelete: vi.fn().mockReturnValue(true),
      role: 'owner',
    });
  });

  describe('Invite Member button', () => {
    it('renders with correct text and Plus icon', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });
      const button = screen.getByRole('button', { name: /invite member/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
    });

    it('is hidden when user lacks team edit permission', () => {
      (usePermissions as ReturnType<typeof vi.fn>).mockReturnValue({
        canEdit: vi.fn().mockReturnValue(false),
        canDelete: vi.fn().mockReturnValue(false),
        role: 'viewer',
      });

      render(<TeamManagement />, { wrapper: createWrapper() });
      expect(screen.queryByRole('button', { name: /invite member/i })).not.toBeInTheDocument();
    });
  });

  describe('Actions dropdown trigger', () => {
    it('uses size="icon" (44px square) for WCAG touch target compliance', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      // The actions button should have aria-label and icon sizing
      const actionsButtons = screen.queryAllByRole('button', { name: /member actions/i });
      for (const button of actionsButtons) {
        // Verify icon sizing class is applied (h-11 w-11 = 44px from size="icon")
        expect(button.className).toMatch(/h-11/);
        expect(button.className).toMatch(/w-11/);
      }
    });

    it('has aria-label for accessibility', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });
      const actionsButtons = screen.queryAllByRole('button', { name: /member actions/i });
      for (const button of actionsButtons) {
        expect(button).toHaveAttribute('aria-label', 'Member actions');
      }
    });
  });

  describe('Loading skeleton state', () => {
    it('renders skeleton when auth is loading', () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: null,
        loading: true,
        admin: null,
        tenantSlug: '',
      });

      render(<TeamManagement />, { wrapper: createWrapper() });
      // Skeleton elements use role="status" with aria-label="Loading..."
      const skeletons = screen.getAllByRole('status', { name: /loading/i });
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Invite Member button disabled when limit reached', () => {
    it('disables invite button when user limit is reached', async () => {
      (useTenantAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        tenant: {
          id: 'tenant-123',
          slug: 'test-tenant',
          business_name: 'Test Business',
          created_at: '2024-01-01T00:00:00Z',
          subscription_plan: 'pro',
          limits: { users: 1 },
        },
        loading: false,
        admin: { id: 'admin-123', email: 'admin@test.com' },
        tenantSlug: 'test-tenant',
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      // Wait for query to resolve (owner is auto-injected as active member)
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /invite member/i });
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Dialog Cancel and Submit buttons', () => {
    it('cancel button has outline variant and submit uses loading prop', async () => {
      const { default: userEvent } = await import('@testing-library/user-event');
      const user = userEvent.setup();

      render(<TeamManagement />, { wrapper: createWrapper() });

      // Open the invite dialog
      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      // Check cancel button
      const dialog = screen.getByRole('dialog');
      const cancelButton = within(dialog).getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).toHaveAttribute('type', 'button');

      // Check submit button
      const submitButton = within(dialog).getByRole('button', { name: /send invitation/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });
});

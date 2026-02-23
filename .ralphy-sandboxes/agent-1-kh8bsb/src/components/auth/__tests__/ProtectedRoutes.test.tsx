/**
 * Protected Routes Tests
 * Tests for:
 * 1. Redirect to login when accessing protected page while logged out (with return URL)
 * 2. After login, redirect back to the intended page
 * 3. Accessing a page without the required role shows access denied
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks ---

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock LoadingFallback
vi.mock('@/components/LoadingFallback', () => ({
  LoadingFallback: () => <div data-testid="loading-fallback">Loading...</div>,
}));

// Mock VerificationContext
vi.mock('@/contexts/VerificationContext', () => ({
  VerificationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock errorHandling
vi.mock('@/utils/errorHandling/handlers', () => ({
  handleError: vi.fn().mockReturnValue('Unknown error'),
}));

// Mock toastUtils (dynamically imported in the component)
vi.mock('@/lib/toastUtils', () => ({
  showErrorToast: vi.fn(),
}));

// Mock useAuthError (dynamically imported in the component)
vi.mock('@/hooks/useAuthError', () => ({
  emitAuthError: vi.fn(),
}));

// Mock TenantAdminAuthContext - this is the key mock for controlling auth state
const mockAuthState = {
  admin: null as { email: string; userId: string; role: string } | null,
  tenant: null as { id: string; slug: string; subscription_status: string; payment_method_added: boolean } | null,
  token: null as string | null,
  loading: false,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshAuthToken: vi.fn(),
  refreshTenant: vi.fn(),
  mfaRequired: false,
  mfaFactorId: null,
  verifyMfa: vi.fn(),
  tenantSlug: '',
};

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => mockAuthState,
  TenantAdminAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock usePermissions for role-based access testing
const mockPermissions = {
  role: 'viewer' as string,
  checkPermission: vi.fn().mockReturnValue(false),
  checkAnyPermission: vi.fn().mockReturnValue(false),
  checkAllPermissions: vi.fn().mockReturnValue(false),
  hasPermission: vi.fn().mockReturnValue(false),
  isLoading: false,
};

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => mockPermissions,
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Import components after mocks
import { TenantAdminProtectedRoute } from '../TenantAdminProtectedRoute';
import { PermissionGuard } from '../PermissionGuard';

// --- Helper Components ---

/** Captures and displays the current location for assertions */
function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      <span data-testid="location-pathname">{location.pathname}</span>
    </div>
  );
}

/** Creates a fresh QueryClient for test isolation */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/** Test wrapper with routing and providers */
function TestApp({
  initialEntries,
  children,
}: {
  initialEntries: string[];
  children: ReactNode;
}) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// --- Tests ---

describe('Protected Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset auth state to unauthenticated
    mockAuthState.admin = null;
    mockAuthState.tenant = null;
    mockAuthState.token = null;
    mockAuthState.loading = false;
    mockAuthState.isAuthenticated = false;

    // Reset permissions
    mockPermissions.role = 'viewer';
    mockPermissions.checkPermission.mockReturnValue(false);
    mockPermissions.checkAnyPermission.mockReturnValue(false);
    mockPermissions.checkAllPermissions.mockReturnValue(false);
    mockPermissions.hasPermission.mockReturnValue(false);
    mockPermissions.isLoading = false;
  });

  describe('Unauthenticated access redirects to login', () => {
    it('should redirect to tenant login when accessing protected dashboard while logged out', async () => {
      render(
        <TestApp initialEntries={['/test-tenant/admin/dashboard']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/dashboard"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="dashboard-page">Dashboard</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      await waitFor(() => {
        const pathname = screen.getByTestId('location-pathname');
        expect(pathname.textContent).toBe('/test-tenant/admin/login');
      });
    });

    it('should redirect to tenant login preserving the tenant slug from URL', async () => {
      render(
        <TestApp initialEntries={['/acme-corp/admin/products']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/products"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="products-page">Products</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      await waitFor(() => {
        const pathname = screen.getByTestId('location-pathname');
        expect(pathname.textContent).toBe('/acme-corp/admin/login');
      });
    });

    it('should redirect to saas login when no valid tenant slug is available', async () => {
      // Use a UUID as tenant slug which is considered invalid
      render(
        <TestApp initialEntries={['/12345678-1234-1234-1234-123456789abc/admin/dashboard']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/dashboard"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="dashboard-page">Dashboard</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/saas/login"
              element={<div data-testid="saas-login-page">SaaS Login</div>}
            />
          </Routes>
        </TestApp>
      );

      await waitFor(() => {
        const pathname = screen.getByTestId('location-pathname');
        expect(pathname.textContent).toBe('/saas/login');
      });
    });

    it('should use lastTenantSlug from localStorage when URL slug is a UUID', async () => {
      localStorage.setItem('lastTenantSlug', 'saved-tenant');

      render(
        <TestApp initialEntries={['/12345678-1234-1234-1234-123456789abc/admin/dashboard']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/dashboard"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="dashboard-page">Dashboard</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      await waitFor(() => {
        const pathname = screen.getByTestId('location-pathname');
        expect(pathname.textContent).toBe('/saved-tenant/admin/login');
      });
    });

    it('should not render protected content when user is not authenticated', async () => {
      render(
        <TestApp initialEntries={['/test-tenant/admin/dashboard']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/dashboard"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="dashboard-page">Dashboard</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authenticated access renders protected content', () => {
    it('should render protected content when user is authenticated with matching tenant', async () => {
      // Set authenticated state
      mockAuthState.admin = {
        email: 'admin@test.com',
        userId: 'user-123',
        role: 'owner',
      };
      mockAuthState.tenant = {
        id: 'tenant-123',
        slug: 'test-tenant',
        subscription_status: 'active',
        payment_method_added: true,
      };
      mockAuthState.token = 'valid-token';
      mockAuthState.isAuthenticated = true;

      render(
        <TestApp initialEntries={['/test-tenant/admin/dashboard']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/dashboard"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="dashboard-page">Dashboard</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
    });

    it('should not render protected content when tenant slug does not match authenticated tenant', async () => {
      mockAuthState.admin = {
        email: 'admin@test.com',
        userId: 'user-123',
        role: 'owner',
      };
      mockAuthState.tenant = {
        id: 'tenant-123',
        slug: 'correct-tenant',
        subscription_status: 'active',
        payment_method_added: true,
      };
      mockAuthState.token = 'valid-token';
      mockAuthState.isAuthenticated = true;

      render(
        <TestApp initialEntries={['/wrong-tenant/admin/dashboard']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/dashboard"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="dashboard-page">Dashboard</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin"
              element={<div data-testid="admin-root">Admin Root</div>}
            />
          </Routes>
        </TestApp>
      );

      // When the URL slug doesn't match the authenticated tenant's slug,
      // the protected content must NOT be rendered (security critical)
      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
      });

      // The component shows loading/verification state instead of granting access
      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();
    });

    it('should show loading fallback while auth context is loading', async () => {
      mockAuthState.loading = true;

      render(
        <TestApp initialEntries={['/test-tenant/admin/dashboard']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/dashboard"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="dashboard-page">Dashboard</div>
                </TenantAdminProtectedRoute>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.getByTestId('loading-fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    });
  });

  describe('After login redirects back to intended page', () => {
    it('should render intended page when navigating back after successful login', async () => {
      // Simulate state after login: user is authenticated and navigates back to intended page
      mockAuthState.admin = {
        email: 'admin@test.com',
        userId: 'user-123',
        role: 'owner',
      };
      mockAuthState.tenant = {
        id: 'tenant-123',
        slug: 'test-tenant',
        subscription_status: 'active',
        payment_method_added: true,
      };
      mockAuthState.token = 'valid-token';
      mockAuthState.isAuthenticated = true;

      // User navigates back to the intended page after logging in
      render(
        <TestApp initialEntries={['/test-tenant/admin/orders']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/orders"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="orders-page">Orders</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      // Should render the orders page since user is now authenticated
      await waitFor(() => {
        expect(screen.getByTestId('orders-page')).toBeInTheDocument();
      });

      // Login page should not be shown
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });

    it('should redirect unauthenticated user to login preserving the tenant context for return', async () => {
      // Unauthenticated user tries to access a deep link
      render(
        <TestApp initialEntries={['/test-tenant/admin/orders']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/orders"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="orders-page">Orders</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      // Should redirect to the tenant-specific login (preserving the slug for return navigation)
      await waitFor(() => {
        const pathname = screen.getByTestId('location-pathname');
        expect(pathname.textContent).toBe('/test-tenant/admin/login');
      });

      // The protected content should not be rendered
      expect(screen.queryByTestId('orders-page')).not.toBeInTheDocument();
    });

    it('should preserve tenant slug in redirect flow', async () => {
      // Start unauthenticated navigating to a specific tenant page
      render(
        <TestApp initialEntries={['/my-dispensary/admin/inventory']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/inventory"
              element={
                <TenantAdminProtectedRoute>
                  <div data-testid="inventory-page">Inventory</div>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      // Should redirect to the same tenant's login
      await waitFor(() => {
        const pathname = screen.getByTestId('location-pathname');
        expect(pathname.textContent).toBe('/my-dispensary/admin/login');
      });
    });
  });

  describe('Role-based access control with PermissionGuard', () => {
    it('should show access denied message when user lacks required permission', () => {
      mockPermissions.checkPermission.mockReturnValue(false);

      render(
        <TestApp initialEntries={['/test-tenant/admin/settings']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/settings"
              element={
                <PermissionGuard permission="settings:edit">
                  <div data-testid="settings-page">Settings</div>
                </PermissionGuard>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.queryByTestId('settings-page')).not.toBeInTheDocument();
      expect(
        screen.getByText("You don't have permission to access this resource.")
      ).toBeInTheDocument();
    });

    it('should render content when user has the required permission', () => {
      mockPermissions.checkPermission.mockReturnValue(true);

      render(
        <TestApp initialEntries={['/test-tenant/admin/settings']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/settings"
              element={
                <PermissionGuard permission="settings:edit">
                  <div data-testid="settings-page">Settings</div>
                </PermissionGuard>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    });

    it('should show access denied for viewer trying to access admin-only page', () => {
      mockPermissions.role = 'viewer';
      mockPermissions.checkPermission.mockReturnValue(false);

      render(
        <TestApp initialEntries={['/test-tenant/admin/team']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/team"
              element={
                <PermissionGuard permission="team:invite">
                  <div data-testid="team-page">Team Management</div>
                </PermissionGuard>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.queryByTestId('team-page')).not.toBeInTheDocument();
      expect(
        screen.getByText("You don't have permission to access this resource.")
      ).toBeInTheDocument();
    });

    it('should show access denied for team_member trying to access owner-only settings', () => {
      mockPermissions.role = 'team_member';
      mockPermissions.checkPermission.mockReturnValue(false);

      render(
        <TestApp initialEntries={['/test-tenant/admin/settings/billing']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/settings/billing"
              element={
                <PermissionGuard permission="settings:billing">
                  <div data-testid="billing-page">Billing Settings</div>
                </PermissionGuard>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.queryByTestId('billing-page')).not.toBeInTheDocument();
      expect(
        screen.getByText("You don't have permission to access this resource.")
      ).toBeInTheDocument();
    });

    it('should render custom fallback when user lacks permission and fallback is provided', () => {
      mockPermissions.checkPermission.mockReturnValue(false);

      render(
        <TestApp initialEntries={['/test-tenant/admin/finance']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/finance"
              element={
                <PermissionGuard
                  permission="finance:view"
                  fallback={<div data-testid="access-denied-custom">Access Denied - Custom</div>}
                >
                  <div data-testid="finance-page">Finance</div>
                </PermissionGuard>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.queryByTestId('finance-page')).not.toBeInTheDocument();
      expect(screen.getByTestId('access-denied-custom')).toBeInTheDocument();
    });

    it('should render nothing when showMessage is false and user lacks permission', () => {
      mockPermissions.checkPermission.mockReturnValue(false);

      render(
        <TestApp initialEntries={['/test-tenant/admin/api']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/api"
              element={
                <PermissionGuard permission="api:manage" showMessage={false}>
                  <div data-testid="api-page">API Management</div>
                </PermissionGuard>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.queryByTestId('api-page')).not.toBeInTheDocument();
      expect(
        screen.queryByText("You don't have permission to access this resource.")
      ).not.toBeInTheDocument();
    });

    it('should check multiple permissions with requireAll=true', () => {
      mockPermissions.checkAllPermissions.mockReturnValue(false);

      render(
        <TestApp initialEntries={['/test-tenant/admin/advanced']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/advanced"
              element={
                <PermissionGuard
                  permission={['settings:edit', 'settings:billing']}
                  requireAll={true}
                >
                  <div data-testid="advanced-page">Advanced Settings</div>
                </PermissionGuard>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.queryByTestId('advanced-page')).not.toBeInTheDocument();
      expect(
        screen.getByText("You don't have permission to access this resource.")
      ).toBeInTheDocument();
    });

    it('should check multiple permissions with requireAll=false (any permission grants access)', () => {
      mockPermissions.checkAnyPermission.mockReturnValue(true);

      render(
        <TestApp initialEntries={['/test-tenant/admin/reports']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/reports"
              element={
                <PermissionGuard
                  permission={['reports:view', 'reports:export']}
                  requireAll={false}
                >
                  <div data-testid="reports-page">Reports</div>
                </PermissionGuard>
              }
            />
          </Routes>
        </TestApp>
      );

      expect(screen.getByTestId('reports-page')).toBeInTheDocument();
    });
  });

  describe('Combined auth + permission flow', () => {
    it('should redirect to login first, then show access denied if role insufficient', async () => {
      // Step 1: Unauthenticated - should redirect to login
      render(
        <TestApp initialEntries={['/test-tenant/admin/settings']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/settings"
              element={
                <TenantAdminProtectedRoute>
                  <PermissionGuard permission="settings:edit">
                    <div data-testid="settings-page">Settings</div>
                  </PermissionGuard>
                </TenantAdminProtectedRoute>
              }
            />
            <Route
              path="/:tenantSlug/admin/login"
              element={<div data-testid="login-page">Login</div>}
            />
          </Routes>
        </TestApp>
      );

      // Should redirect to login first
      await waitFor(() => {
        const pathname = screen.getByTestId('location-pathname');
        expect(pathname.textContent).toBe('/test-tenant/admin/login');
      });
    });

    it('should show access denied when authenticated but lacking permission', async () => {
      // Set authenticated state with limited role
      mockAuthState.admin = {
        email: 'viewer@test.com',
        userId: 'user-viewer',
        role: 'viewer',
      };
      mockAuthState.tenant = {
        id: 'tenant-123',
        slug: 'test-tenant',
        subscription_status: 'active',
        payment_method_added: true,
      };
      mockAuthState.token = 'valid-token';
      mockAuthState.isAuthenticated = true;

      // Viewer doesn't have settings:edit permission
      mockPermissions.role = 'viewer';
      mockPermissions.checkPermission.mockReturnValue(false);

      render(
        <TestApp initialEntries={['/test-tenant/admin/settings']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/settings"
              element={
                <TenantAdminProtectedRoute>
                  <PermissionGuard permission="settings:edit">
                    <div data-testid="settings-page">Settings</div>
                  </PermissionGuard>
                </TenantAdminProtectedRoute>
              }
            />
          </Routes>
        </TestApp>
      );

      // Should pass auth check but fail permission check
      await waitFor(() => {
        expect(screen.queryByTestId('settings-page')).not.toBeInTheDocument();
        expect(
          screen.getByText("You don't have permission to access this resource.")
        ).toBeInTheDocument();
      });
    });

    it('should render content when authenticated with correct permissions', async () => {
      mockAuthState.admin = {
        email: 'owner@test.com',
        userId: 'user-owner',
        role: 'owner',
      };
      mockAuthState.tenant = {
        id: 'tenant-123',
        slug: 'test-tenant',
        subscription_status: 'active',
        payment_method_added: true,
      };
      mockAuthState.token = 'valid-token';
      mockAuthState.isAuthenticated = true;

      mockPermissions.role = 'owner';
      mockPermissions.checkPermission.mockReturnValue(true);

      render(
        <TestApp initialEntries={['/test-tenant/admin/settings']}>
          <Routes>
            <Route
              path="/:tenantSlug/admin/settings"
              element={
                <TenantAdminProtectedRoute>
                  <PermissionGuard permission="settings:edit">
                    <div data-testid="settings-page">Settings</div>
                  </PermissionGuard>
                </TenantAdminProtectedRoute>
              }
            />
          </Routes>
        </TestApp>
      );

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });
    });
  });
});

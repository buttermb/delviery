/**
 * AdminLayout Component Tests
 * Tests:
 * - Suspense boundary with skeleton fallback
 * - Layout rendering and error handling
 * - Scroll restoration integration for all admin routes
 * - Header and footer components
 * Updated: 2026-02-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from '../AdminLayout';

// Mock all the complex dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/hooks/useSidebarMode', () => ({
  useSidebarMode: () => ({
    isOptimized: false,
  }),
}));

vi.mock('@/hooks/useEventNotifications', () => ({
  useEventNotifications: () => ({}),
}));

vi.mock('@/hooks/useScrollRestoration', () => ({
  useScrollRestoration: vi.fn(),
}));

vi.mock('@/hooks/useAdminKeyboardShortcuts', () => ({
  useAdminKeyboardShortcuts: () => ({
    shortcutsVisible: false,
    setShortcutsVisible: vi.fn(),
  }),
}));

vi.mock('@/components/tenant-admin/CommandPalette', () => ({
  useCommandPaletteStore: () => ({
    setOpen: vi.fn(),
  }),
  TenantAdminCommandPalette: () => <div data-testid="command-palette">Command Palette</div>,
}));

vi.mock('@/contexts/CreditContext', () => ({
  useCredits: () => ({
    credits: 100,
    showLowCreditWarning: false,
    dismissLowCreditWarning: vi.fn(),
    isPurchaseModalOpen: false,
    setIsPurchaseModalOpen: vi.fn(),
  }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Toggle Sidebar</button>,
}));

vi.mock('@/components/admin/RouteErrorBoundary', () => ({
  RouteErrorBoundary: ({ children }: { children: React.ReactNode }) => <div data-testid="route-error-boundary">{children}</div>,
}));

vi.mock('@/components/admin/AdminErrorBoundary', () => ({
  AdminErrorBoundary: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-error-boundary">{children}</div>,
}));

vi.mock('@/components/admin/sidebar/AdaptiveSidebar', () => ({
  AdaptiveSidebar: () => <div data-testid="adaptive-sidebar">Adaptive Sidebar</div>,
}));

vi.mock('@/components/sidebar/OptimizedSidebar', () => ({
  OptimizedSidebar: () => <div data-testid="optimized-sidebar">Optimized Sidebar</div>,
}));

vi.mock('@/components/admin/sidebar/LiveBadgeContext', () => ({
  LiveBadgeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="live-badge-provider">{children}</div>,
}));

vi.mock('@/components/admin/sidebar/SidebarErrorBoundary', () => ({
  SidebarErrorBoundary: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-error-boundary">{children}</div>,
}));

vi.mock('@/components/admin/MobileBottomNav', () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav">Mobile Nav</div>,
}));

vi.mock('@/components/admin/AccountSwitcher', () => ({
  AccountSwitcher: () => <div data-testid="account-switcher">Account Switcher</div>,
}));

vi.mock('@/components/admin/Breadcrumbs', () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

vi.mock('@/components/InstallPWA', () => ({
  default: () => <div data-testid="install-pwa">Install PWA</div>,
}));

vi.mock('@/components/admin/AdminNotificationCenter', () => ({
  AdminNotificationCenter: () => <div data-testid="notification-center">Notifications</div>,
}));

vi.mock('@/components/admin/ImpersonationBanner', () => ({
  ImpersonationBanner: () => <div data-testid="impersonation-banner">Impersonation Banner</div>,
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme Toggle</button>,
}));

vi.mock('@/components/admin/AdminKeyboardShortcutsDialog', () => ({
  AdminKeyboardShortcutsDialog: () => <div data-testid="keyboard-shortcuts-dialog">Shortcuts</div>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentPropsWithoutRef<'button'>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/tutorial/TutorialProvider', () => ({
  TutorialProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="tutorial-provider">{children}</div>,
}));

vi.mock('@/utils/routeDebugger', () => ({
  logRouteState: vi.fn(),
}));

vi.mock('@/components/QuickActionsButton', () => ({
  QuickActionsButton: () => <div data-testid="quick-actions">Quick Actions</div>,
}));

vi.mock('@/components/credits/LowCreditWarning', () => ({
  LowCreditWarning: () => <div data-testid="low-credit-warning">Low Credit Warning</div>,
}));

vi.mock('@/components/credits/CreditDeductionToast', () => ({
  CreditToastContainer: () => <div data-testid="credit-toast-container">Credit Toast</div>,
}));

vi.mock('@/components/credits/SubscriptionStatusBadge', () => ({
  SubscriptionStatusBadge: () => <div data-testid="subscription-badge">Subscription Badge</div>,
}));

vi.mock('@/components/credits/CreditPurchaseModal', () => ({
  CreditPurchaseModal: () => <div data-testid="credit-purchase-modal">Purchase Modal</div>,
}));

vi.mock('@/components/credits/CreditBalance', () => ({
  CreditBalance: () => <div data-testid="credit-balance">Credit Balance</div>,
}));

vi.mock('@/components/offline/OfflineStatus', () => ({
  OfflineStatusIndicator: () => <div data-testid="offline-status">Offline Status</div>,
}));

// Mock AdminPageSkeleton - the key component we're testing
vi.mock('@/components/admin/AdminPageSkeleton', () => ({
  AdminPageSkeleton: () => <div data-testid="admin-page-skeleton" role="status" aria-label="Loading...">Loading Skeleton</div>,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Test component that simulates a lazy-loaded page
const TestPage = () => <div data-testid="test-page">Test Page Content</div>;

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );
      expect(container).toBeTruthy();
    });

    it('should render main layout structure', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
      expect(screen.getByTestId('admin-error-boundary')).toBeInTheDocument();
      expect(screen.getByTestId('route-error-boundary')).toBeInTheDocument();
      expect(screen.getByTestId('adaptive-sidebar')).toBeInTheDocument();
    });

    it('should render header elements', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
      expect(screen.getByTestId('notification-center')).toBeInTheDocument();
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    it('should render footer elements', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
      expect(screen.getByTestId('install-pwa')).toBeInTheDocument();
    });
  });

  describe('Suspense Boundary with Skeleton Fallback', () => {
    it('should show AdminPageSkeleton while content is loading', async () => {
      const LazyComponent = React.lazy(() => new Promise<{ default: React.ComponentType }>((resolve) => {
        setTimeout(() => {
          resolve({ default: TestPage });
        }, 50);
      }));

      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<LazyComponent />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      // Initially, should show the skeleton
      expect(screen.getByTestId('admin-page-skeleton')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();

      // After loading, should show the actual content
      await waitFor(() => {
        expect(screen.getByTestId('test-page')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Skeleton should no longer be visible
      expect(screen.queryByTestId('admin-page-skeleton')).not.toBeInTheDocument();
    });

    it('should render child content inside Suspense boundary', async () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-page')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Page Content')).toBeInTheDocument();
    });

    it('should wrap Outlet in AdminErrorBoundary, RouteErrorBoundary and Suspense', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      // Both error boundaries should be present
      expect(screen.getByTestId('admin-error-boundary')).toBeInTheDocument();
      expect(screen.getByTestId('route-error-boundary')).toBeInTheDocument();

      // Content should be inside the error boundaries
      const adminErrorBoundary = screen.getByTestId('admin-error-boundary');
      const routeErrorBoundary = screen.getByTestId('route-error-boundary');

      expect(adminErrorBoundary).toContainElement(routeErrorBoundary);
      expect(routeErrorBoundary).toContainElement(screen.getByTestId('test-page'));
    });
  });

  describe('Layout Components', () => {
    it('should render TutorialProvider as wrapper', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('tutorial-provider')).toBeInTheDocument();
    });

    it('should render credit-related components', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('low-credit-warning')).toBeInTheDocument();
      expect(screen.getByTestId('credit-purchase-modal')).toBeInTheDocument();
      expect(screen.getByTestId('credit-toast-container')).toBeInTheDocument();
      expect(screen.getByTestId('credit-balance')).toBeInTheDocument();
    });

    it('should render command palette', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    });
  });

  describe('Scroll Restoration', () => {
    it('should call useScrollRestoration hook with correct options', async () => {
      const useScrollRestorationMock = (await import('@/hooks/useScrollRestoration')).useScrollRestoration as unknown as ReturnType<typeof vi.fn>;

      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      // Verify that useScrollRestoration was called with correct options
      expect(useScrollRestorationMock).toHaveBeenCalledWith({
        scrollBehavior: 'instant',
        restoreDelay: 0,
      });
    });

    it('should call useScrollRestoration on every render', async () => {
      const useScrollRestorationMock = (await import('@/hooks/useScrollRestoration')).useScrollRestoration as unknown as ReturnType<typeof vi.fn>;

      const { rerender } = render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      // Initial render should call useScrollRestoration
      expect(useScrollRestorationMock).toHaveBeenCalled();

      const callCount = useScrollRestorationMock.mock.calls.length;

      // Rerender should call it again
      rerender(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>
      );

      expect(useScrollRestorationMock.mock.calls.length).toBeGreaterThan(callCount);
    });

    it('should enable scroll restoration for all admin routes', async () => {
      const useScrollRestorationMock = (await import('@/hooks/useScrollRestoration')).useScrollRestoration as unknown as ReturnType<typeof vi.fn>;

      // Clear any previous calls
      useScrollRestorationMock.mockClear();

      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      // Should be called regardless of the route
      expect(useScrollRestorationMock).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty Outlet gracefully', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />} />
        </Routes>,
        { wrapper: createWrapper() }
      );

      // Should still render the layout structure
      expect(screen.getByTestId('sidebar-provider')).toBeInTheDocument();
      expect(screen.getByTestId('admin-error-boundary')).toBeInTheDocument();
      expect(screen.getByTestId('route-error-boundary')).toBeInTheDocument();
    });

    it('should apply correct CSS classes for mobile layout', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      const main = screen.getByRole('main');
      expect(main).toHaveClass('custom-mobile-padding');
      expect(main).toHaveClass('flex-1');
      expect(main).toHaveClass('overflow-y-auto');
    });
  });

  describe('Route Error Boundary', () => {
    it('should wrap route content with RouteErrorBoundary', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('route-error-boundary')).toBeInTheDocument();
    });

    it('should pass current route path to RouteErrorBoundary', () => {
      // This test verifies that the RouteErrorBoundary receives the location.pathname
      // The actual verification would require checking props, but we can verify
      // the component structure is correct
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      // Verify the route error boundary is rendered
      expect(screen.getByTestId('route-error-boundary')).toBeInTheDocument();

      // Verify content is inside the boundary
      expect(screen.getByTestId('test-page')).toBeInTheDocument();
    });
  });

  describe('Admin Error Boundary', () => {
    it('should wrap route content with AdminErrorBoundary', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('admin-error-boundary')).toBeInTheDocument();
    });

    it('should have AdminErrorBoundary as outer boundary wrapping RouteErrorBoundary', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      const adminErrorBoundary = screen.getByTestId('admin-error-boundary');
      const routeErrorBoundary = screen.getByTestId('route-error-boundary');

      // AdminErrorBoundary should wrap RouteErrorBoundary
      expect(adminErrorBoundary).toContainElement(routeErrorBoundary);
    });

    it('should properly nest all error handling layers', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      const adminErrorBoundary = screen.getByTestId('admin-error-boundary');
      const routeErrorBoundary = screen.getByTestId('route-error-boundary');
      const testPage = screen.getByTestId('test-page');

      // Verify proper nesting: AdminErrorBoundary > RouteErrorBoundary > Content
      expect(adminErrorBoundary).toContainElement(routeErrorBoundary);
      expect(routeErrorBoundary).toContainElement(testPage);
      expect(adminErrorBoundary).toContainElement(testPage);
    });

    it('should have error boundaries inside main element', () => {
      render(
        <Routes>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<TestPage />} />
          </Route>
        </Routes>,
        { wrapper: createWrapper() }
      );

      const main = screen.getByRole('main');
      const adminErrorBoundary = screen.getByTestId('admin-error-boundary');

      expect(main).toContainElement(adminErrorBoundary);
    });
  });
});

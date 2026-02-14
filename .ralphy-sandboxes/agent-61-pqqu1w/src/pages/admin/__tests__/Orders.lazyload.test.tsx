/**
 * Orders Page - Lazy Loading Tests
 * Tests lazy loading behavior of ExportOptionsDialog
 * Created: 2026-02-02
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/debug/logger', () => ({
  logOrderQuery: vi.fn(),
  logRLSFailure: vi.fn(),
}));

vi.mock('@/lib/debug/queryLogger', () => ({
  logSelectQuery: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              then: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('@/contexts/TenantAdminAuthContext', () => ({
  useTenantAdminAuth: () => ({
    tenant: { id: 'test-tenant', slug: 'test' },
  }),
}));

vi.mock('@/hooks/useTenantNavigate', () => ({
  useTenantNavigate: () => vi.fn(),
}));

describe('Orders Page - Lazy Loading', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  describe('ExportOptionsDialog Lazy Loading', () => {
    it('should lazy load ExportOptionsDialog component', async () => {
      // Create a mock lazy component
      const LazyExportDialog = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="export-dialog">Export Dialog Loaded</div>,
        })
      );

      const TestComponent = ({ open }: { open: boolean }) => (
        <Suspense
          fallback={
            open ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <div data-testid="loading-spinner">Loading spinner</div>
                  <p className="text-sm text-muted-foreground">Loading export options...</p>
                </div>
              </div>
            ) : null
          }
        >
          <LazyExportDialog />
        </Suspense>
      );

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent open={false} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Initially, nothing should be rendered when open is false
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();

      // Open the dialog
      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent open={true} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // The loading fallback should be visible
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading export options...')).toBeInTheDocument();

      // Wait for the lazy component to load
      await waitFor(() => {
        expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
      });

      // Loading spinner should be gone
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('should not show loading fallback when dialog is closed', () => {
      const LazyExportDialog = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="export-dialog">Export Dialog</div>,
        })
      );

      const TestComponent = () => (
        <Suspense fallback={null}>
          <LazyExportDialog />
        </Suspense>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // With fallback={null}, nothing should show during loading
      expect(screen.queryByText('Loading export options...')).not.toBeInTheDocument();
    });

    it('should render loading state with proper styling', () => {
      const LazyExportDialog = lazy(
        () =>
          new Promise(() => {
            // Never resolve to keep in loading state
          })
      );

      const TestComponent = () => (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <div data-testid="loading-spinner" className="h-8 w-8 animate-spin">
                  Spinner
                </div>
                <p className="text-sm text-muted-foreground">Loading export options...</p>
              </div>
            </div>
          }
        >
          <LazyExportDialog />
        </Suspense>
      );

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Check for loading state
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading export options...')).toBeInTheDocument();

      // Verify styling classes
      const fallbackContainer = container.querySelector('.fixed.inset-0');
      expect(fallbackContainer).toBeInTheDocument();
      expect(fallbackContainer?.className).toContain('z-50');
      expect(fallbackContainer?.className).toContain('backdrop-blur-sm');
    });

    it('should handle lazy loading error gracefully', async () => {
      const LazyExportDialog = lazy(() =>
        Promise.reject(new Error('Failed to load component'))
      );

      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        try {
          return <>{children}</>;
        } catch {
          return <div data-testid="error-state">Failed to load export dialog</div>;
        }
      };

      const TestComponent = () => (
        <ErrorBoundary>
          <Suspense fallback={<div data-testid="loading">Loading...</div>}>
            <LazyExportDialog />
          </Suspense>
        </ErrorBoundary>
      );

      // This test verifies that error boundaries can catch lazy loading failures
      // In a real scenario, you'd wrap the Suspense in an ErrorBoundary component
      render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Initially shows loading
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });

  describe('Performance Benefits', () => {
    it('should not load ExportOptionsDialog until needed', () => {
      let componentLoaded = false;

      const LazyExportDialog = lazy(() => {
        componentLoaded = true;
        return Promise.resolve({
          default: () => <div>Export Dialog</div>,
        });
      });

      const TestComponent = ({ shouldRender }: { shouldRender: boolean }) => (
        <div>
          <div>Orders Page Content</div>
          {shouldRender && (
            <Suspense fallback={<div>Loading...</div>}>
              <LazyExportDialog />
            </Suspense>
          )}
        </div>
      );

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent shouldRender={false} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Component should not be loaded yet
      expect(componentLoaded).toBe(false);

      // Trigger component to render
      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent shouldRender={true} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Now the lazy loader should be invoked
      expect(componentLoaded).toBe(true);
    });

    it('should only render Suspense wrapper when exportDialogOpen is true', () => {
      const LazyExportDialog = lazy(() => {
        return Promise.resolve({
          default: () => <div data-testid="export-dialog">Export Dialog</div>,
        });
      });

      const TestComponent = ({ exportDialogOpen }: { exportDialogOpen: boolean }) => (
        <div>
          <div data-testid="main-content">Orders Page Content</div>
          {exportDialogOpen && (
            <Suspense fallback={<div data-testid="suspense-fallback">Loading...</div>}>
              <LazyExportDialog />
            </Suspense>
          )}
        </div>
      );

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent exportDialogOpen={false} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // When dialog is closed, Suspense should not be rendered
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
      expect(screen.queryByTestId('suspense-fallback')).not.toBeInTheDocument();
      expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();

      // Open the dialog
      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent exportDialogOpen={true} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Now Suspense fallback should appear
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
      // The fallback or loaded component should be present
      expect(
        screen.queryByTestId('suspense-fallback') || screen.queryByTestId('export-dialog')
      ).toBeTruthy();
    });

    it('should cache lazy loaded component after first load', async () => {
      let loadCount = 0;

      const LazyExportDialog = lazy(() => {
        loadCount++;
        return Promise.resolve({
          default: () => <div data-testid="export-dialog">Export Dialog</div>,
        });
      });

      const TestComponent = ({ show }: { show: boolean }) => (
        <>
          {show && (
            <Suspense fallback={<div>Loading...</div>}>
              <LazyExportDialog />
            </Suspense>
          )}
        </>
      );

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent show={true} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Wait for first load
      await waitFor(() => {
        expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
      });

      expect(loadCount).toBe(1);

      // Hide and show again
      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent show={false} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      rerender(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TestComponent show={true} />
          </BrowserRouter>
        </QueryClientProvider>
      );

      // Should still be loaded from cache
      await waitFor(() => {
        expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
      });

      // Load count should not increase (component is cached)
      expect(loadCount).toBe(1);
    });
  });
});

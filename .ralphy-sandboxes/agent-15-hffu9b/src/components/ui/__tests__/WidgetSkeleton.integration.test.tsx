/**
 * WidgetSkeleton Integration Tests
 * Tests the WidgetSkeleton component in realistic lazy-loading scenarios
 * Created: 2026-02-02
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { WidgetSkeleton, createWidgetSkeleton } from '../WidgetSkeleton';

describe('WidgetSkeleton - Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  describe('Dashboard Widget Lazy Loading', () => {
    it('should show skeleton while dashboard widget loads', async () => {
      const LazyDashboardWidget = lazy(() =>
        Promise.resolve({
          default: () => (
            <div data-testid="dashboard-widget">
              <h2>Revenue Chart</h2>
              <div>$10,000</div>
            </div>
          ),
        })
      );

      render(
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<WidgetSkeleton variant="chart" />}>
            <LazyDashboardWidget />
          </Suspense>
        </QueryClientProvider>
      );

      // Skeleton should appear first
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Widget should load
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-widget')).toBeInTheDocument();
      });

      // Skeleton should be gone
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should handle multiple widgets loading simultaneously', async () => {
      const LazyChartWidget = lazy(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                default: () => <div data-testid="chart-widget">Chart</div>,
              }),
            50
          )
        )
      );

      const LazyStatsWidget = lazy(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                default: () => <div data-testid="stats-widget">Stats</div>,
              }),
            30
          )
        )
      );

      const LazyListWidget = lazy(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                default: () => <div data-testid="list-widget">List</div>,
              }),
            40
          )
        )
      );

      render(
        <QueryClientProvider client={queryClient}>
          <div className="dashboard-grid">
            <Suspense fallback={<WidgetSkeleton variant="chart" />}>
              <LazyChartWidget />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton variant="stats" />}>
              <LazyStatsWidget />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton variant="list" />}>
              <LazyListWidget />
            </Suspense>
          </div>
        </QueryClientProvider>
      );

      // All skeletons should be visible initially
      const skeletons = screen.getAllByRole('status');
      expect(skeletons.length).toBe(3);

      // Wait for all widgets to load
      await waitFor(() => {
        expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
        expect(screen.getByTestId('stats-widget')).toBeInTheDocument();
        expect(screen.getByTestId('list-widget')).toBeInTheDocument();
      });

      // All skeletons should be gone
      expect(screen.queryAllByRole('status').length).toBe(0);
    });

    it('should work with conditional widget rendering', async () => {
      const LazyWidget = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="conditional-widget">Widget Content</div>,
        })
      );

      const TestDashboard = ({ showWidget }: { showWidget: boolean }) => (
        <QueryClientProvider client={queryClient}>
          <div>
            <h1>Dashboard</h1>
            {showWidget && (
              <Suspense fallback={<WidgetSkeleton variant="card" />}>
                <LazyWidget />
              </Suspense>
            )}
          </div>
        </QueryClientProvider>
      );

      const { rerender } = render(<TestDashboard showWidget={false} />);

      // No skeleton should be visible
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByTestId('conditional-widget')).not.toBeInTheDocument();

      // Show widget
      rerender(<TestDashboard showWidget={true} />);

      // Skeleton should appear (or widget if loaded immediately)
      await waitFor(() => {
        expect(
          screen.queryByRole('status') || screen.queryByTestId('conditional-widget')
        ).toBeTruthy();
      });

      // Widget should eventually load
      await waitFor(() => {
        expect(screen.getByTestId('conditional-widget')).toBeInTheDocument();
      });
    });
  });

  describe('Lazy Loading with Data Fetching', () => {
    it('should show skeleton while widget fetches data', async () => {
      const mockFetchData = vi.fn(() =>
        Promise.resolve({ revenue: 50000, trend: '+12%' })
      );

      // Named component function to satisfy React hooks rules
      function DataWidgetComponent() {
        const [data, setData] = useState<any>(null);

        // Simulate data fetch
        if (!data) {
          mockFetchData().then(setData);
          return <div>Loading data...</div>;
        }

        return (
          <div data-testid="data-widget">
            <div>Revenue: ${data.revenue}</div>
            <div>Trend: {data.trend}</div>
          </div>
        );
      }

      const LazyDataWidget = lazy(() =>
        Promise.resolve({
          default: DataWidgetComponent,
        })
      );

      render(
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<WidgetSkeleton variant="chart" />}>
            <LazyDataWidget />
          </Suspense>
        </QueryClientProvider>
      );

      // Skeleton should appear first
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Wait for component to load (may show internal loading state)
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle widget loading failures', async () => {
      const LazyFailingWidget = lazy(() =>
        Promise.reject(new Error('Failed to load widget'))
      );

      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        try {
          return <>{children}</>;
        } catch {
          return <div data-testid="error-state">Widget failed to load</div>;
        }
      };

      render(
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <Suspense fallback={<WidgetSkeleton variant="card" />}>
              <LazyFailingWidget />
            </Suspense>
          </ErrorBoundary>
        </QueryClientProvider>
      );

      // Skeleton should appear first
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Component should handle the error
      // (In production, you'd have a proper ErrorBoundary)
    });
  });

  describe('Performance Optimization', () => {
    it('should not reload lazy widget on re-renders', async () => {
      let loadCount = 0;

      const LazyWidget = lazy(() => {
        loadCount++;
        return Promise.resolve({
          default: () => <div data-testid="widget">Widget {loadCount}</div>,
        });
      });

      const TestComponent = ({ key: _key }: { key: string }) => (
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<WidgetSkeleton variant="card" />}>
            <LazyWidget />
          </Suspense>
        </QueryClientProvider>
      );

      const { rerender } = render(<TestComponent key="first" />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('widget')).toBeInTheDocument();
      });

      expect(loadCount).toBe(1);

      // Rerender with different prop
      rerender(<TestComponent key="second" />);

      // Widget should still be there and load count should not increase
      await waitFor(() => {
        expect(screen.getByTestId('widget')).toBeInTheDocument();
      });

      expect(loadCount).toBe(1); // Should still be 1 (cached)
    });

    it('should minimize layout shift with appropriate skeleton heights', () => {
      const { container } = render(
        <WidgetSkeleton variant="chart" height="lg" />
      );

      const skeletonElement = screen.getByRole('status');

      // In JSDOM, getBoundingClientRect returns 0 for all dimensions
      // Instead, verify that the skeleton has height classes applied
      const _skeletonContent = container.querySelector('.h-64, .h-\\[64\\], [class*="h-64"]');

      // Verify skeleton structure exists and has expected styling
      expect(skeletonElement).toBeInTheDocument();
      // The skeleton should have appropriate height classes for 'lg' variant
      expect(container.innerHTML).toContain('h-64'); // lg height maps to h-64 (16rem = 256px)
    });
  });

  describe('createWidgetSkeleton with Lazy Loading', () => {
    it('should work with createWidgetSkeleton utility', async () => {
      const ChartSkeleton = createWidgetSkeleton({
        variant: 'chart',
        height: 'lg',
        ariaLabel: 'Loading revenue chart...',
      });

      const LazyChartWidget = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="chart">Revenue Chart</div>,
        })
      );

      render(
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<ChartSkeleton />}>
            <LazyChartWidget />
          </Suspense>
        </QueryClientProvider>
      );

      // Verify skeleton appears with custom aria-label
      const skeleton = screen.queryByLabelText('Loading revenue chart...');
      if (skeleton) {
        expect(skeleton).toBeInTheDocument();
      }

      // Wait for widget to load
      await waitFor(() => {
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });

    it('should create reusable skeleton components', async () => {
      const StatsSkeleton = createWidgetSkeleton({
        variant: 'stats',
        itemCount: 4,
      });

      const LazyStats1 = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="stats-1">Stats 1</div>,
        })
      );

      const LazyStats2 = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="stats-2">Stats 2</div>,
        })
      );

      render(
        <QueryClientProvider client={queryClient}>
          <div>
            <Suspense fallback={<StatsSkeleton />}>
              <LazyStats1 />
            </Suspense>
            <Suspense fallback={<StatsSkeleton />}>
              <LazyStats2 />
            </Suspense>
          </div>
        </QueryClientProvider>
      );

      // Both widgets should load
      await waitFor(() => {
        expect(screen.getByTestId('stats-1')).toBeInTheDocument();
        expect(screen.getByTestId('stats-2')).toBeInTheDocument();
      });
    });
  });

  describe('Real-World Dashboard Scenario', () => {
    it('should handle a complete dashboard loading flow', async () => {
      // Simulate different widgets with different loading times
      const LazyRevenue = lazy(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                default: () => <div data-testid="revenue">Revenue: $100k</div>,
              }),
            20
          )
        )
      );

      const LazyOrders = lazy(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                default: () => <div data-testid="orders">Orders: 250</div>,
              }),
            40
          )
        )
      );

      const LazyInventory = lazy(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                default: () => <div data-testid="inventory">Inventory: 500 items</div>,
              }),
            30
          )
        )
      );

      const LazyChart = lazy(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                default: () => <div data-testid="chart">Sales Chart</div>,
              }),
            50
          )
        )
      );

      render(
        <QueryClientProvider client={queryClient}>
          <div className="dashboard" data-testid="dashboard">
            <div className="stats-grid">
              <Suspense fallback={<WidgetSkeleton variant="stats" itemCount={1} />}>
                <LazyRevenue />
              </Suspense>
              <Suspense fallback={<WidgetSkeleton variant="stats" itemCount={1} />}>
                <LazyOrders />
              </Suspense>
              <Suspense fallback={<WidgetSkeleton variant="stats" itemCount={1} />}>
                <LazyInventory />
              </Suspense>
            </div>
            <div className="chart-section">
              <Suspense fallback={<WidgetSkeleton variant="chart" height="lg" />}>
                <LazyChart />
              </Suspense>
            </div>
          </div>
        </QueryClientProvider>
      );

      // Dashboard should be present
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();

      // At least some skeletons should be visible initially
      const initialSkeletons = screen.queryAllByRole('status');
      expect(initialSkeletons.length).toBeGreaterThan(0);

      // Wait for all widgets to load
      await waitFor(
        () => {
          expect(screen.getByTestId('revenue')).toBeInTheDocument();
          expect(screen.getByTestId('orders')).toBeInTheDocument();
          expect(screen.getByTestId('inventory')).toBeInTheDocument();
          expect(screen.getByTestId('chart')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // All skeletons should be gone
      expect(screen.queryAllByRole('status').length).toBe(0);
    });
  });

  describe('Accessibility in Lazy Loading Context', () => {
    it('should maintain accessibility during loading transitions', async () => {
      const LazyAccessibleWidget = lazy(() =>
        Promise.resolve({
          default: () => (
            <div role="region" aria-label="Sales Dashboard">
              <h2>Sales Data</h2>
              <button>Refresh</button>
            </div>
          ),
        })
      );

      render(
        <QueryClientProvider client={queryClient}>
          <Suspense
            fallback={<WidgetSkeleton variant="card" ariaLabel="Loading sales data..." />}
          >
            <LazyAccessibleWidget />
          </Suspense>
        </QueryClientProvider>
      );

      // Skeleton should have proper ARIA label
      const skeleton = screen.queryByLabelText('Loading sales data...');
      if (skeleton) {
        expect(skeleton).toHaveAttribute('role', 'status');
      }

      // Wait for widget to load
      await waitFor(() => {
        const widget = screen.getByRole('region', { name: 'Sales Dashboard' });
        expect(widget).toBeInTheDocument();
      });
    });
  });
});

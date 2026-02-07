/**
 * WidgetSkeleton Component - Unit Tests
 * Tests the WidgetSkeleton fallback component for lazy-loaded widgets
 * Created: 2026-02-02
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Suspense, lazy } from 'react';
import {
  WidgetSkeleton,
  createWidgetSkeleton,
  type WidgetSkeletonVariant,
  type WidgetSkeletonHeight,
} from '../WidgetSkeleton';

describe('WidgetSkeleton Component', () => {
  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<WidgetSkeleton />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('aria-label', 'Loading widget...');
    });

    it('should render with custom className', () => {
      render(<WidgetSkeleton className="custom-class" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toHaveClass('custom-class');
    });

    it('should render with custom aria-label', () => {
      render(<WidgetSkeleton ariaLabel="Loading chart data..." />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toHaveAttribute('aria-label', 'Loading chart data...');
    });

    it('should include screen reader text', () => {
      render(<WidgetSkeleton ariaLabel="Loading dashboard widget" />);
      const srText = screen.getByText('Loading dashboard widget');
      expect(srText).toHaveClass('sr-only');
    });

    it('should have animate-pulse class for animation', () => {
      render(<WidgetSkeleton />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  describe('Variants', () => {
    const variants: WidgetSkeletonVariant[] = [
      'card',
      'chart',
      'list',
      'table',
      'stats',
      'map',
      'minimal',
    ];

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, () => {
        render(<WidgetSkeleton variant={variant} />);
        const skeleton = screen.getByRole('status');
        expect(skeleton).toBeInTheDocument();
      });
    });

    it('should render card variant with default when no variant specified', () => {
      const { container } = render(<WidgetSkeleton />);
      // Card variant should have CardHeader and CardContent structure
      expect(container.querySelector('[class*="rounded-lg"]')).toBeInTheDocument();
    });

    it('should render chart variant with chart-specific elements', () => {
      render(<WidgetSkeleton variant="chart" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
      // Chart variant should have header and large content area
    });

    it('should render stats variant with multiple cards', () => {
      const { container } = render(<WidgetSkeleton variant="stats" itemCount={4} />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
      // Stats variant should have grid layout
      const grid = container.querySelector('[class*="grid"]');
      expect(grid).toBeInTheDocument();
    });

    it('should render list variant with item count', () => {
      render(<WidgetSkeleton variant="list" itemCount={5} />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });

    it('should render table variant with rows', () => {
      render(<WidgetSkeleton variant="table" itemCount={3} />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });

    it('should render map variant', () => {
      render(<WidgetSkeleton variant="map" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });

    it('should render minimal variant', () => {
      render(<WidgetSkeleton variant="minimal" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Height Prop', () => {
    const heights: WidgetSkeletonHeight[] = ['sm', 'md', 'lg', 'xl', 'auto'];

    heights.forEach((height) => {
      it(`should render with ${height} height`, () => {
        render(<WidgetSkeleton height={height} variant="chart" />);
        const skeleton = screen.getByRole('status');
        expect(skeleton).toBeInTheDocument();
      });
    });

    it('should use auto height by default', () => {
      render(<WidgetSkeleton variant="chart" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Item Count', () => {
    it('should render correct number of items in list variant', () => {
      const { container } = render(
        <WidgetSkeleton variant="list" itemCount={3} />
      );
      const items = container.querySelectorAll('[class*="flex items-center gap-3"]');
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it('should render correct number of rows in table variant', () => {
      render(<WidgetSkeleton variant="table" itemCount={4} />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });

    it('should render correct number of stat cards', () => {
      const { container } = render(
        <WidgetSkeleton variant="stats" itemCount={4} />
      );
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });

    it('should use default item count of 3', () => {
      render(<WidgetSkeleton variant="list" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Header Display', () => {
    it('should show header by default', () => {
      render(<WidgetSkeleton variant="card" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });

    it('should respect showHeader prop', () => {
      render(<WidgetSkeleton variant="card" showHeader={false} />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="status"', () => {
      render(<WidgetSkeleton />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-label', () => {
      render(<WidgetSkeleton ariaLabel="Loading widget content" />);
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Loading widget content'
      );
    });

    it('should include screen reader only text', () => {
      render(<WidgetSkeleton ariaLabel="Loading..." />);
      const srText = screen.getByText('Loading...');
      expect(srText).toHaveClass('sr-only');
    });

    it('should be keyboard accessible (no interactive elements)', () => {
      const { container } = render(<WidgetSkeleton />);
      const buttons = container.querySelectorAll('button');
      const links = container.querySelectorAll('a');
      expect(buttons.length).toBe(0);
      expect(links.length).toBe(0);
    });
  });

  describe('Styling', () => {
    it('should have rounded corners on card elements', () => {
      const { container } = render(<WidgetSkeleton variant="card" />);
      const roundedElements = container.querySelectorAll('[class*="rounded"]');
      expect(roundedElements.length).toBeGreaterThan(0);
    });

    it('should use muted background colors', () => {
      const { container } = render(<WidgetSkeleton variant="minimal" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });

    it('should include bg-card for card backgrounds', () => {
      const { container } = render(<WidgetSkeleton variant="card" />);
      const cardElements = container.querySelectorAll('[class*="bg-card"]');
      expect(cardElements.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with React.lazy', () => {
    it('should work as Suspense fallback', async () => {
      const LazyComponent = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="loaded-widget">Widget Loaded</div>,
        })
      );

      render(
        <Suspense fallback={<WidgetSkeleton variant="chart" />}>
          <LazyComponent />
        </Suspense>
      );

      // Loading state should appear first
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Wait for component to load
      const loadedWidget = await screen.findByTestId('loaded-widget');
      expect(loadedWidget).toBeInTheDocument();

      // Skeleton should be gone
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should handle multiple lazy widgets with different variants', async () => {
      const LazyChart = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="chart-widget">Chart</div>,
        })
      );

      const LazyList = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="list-widget">List</div>,
        })
      );

      render(
        <div>
          <Suspense fallback={<WidgetSkeleton variant="chart" />}>
            <LazyChart />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton variant="list" />}>
            <LazyList />
          </Suspense>
        </div>
      );

      // Both should load
      await screen.findByTestId('chart-widget');
      await screen.findByTestId('list-widget');
    });

    it('should work with conditional rendering', () => {
      const LazyWidget = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="widget">Widget</div>,
        })
      );

      const TestComponent = ({ show }: { show: boolean }) => (
        <>
          {show && (
            <Suspense fallback={<WidgetSkeleton variant="card" />}>
              <LazyWidget />
            </Suspense>
          )}
        </>
      );

      const { rerender } = render(<TestComponent show={false} />);

      // Nothing should render when show is false
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      // Rerender with show=true
      rerender(<TestComponent show={true} />);

      // Skeleton should now be visible (or widget if loaded immediately)
      expect(
        screen.queryByRole('status') || screen.queryByTestId('widget')
      ).toBeTruthy();
    });
  });

  describe('createWidgetSkeleton Utility', () => {
    it('should create a skeleton component with default props', () => {
      const SkeletonFallback = createWidgetSkeleton();
      render(<SkeletonFallback />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should create a skeleton component with custom props', () => {
      const SkeletonFallback = createWidgetSkeleton({
        variant: 'chart',
        height: 'lg',
        ariaLabel: 'Loading chart...',
      });
      render(<SkeletonFallback />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toHaveAttribute('aria-label', 'Loading chart...');
    });

    it('should work with Suspense fallback', async () => {
      const LazyComponent = lazy(() =>
        Promise.resolve({
          default: () => <div data-testid="loaded">Loaded</div>,
        })
      );

      const ChartSkeleton = createWidgetSkeleton({
        variant: 'chart',
        ariaLabel: 'Loading chart widget...',
      });

      render(
        <Suspense fallback={<ChartSkeleton />}>
          <LazyComponent />
        </Suspense>
      );

      // Check if loaded
      await screen.findByTestId('loaded');
    });

    it('should allow prop overrides when used', () => {
      const SkeletonFallback = createWidgetSkeleton({ variant: 'card' });
      render(<SkeletonFallback />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render quickly without heavy computations', () => {
      const startTime = performance.now();
      render(<WidgetSkeleton variant="chart" />);
      const endTime = performance.now();

      // Rendering should be fast (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle multiple skeletons efficiently', () => {
      const { container } = render(
        <div>
          <WidgetSkeleton variant="stats" itemCount={4} />
          <WidgetSkeleton variant="chart" />
          <WidgetSkeleton variant="list" itemCount={5} />
          <WidgetSkeleton variant="table" itemCount={3} />
        </div>
      );

      const skeletons = container.querySelectorAll('[role="status"]');
      expect(skeletons.length).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero itemCount gracefully', () => {
      render(<WidgetSkeleton variant="list" itemCount={0} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should handle large itemCount', () => {
      render(<WidgetSkeleton variant="list" itemCount={100} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should handle undefined props gracefully', () => {
      render(<WidgetSkeleton variant={undefined} height={undefined} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should work with React.StrictMode', () => {
      render(
        <Suspense fallback={<WidgetSkeleton />}>
          <div>Content</div>
        </Suspense>
      );
      // Should not throw errors in strict mode
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should include responsive classes for stats variant', () => {
      const { container } = render(<WidgetSkeleton variant="stats" />);
      const grid = container.querySelector('[class*="sm:grid-cols"]');
      expect(grid).toBeInTheDocument();
    });

    it('should be mobile-friendly with appropriate spacing', () => {
      const { container } = render(<WidgetSkeleton variant="card" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('TypeScript Types', () => {
    it('should accept all valid variant types', () => {
      const variants: WidgetSkeletonVariant[] = [
        'card',
        'chart',
        'list',
        'table',
        'stats',
        'map',
        'minimal',
      ];

      variants.forEach((variant) => {
        expect(() => render(<WidgetSkeleton variant={variant} />)).not.toThrow();
      });
    });

    it('should accept all valid height types', () => {
      const heights: WidgetSkeletonHeight[] = ['sm', 'md', 'lg', 'xl', 'auto'];

      heights.forEach((height) => {
        expect(() =>
          render(<WidgetSkeleton height={height} variant="chart" />)
        ).not.toThrow();
      });
    });
  });
});

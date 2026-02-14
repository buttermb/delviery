import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { RouteTransitionWrapper } from '../RouteTransitionWrapper';
import * as useViewTransitionSupportModule from '@/hooks/useViewTransitionSupport';

// Mock useViewTransitionSupport
vi.mock('@/hooks/useViewTransitionSupport', () => ({
  useViewTransitionSupport: vi.fn(),
}));

// Test component that can trigger navigation
function TestNavigator({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)}>Navigate</button>
  );
}

describe('RouteTransitionWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('with View Transitions API support', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
    });

    it('should render children correctly', () => {
      render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <div>Test Content</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should not apply fallback transition classes', () => {
      const { container } = render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <div>Test Content</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      const wrapper = container.querySelector('[data-route-content]');
      expect(wrapper).not.toHaveClass('route-transition-fallback');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <MemoryRouter>
          <RouteTransitionWrapper className="custom-class">
            <div>Test Content</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      const wrapper = container.querySelector('[data-route-content]');
      expect(wrapper).toHaveClass('custom-class');
    });

    it('should have data-route-content attribute', () => {
      const { container } = render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <div>Test Content</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      expect(container.querySelector('[data-route-content]')).toBeInTheDocument();
    });
  });

  describe('without View Transitions API support (fallback mode)', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
    });

    it('should apply fallback transition class', () => {
      const { container } = render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <div>Test Content</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      const wrapper = container.querySelector('[data-route-content]');
      expect(wrapper).toHaveClass('route-transition-fallback');
    });

    it('should apply enter animation classes on route change', async () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/page1']}>
          <Routes>
            <Route
              path="/page1"
              element={
                <RouteTransitionWrapper>
                  <div>Page 1</div>
                  <TestNavigator to="/page2" />
                </RouteTransitionWrapper>
              }
            />
            <Route
              path="/page2"
              element={
                <RouteTransitionWrapper>
                  <div>Page 2</div>
                </RouteTransitionWrapper>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Click navigation button
      const navButton = screen.getByText('Navigate');

      await act(async () => {
        navButton.click();
        await vi.runAllTimersAsync();
      });

      // Check for animation classes
      const wrapper = container.querySelector('[data-route-content]');
      expect(wrapper).toHaveClass('route-transition-enter');
      expect(wrapper).toHaveClass('route-transition-enter-active');
    });

    it('should remove animation classes after timeout', async () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/page1']}>
          <Routes>
            <Route
              path="/page1"
              element={
                <RouteTransitionWrapper>
                  <div>Page 1</div>
                  <TestNavigator to="/page2" />
                </RouteTransitionWrapper>
              }
            />
            <Route
              path="/page2"
              element={
                <RouteTransitionWrapper>
                  <div>Page 2</div>
                </RouteTransitionWrapper>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Navigate to page 2
      const navButton = screen.getByText('Navigate');

      await act(async () => {
        navButton.click();
        await vi.runAllTimersAsync();
      });

      // Fast-forward time to after animation completes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      // Animation classes should be removed
      const wrapper = container.querySelector('[data-route-content]');
      expect(wrapper).not.toHaveClass('route-transition-enter');
      expect(wrapper).not.toHaveClass('route-transition-enter-active');
    });

    it('should render children correctly', () => {
      render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <div>Test Content</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should combine custom className with fallback class', () => {
      const { container } = render(
        <MemoryRouter>
          <RouteTransitionWrapper className="custom-class">
            <div>Test Content</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      const wrapper = container.querySelector('[data-route-content]');
      expect(wrapper).toHaveClass('route-transition-fallback');
      expect(wrapper).toHaveClass('custom-class');
    });
  });

  describe('route change detection', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
    });

    it('should detect route changes', async () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/page1']}>
          <Routes>
            <Route
              path="/page1"
              element={
                <RouteTransitionWrapper>
                  <div>Page 1</div>
                  <TestNavigator to="/page2" />
                </RouteTransitionWrapper>
              }
            />
            <Route
              path="/page2"
              element={
                <RouteTransitionWrapper>
                  <div>Page 2</div>
                  <TestNavigator to="/page3" />
                </RouteTransitionWrapper>
              }
            />
            <Route
              path="/page3"
              element={
                <RouteTransitionWrapper>
                  <div>Page 3</div>
                </RouteTransitionWrapper>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Navigate to page 2
      await act(async () => {
        screen.getByText('Navigate').click();
        await vi.runAllTimersAsync();
      });

      // Navigate to page 3
      await act(async () => {
        screen.getByText('Navigate').click();
        await vi.runAllTimersAsync();
      });

      // Each navigation should trigger animation
      const wrapper = container.querySelector('[data-route-content]');
      expect(wrapper).toHaveClass('route-transition-enter');
    });

    it('should not trigger animation when staying on same route', async () => {
      const { container, rerender } = render(
        <MemoryRouter initialEntries={['/page1']}>
          <RouteTransitionWrapper>
            <div>Page 1</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      const wrapperBefore = container.querySelector('[data-route-content]');
      const classListBefore = wrapperBefore?.className;

      // Rerender without route change
      rerender(
        <MemoryRouter initialEntries={['/page1']}>
          <RouteTransitionWrapper>
            <div>Page 1</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      const wrapperAfter = container.querySelector('[data-route-content]');
      const classListAfter = wrapperAfter?.className;

      // Classes should remain the same
      expect(classListBefore).toBe(classListAfter);
    });
  });

  describe('accessibility', () => {
    it('should not interfere with screen readers', () => {
      render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <h1>Page Title</h1>
            <p>Page content</p>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: 'Page Title' })).toBeInTheDocument();
    });

    it('should preserve element structure', () => {
      const { container } = render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <main>
              <article>Content</article>
            </main>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      expect(container.querySelector('main')).toBeInTheDocument();
      expect(container.querySelector('article')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
    });

    it('should handle rapid route changes', async () => {
      render(
        <MemoryRouter initialEntries={['/page1']}>
          <Routes>
            <Route
              path="/page1"
              element={
                <RouteTransitionWrapper>
                  <div>Page 1</div>
                  <TestNavigator to="/page2" />
                </RouteTransitionWrapper>
              }
            />
            <Route
              path="/page2"
              element={
                <RouteTransitionWrapper>
                  <div>Page 2</div>
                  <TestNavigator to="/page3" />
                </RouteTransitionWrapper>
              }
            />
            <Route
              path="/page3"
              element={
                <RouteTransitionWrapper>
                  <div>Page 3</div>
                </RouteTransitionWrapper>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Rapidly navigate
      await act(async () => {
        screen.getByText('Navigate').click();
        await vi.runAllTimersAsync();
      });

      await act(async () => {
        screen.getByText('Navigate').click();
        await vi.runAllTimersAsync();
      });

      // Should not crash
      expect(screen.getByText('Page 3')).toBeInTheDocument();
    });

    it('should cleanup timeouts on unmount', () => {
      const { unmount } = render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <div>Test Content</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      // Unmount before timeout completes
      unmount();

      // Advance timers - should not cause errors
      expect(() => vi.advanceTimersByTime(300)).not.toThrow();
    });

    it('should handle null children gracefully', () => {
      render(
        <MemoryRouter>
          <RouteTransitionWrapper>{null}</RouteTransitionWrapper>
        </MemoryRouter>
      );

      // Should not crash
      expect(document.querySelector('[data-route-content]')).toBeInTheDocument();
    });

    it('should handle multiple children', () => {
      render(
        <MemoryRouter>
          <RouteTransitionWrapper>
            <div>Child 1</div>
            <div>Child 2</div>
            <div>Child 3</div>
          </RouteTransitionWrapper>
        </MemoryRouter>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });
  });
});

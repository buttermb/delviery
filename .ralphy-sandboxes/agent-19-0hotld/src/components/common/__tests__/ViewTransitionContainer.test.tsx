import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ViewTransitionContainer } from '../ViewTransitionContainer';
import * as useViewTransitionSupportModule from '@/hooks/useViewTransitionSupport';

// Mock the useViewTransitionSupport hook
vi.mock('@/hooks/useViewTransitionSupport', () => ({
  useViewTransitionSupport: vi.fn(),
}));

describe('ViewTransitionContainer', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    // Store original
    originalMatchMedia = window.matchMedia;

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    // Restore original
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );

  describe('Rendering', () => {
    it('should render children correctly', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      render(
        <ViewTransitionContainer>
          <div data-testid="child">Test Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = render(
        <ViewTransitionContainer className="custom-class">
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toHaveClass('custom-class');
    });

    it('should render with data attributes', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = render(
        <ViewTransitionContainer>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toHaveAttribute('data-view-transition-container');
      expect(containerElement).toHaveAttribute('data-supports-view-transitions');
      expect(containerElement).toHaveAttribute('data-prefers-reduced-motion');
    });
  });

  describe('View Transitions Support', () => {
    it('should indicate View Transitions support when available', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = render(
        <ViewTransitionContainer>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toHaveAttribute('data-supports-view-transitions', 'true');
    });

    it('should indicate lack of View Transitions support when unavailable', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { container } = render(
        <ViewTransitionContainer>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toHaveAttribute('data-supports-view-transitions', 'false');
    });
  });

  describe('Reduced Motion Support', () => {
    it('should detect when user prefers reduced motion', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { container } = render(
        <ViewTransitionContainer>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toHaveAttribute('data-prefers-reduced-motion', 'true');
    });

    it('should detect when user does not prefer reduced motion', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { container } = render(
        <ViewTransitionContainer>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toHaveAttribute('data-prefers-reduced-motion', 'false');
    });
  });

  describe('Configuration Options', () => {
    it('should handle custom duration', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { container } = render(
        <ViewTransitionContainer duration={500}>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toBeInTheDocument();
    });

    it('should handle enabled prop', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { container } = render(
        <ViewTransitionContainer enabled={false}>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toBeInTheDocument();
    });

    it('should handle custom transitionClass', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { container } = render(
        <ViewTransitionContainer transitionClass="custom-transition">
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toBeInTheDocument();
    });

    it('should use default options when not specified', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { container } = render(
        <ViewTransitionContainer>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty children', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { container } = render(
        <ViewTransitionContainer>{null}</ViewTransitionContainer>,
        { wrapper }
      );

      const containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toBeInTheDocument();
    });

    it('should handle multiple children', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      render(
        <ViewTransitionContainer>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
          <div data-testid="child3">Child 3</div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
      expect(screen.getByTestId('child3')).toBeInTheDocument();
    });

    it('should handle nested containers', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { container } = render(
        <ViewTransitionContainer>
          <ViewTransitionContainer>
            <div data-testid="nested">Nested Content</div>
          </ViewTransitionContainer>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const containers = container.querySelectorAll('[data-view-transition-container]');
      expect(containers.length).toBe(2);
      expect(screen.getByTestId('nested')).toBeInTheDocument();
    });
  });

  describe('Re-rendering', () => {
    it('should handle prop changes', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const TestComponent = ({ className }: { className: string }) => (
        <BrowserRouter>
          <ViewTransitionContainer className={className}>
            <div>Content</div>
          </ViewTransitionContainer>
        </BrowserRouter>
      );

      const { rerender, container } = render(<TestComponent className="class-1" />);

      let containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toHaveClass('class-1');

      rerender(<TestComponent className="class-2" />);

      containerElement = container.querySelector('[data-view-transition-container]');
      expect(containerElement).toHaveClass('class-2');
    });

    it('should handle children updates', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const TestComponent = ({ content }: { content: string }) => (
        <BrowserRouter>
          <ViewTransitionContainer>
            <div data-testid="content">{content}</div>
          </ViewTransitionContainer>
        </BrowserRouter>
      );

      const { rerender } = render(<TestComponent content="Original" />);

      expect(screen.getByText('Original')).toBeInTheDocument();

      rerender(<TestComponent content="Updated" />);

      expect(screen.getByText('Updated')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should not interfere with accessibility', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      render(
        <ViewTransitionContainer>
          <button aria-label="Test Button">Click Me</button>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const button = screen.getByRole('button', { name: 'Test Button' });
      expect(button).toBeInTheDocument();
    });

    it('should preserve ARIA attributes', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      render(
        <ViewTransitionContainer>
          <div role="main" aria-label="Main Content">
            Content
          </div>
        </ViewTransitionContainer>,
        { wrapper }
      );

      const mainContent = screen.getByRole('main', { name: 'Main Content' });
      expect(mainContent).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render quickly', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const start = performance.now();
      render(
        <ViewTransitionContainer>
          <div>Content</div>
        </ViewTransitionContainer>,
        { wrapper }
      );
      const end = performance.now();

      // Should render in reasonable time (< 100ms)
      expect(end - start).toBeLessThan(100);
    });

    it('should handle many children efficiently', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const children = Array.from({ length: 100 }, (_, i) => (
        <div key={i}>Item {i}</div>
      ));

      const start = performance.now();
      render(
        <ViewTransitionContainer>{children}</ViewTransitionContainer>,
        { wrapper }
      );
      const end = performance.now();

      // Should render efficiently even with many children
      expect(end - start).toBeLessThan(200);
    });
  });
});

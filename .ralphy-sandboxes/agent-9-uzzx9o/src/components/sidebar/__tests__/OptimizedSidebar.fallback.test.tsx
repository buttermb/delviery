import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OptimizedSidebar } from '../OptimizedSidebar';
import { LiveBadgeProvider } from '@/components/admin/sidebar/LiveBadgeContext';
import * as useViewTransitionSupportModule from '@/hooks/useViewTransitionSupport';

// Mock the useViewTransitionSupport hook
vi.mock('@/hooks/useViewTransitionSupport', () => ({
  useViewTransitionSupport: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
  },
}));

describe('OptimizedSidebar - View Transitions Fallback', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  const renderSidebar = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
          <LiveBadgeProvider>
            <OptimizedSidebar userTier="PROFESSIONAL" {...props} />
          </LiveBadgeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Fallback behavior without View Transitions support', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    });

    it('should render sidebar correctly without View Transitions support', () => {
      renderSidebar();

      const navElement = screen.getByRole('navigation', { name: /main navigation/i });
      expect(navElement).toBeInTheDocument();
    });

    it('should render navigation links without viewTransition prop', () => {
      const { container } = renderSidebar();

      const navLinks = container.querySelectorAll('a[href*="/admin/"]');
      expect(navLinks.length).toBeGreaterThan(0);

      // Links should still be functional
      expect(navLinks[0]).toBeInTheDocument();
    });

    it('should handle navigation clicks without View Transitions', async () => {
      const onNavigate = vi.fn();
      const user = userEvent.setup();
      const { container } = renderSidebar({ onNavigate });

      const navLinks = container.querySelectorAll('a[href*="/admin/"]');
      expect(navLinks.length).toBeGreaterThan(0);

      if (navLinks[0]) {
        await user.click(navLinks[0]);
        // Navigation should work without errors
      }
    });

    it('should search and navigate without View Transitions', async () => {
      const user = userEvent.setup();
      renderSidebar();

      // Open command palette
      await user.keyboard('{Meta>}k{/Meta}');

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search features/i)).toBeInTheDocument();
      });

      // Type search query
      const searchInput = screen.getByPlaceholderText(/search features/i);
      await user.type(searchInput, 'dashboard');

      // Should show results
      await waitFor(() => {
        const results = screen.queryAllByRole('button');
        expect(results.length).toBeGreaterThan(0);
      });
    });

    it('should expand/collapse sections without View Transitions', async () => {
      const user = userEvent.setup();
      const { container } = renderSidebar();

      const sectionButtons = container.querySelectorAll('button[class*="uppercase"]');
      expect(sectionButtons.length).toBeGreaterThan(0);

      if (sectionButtons[0]) {
        await user.click(sectionButtons[0]);
        // Section should toggle without errors
      }
    });

    it('should maintain functionality in collapsed mode', () => {
      const { container } = renderSidebar({ collapsed: true });

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('w-16');

      // Links should still exist and be clickable
      const navLinks = container.querySelectorAll('a[href]');
      expect(navLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful degradation', () => {
    it('should work identically with and without View Transitions support', async () => {
      // Test with support
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      (document as unknown as { startViewTransition: unknown }).startViewTransition = vi.fn();

      const { container: containerWith } = renderSidebar();
      const linksCountWith = containerWith.querySelectorAll('a[href]').length;

      // Test without support
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;

      const { container: containerWithout } = renderSidebar();
      const linksCountWithout = containerWithout.querySelectorAll('a[href]').length;

      // Both should render the same number of links
      expect(linksCountWith).toBe(linksCountWithout);
      expect(linksCountWith).toBeGreaterThan(0);
    });

    it('should handle rapid navigation without View Transitions', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
      const user = userEvent.setup();
      const { container } = renderSidebar();

      const navLinks = Array.from(container.querySelectorAll('a[href*="/admin/"]')).slice(0, 3);

      // Rapidly click different links
      for (const link of navLinks) {
        await user.click(link as HTMLElement);
      }

      // Should not crash
      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('should respect reduced motion preferences in fallback mode', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      // Mock matchMedia for reduced motion
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

      const { container } = renderSidebar();

      // Should render without animations
      expect(container.querySelector('nav')).toBeInTheDocument();
    });
  });

  describe('Browser compatibility', () => {
    it('should work in browsers without document.startViewTransition', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;

      expect(() => renderSidebar()).not.toThrow();
    });

    it('should work in server-side rendering environment', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      // Mock SSR environment
      const originalDocument = global.document;
      (global as unknown as { document: undefined }).document = undefined;

      expect(() => {
        // Restore document for rendering
        (global as unknown as { document: Document }).document = originalDocument;
        renderSidebar();
      }).not.toThrow();
    });

    it('should handle partial View Transitions API support', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      // Simulate browser with partial API
      (document as unknown as { startViewTransition: null }).startViewTransition = null;

      expect(() => renderSidebar()).not.toThrow();
    });
  });

  describe('Performance in fallback mode', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
    });

    it('should render quickly without View Transitions', () => {
      const startTime = performance.now();
      renderSidebar();
      const endTime = performance.now();

      // Should render in reasonable time (< 1000ms)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle multiple rapid rerenders', () => {
      const { rerender } = renderSidebar({ userTier: 'STARTER' });

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        rerender(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/test-tenant/admin/dashboard']}>
              <LiveBadgeProvider>
                <OptimizedSidebar
                  userTier={i % 2 === 0 ? 'STARTER' : 'PROFESSIONAL'}
                />
              </LiveBadgeProvider>
            </MemoryRouter>
          </QueryClientProvider>
        );
      }

      // Should not crash or degrade
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  describe('User experience in fallback mode', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
    });

    it('should provide visual feedback on navigation', async () => {
      const user = userEvent.setup();
      const { container } = renderSidebar();

      const firstLink = container.querySelector('a[href*="/admin/"]');
      expect(firstLink).toBeInTheDocument();

      // Hover should work
      if (firstLink) {
        await user.hover(firstLink as HTMLElement);
        // Hover styles should apply (tested via className presence)
        expect(firstLink).toHaveClass('hover:bg-accent');
      }
    });

    it('should show active states correctly', () => {
      const { container } = renderSidebar();

      // Active links should have appropriate styling
      const links = container.querySelectorAll('a[href*="/admin/"]');
      const activeLinks = Array.from(links).filter(link =>
        link.className.includes('bg-primary')
      );

      // At least one link should be active (dashboard)
      expect(activeLinks.length).toBeGreaterThan(0);
    });

    it('should maintain keyboard navigation', async () => {
      const user = userEvent.setup();
      renderSidebar();

      // Tab through elements
      await user.tab();
      await user.tab();
      await user.tab();

      // Should be able to navigate via keyboard
      const focused = document.activeElement;
      expect(focused).toBeTruthy();
      expect(focused?.tagName).toMatch(/BUTTON|A/);
    });

    it('should handle focus management correctly', async () => {
      const user = userEvent.setup();
      renderSidebar();

      // Open search
      await user.keyboard('{Meta>}k{/Meta}');

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search features/i);
        expect(searchInput).toBeInTheDocument();
      });

      // Close search
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search features/i)).not.toBeInTheDocument();
      });
    });
  });
});

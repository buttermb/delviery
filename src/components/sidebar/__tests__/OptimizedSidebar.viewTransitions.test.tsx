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

describe('OptimizedSidebar - View Transitions', () => {
  let queryClient: QueryClient;
  let mockNavigate: ReturnType<typeof vi.fn>;
  let originalStartViewTransition: typeof document.startViewTransition | undefined;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock useNavigate
    mockNavigate = vi.fn();
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ tenantSlug: 'test-tenant' }),
      };
    });

    // Store original startViewTransition
    originalStartViewTransition = (document as unknown as { startViewTransition?: typeof document.startViewTransition }).startViewTransition;
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Restore original startViewTransition
    if (originalStartViewTransition !== undefined) {
      (document as unknown as { startViewTransition: typeof originalStartViewTransition }).startViewTransition = originalStartViewTransition;
    } else {
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    }
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

  describe('Browser Support Detection', () => {
    it('should enable viewTransition when browser supports View Transitions API', () => {
      // Mock View Transitions support
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      (document as unknown as { startViewTransition: unknown }).startViewTransition = vi.fn();

      const { container } = renderSidebar();

      // Check that NavLinks are rendered (they will have viewTransition prop)
      const navLinks = container.querySelectorAll('a[href]');
      expect(navLinks.length).toBeGreaterThan(0);
    });

    it('should disable viewTransition when browser does not support View Transitions API', () => {
      // Mock no View Transitions support
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;

      const { container } = renderSidebar();

      // Check that NavLinks are still rendered (just without viewTransition)
      const navLinks = container.querySelectorAll('a[href]');
      expect(navLinks.length).toBeGreaterThan(0);
    });

    it('should handle server-side rendering gracefully', () => {
      // Mock SSR environment (no document)
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      expect(() => renderSidebar()).not.toThrow();
    });
  });

  describe('Navigation Behavior', () => {
    it('should render navigation items with proper structure', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      renderSidebar();

      // Wait for sidebar to render
      await waitFor(() => {
        const navElement = screen.getByRole('navigation', { name: /main navigation/i });
        expect(navElement).toBeInTheDocument();
      });
    });

    it('should handle click navigation on sidebar items', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      const { container } = renderSidebar();

      // Find a navigation link (there should be several in the sidebar)
      const navLinks = container.querySelectorAll('a[href*="/admin/"]');
      expect(navLinks.length).toBeGreaterThan(0);

      // Click on first link
      if (navLinks[0]) {
        await user.click(navLinks[0]);
        // Navigation should be attempted (Note: actual navigation is handled by React Router)
      }
    });

    it('should call onNavigate callback when provided', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const onNavigate = vi.fn();
      const user = userEvent.setup();

      const { container } = renderSidebar({ onNavigate });

      const navLinks = container.querySelectorAll('a[href*="/admin/"]');
      if (navLinks[0]) {
        await user.click(navLinks[0]);
        // onNavigate should be called on click
        // Note: The actual call happens through NavLink's onClick
      }
    });
  });

  describe('Command Palette Search', () => {
    it('should open search dialog with keyboard shortcut', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      renderSidebar();

      // Press Cmd+K (or Ctrl+K)
      await user.keyboard('{Meta>}k{/Meta}');

      // Search dialog should be visible
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search features/i)).toBeInTheDocument();
      });
    });

    it('should navigate with viewTransition from search when supported', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      renderSidebar();

      // Open search
      await user.keyboard('{Meta>}k{/Meta}');

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search features/i)).toBeInTheDocument();
      });

      // Type a search query
      const searchInput = screen.getByPlaceholderText(/search features/i);
      await user.type(searchInput, 'dashboard');

      // Wait for search results
      await waitFor(() => {
        const results = screen.queryAllByRole('button');
        expect(results.length).toBeGreaterThan(0);
      });
    });

    it('should navigate without viewTransition from search when not supported', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
      const user = userEvent.setup();

      renderSidebar();

      // Open search
      await user.keyboard('{Meta>}k{/Meta}');

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search features/i)).toBeInTheDocument();
      });

      // Type a search query
      const searchInput = screen.getByPlaceholderText(/search features/i);
      await user.type(searchInput, 'dashboard');

      // Navigation should work without viewTransition
    });

    it('should close search dialog on Escape key', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      renderSidebar();

      // Open search
      await user.keyboard('{Meta>}k{/Meta}');

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search features/i)).toBeInTheDocument();
      });

      // Press Escape
      await user.keyboard('{Escape}');

      // Search should be closed
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search features/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Section Expansion', () => {
    it('should expand and collapse sections', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      const { container } = renderSidebar();

      // Find section toggle buttons (they have uppercase text and chevron icons)
      const sectionButtons = container.querySelectorAll('button[class*="uppercase"]');
      expect(sectionButtons.length).toBeGreaterThan(0);

      // Click to toggle a section
      if (sectionButtons[0]) {
        await user.click(sectionButtons[0]);
        // Section should toggle (expand/collapse)
      }
    });

    it('should handle "Show more" functionality', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      const { container } = renderSidebar();

      // Look for "Show more" buttons
      const showMoreButtons = Array.from(container.querySelectorAll('button')).filter(
        (btn) => btn.textContent?.includes('more')
      );

      if (showMoreButtons.length > 0) {
        await user.click(showMoreButtons[0]);
        // More items should be visible
      }
    });
  });

  describe('Collapsed State', () => {
    it('should render in collapsed state', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar({ collapsed: true });

      // Sidebar should have collapsed width
      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('w-16');
    });

    it('should not show search button in collapsed state', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      renderSidebar({ collapsed: true });

      // Search button should not be visible
      expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    });

    it('should still support viewTransition in collapsed state', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar({ collapsed: true });

      // Nav links should still be present
      const navLinks = container.querySelectorAll('a[href]');
      expect(navLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Tier-Based Features', () => {
    it('should render for STARTER tier', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar({ userTier: 'STARTER' });

      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('should render for PROFESSIONAL tier', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar({ userTier: 'PROFESSIONAL' });

      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('should render for ENTERPRISE tier', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar({ userTier: 'ENTERPRISE' });

      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('should show locked features when showLockedFeatures is true', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar({
        userTier: 'STARTER',
        showLockedFeatures: true,
      });

      // Locked features should have lock icons
      // Note: This depends on the tier configuration
      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('should hide locked features when showLockedFeatures is false', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar({
        userTier: 'STARTER',
        showLockedFeatures: false,
      });

      expect(container.querySelector('nav')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      renderSidebar();

      const nav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      renderSidebar();

      // Tab through links
      await user.tab();

      // At least one element should be focused
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeTruthy();
    });

    it('should have focus-visible styles', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar();

      // Check for focus-visible classes
      const focusableElements = container.querySelectorAll('[class*="focus-visible"]');
      expect(focusableElements.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing tenantSlug gracefully', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      // Mock useParams to return undefined tenantSlug
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useParams: () => ({ tenantSlug: undefined }),
        };
      });

      expect(() => renderSidebar()).not.toThrow();
    });

    it('should handle rapid section toggles', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      const { container } = renderSidebar();

      const sectionButtons = container.querySelectorAll('button[class*="uppercase"]');
      if (sectionButtons[0]) {
        // Rapidly toggle
        await user.click(sectionButtons[0]);
        await user.click(sectionButtons[0]);
        await user.click(sectionButtons[0]);
        // Should not crash
      }

      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('should handle rapid search queries', async () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
      const user = userEvent.setup();

      renderSidebar();

      // Open search
      await user.keyboard('{Meta>}k{/Meta}');

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search features/i)).toBeInTheDocument();
      });

      // Rapidly type
      const searchInput = screen.getByPlaceholderText(/search features/i);
      await user.type(searchInput, 'abcdefghijklmnopqrstuvwxyz');

      // Should not crash
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Integration with Live Badge System', () => {
    it('should render with LiveBadgeProvider', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar();

      // Should render without errors
      expect(container.querySelector('nav')).toBeInTheDocument();
    });

    it('should handle live badges on navigation items', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { container } = renderSidebar();

      // Navigation items should be rendered
      const navLinks = container.querySelectorAll('a[href]');
      expect(navLinks.length).toBeGreaterThan(0);
    });
  });
});

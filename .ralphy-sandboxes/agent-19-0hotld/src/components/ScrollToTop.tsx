import { useScrollRestoration } from '@/hooks/useScrollRestoration';

/**
 * ScrollToTop Component
 *
 * Preserves scroll position when navigating between pages:
 * - Saves scrollTop before navigation
 * - Restores scroll position when returning to a previously visited page
 * - Scrolls to top for new pages that haven't been visited
 *
 * Should be placed inside BrowserRouter but outside of Routes.
 */
export function ScrollToTop() {
  useScrollRestoration();
  return null;
}

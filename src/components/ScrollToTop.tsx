import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop Component
 * Scrolls the window to the top whenever the route changes.
 * Should be placed inside BrowserRouter but outside of Routes.
 */
export function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        // Scroll to top on route change
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [pathname]);

    return null;
}

export default ScrollToTop;

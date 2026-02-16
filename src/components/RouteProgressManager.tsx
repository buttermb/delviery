import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import NProgress from "nprogress";

/**
 * RouteProgressManager
 *
 * Triggers the NProgress loading bar on every route change.
 * Placed inside BrowserRouter to access useLocation().
 * Works alongside SuspenseProgressFallback for lazy-loaded chunks.
 */
export function RouteProgressManager() {
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    // Only trigger on actual path changes, not query/hash changes
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      try {
        NProgress.start();
      } catch {
        /* ignore NProgress errors */
      }

      // Done is called on next frame to allow Suspense to take over
      // if the route is lazy-loaded. If the route resolves immediately,
      // the bar completes instantly.
      const timer = requestAnimationFrame(() => {
        try {
          NProgress.done();
        } catch {
          /* ignore NProgress errors */
        }
      });

      return () => cancelAnimationFrame(timer);
    }
  }, [location.pathname]);

  return null;
}

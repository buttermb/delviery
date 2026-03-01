import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import NProgress from "nprogress";
import { logger } from "@/lib/logger";

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
  const navStartRef = useRef<number | null>(null);

  useEffect(() => {
    // Only trigger on actual path changes, not query/hash changes
    if (previousPath.current !== location.pathname) {
      navStartRef.current = performance.now();
      performance.mark(`admin-route-start:${location.pathname}`);
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
          if (navStartRef.current !== null) {
            const duration = performance.now() - navStartRef.current;
            performance.mark(`admin-route-end:${location.pathname}`);
            performance.measure(`admin-route:${location.pathname}`, `admin-route-start:${location.pathname}`, `admin-route-end:${location.pathname}`);
            if (import.meta.env.DEV) {
              logger.debug('[perf] admin route transition', { path: location.pathname, durationMs: Math.round(duration) });
            }
          }
        } catch {
          /* ignore NProgress errors */
        }
      });

      return () => cancelAnimationFrame(timer);
    }
  }, [location.pathname]);

  return null;
}

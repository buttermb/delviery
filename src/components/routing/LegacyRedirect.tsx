import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';

interface LegacyRedirectProps {
  to: string;
  /** The legacy route path for logging purposes */
  from: string;
}

/**
 * Redirect component for legacy routes that:
 * - Preserves query parameters from the original URL
 * - Uses replace navigation to avoid back-button loops
 * - Logs deprecation warnings for tracking
 */
export function LegacyRedirect({ to, from }: LegacyRedirectProps) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Log deprecation warning
    logger.warn(
      `[DEPRECATED ROUTE] "${from}" is deprecated. Redirecting to "${to}". Please update bookmarks and links.`,
      { from, to, search: location.search }
    );

    // Preserve query parameters by appending them to the target
    const targetUrl = location.search ? `${to}${location.search}` : to;

    // Use replace to avoid back-button loops
    navigate(targetUrl, { replace: true });
  }, [to, from, location.search, navigate]);

  // Return null as this component only handles the redirect
  return null;
}

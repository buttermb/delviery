/**
 * Hook for tenant-aware navigation
 * Automatically prepends tenant slug to admin routes
 */

import { useNavigate, useParams } from 'react-router-dom';

/**
 * Returns a navigate function that automatically handles tenant slug prepending
 * 
 * @example
 * const navigate = useTenantNavigate();
 * navigate('/admin/dashboard'); // Becomes /{tenantSlug}/admin/dashboard
 */
export function useTenantNavigate() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const tenantNavigate = (path: string, options?: { replace?: boolean; state?: unknown }) => {
    // If path starts with /admin, prepend tenant slug
    if (path.startsWith('/admin') && tenantSlug) {
      navigate(`/${tenantSlug}${path}`, options);
    } else {
      navigate(path, options);
    }
  };

  return tenantNavigate;
}

/**
 * Helper function to get tenant-aware path
 * Can be used outside of components
 */
export function getTenantPath(path: string, tenantSlug?: string): string {
  if (path.startsWith('/admin') && tenantSlug) {
    return `/${tenantSlug}${path}`;
  }
  return path;
}


import { useParams, useNavigate } from 'react-router-dom';

/**
 * Tenant-aware navigation hook for admin routes
 * 
 * @description
 * This hook provides navigation functions that automatically include the tenant slug
 * in URLs, preventing 404 errors caused by missing tenant context.
 * 
 * ALWAYS use this instead of useNavigate() for admin routes.
 * 
 * @example
 * ```tsx
 * const { navigateToAdmin, buildAdminUrl } = useTenantNavigation();
 * 
 * // Navigate programmatically
 * navigateToAdmin('orders'); // → /{tenantSlug}/admin/orders
 * 
 * // Build URL for links
 * <Link to={buildAdminUrl('invoices')}>Invoices</Link>
 * ```
 */
export function useTenantNavigation() {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const navigate = useNavigate();

    if (!tenantSlug) {
        console.error('[useTenantNavigation] Called outside tenant context - tenant slug is missing');
    }

    /**
     * Navigate to a tenant admin route
     * Automatically prepends /{tenantSlug}/admin/ to the path
     * 
     * @param path - The admin route path (e.g., 'orders', 'invoices/123')
     * @example
     * navigateToAdmin('orders') // → navigates to /{tenantSlug}/admin/orders
     * navigateToAdmin('crm/invoices/123') // → /{tenantSlug}/admin/crm/invoices/123
     */
    const navigateToAdmin = (path: string) => {
        if (!tenantSlug) {
            console.error('[navigateToAdmin] Cannot navigate without tenant slug');
            return;
        }

        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;

        // Remove /admin prefix if present (we add it automatically)
        const finalPath = cleanPath.startsWith('admin/')
            ? cleanPath.slice(6)
            : cleanPath;

        const fullPath = `/${tenantSlug}/admin/${finalPath}`;
        navigate(fullPath);
    };

    /**
     * Build a tenant admin URL without navigating
     * Use for action buttons, links, href attributes, etc.
     * 
     * @param path - The admin route path
     * @returns The full URL with tenant slug
     * @example
     * buildAdminUrl('orders') // → "/{tenantSlug}/admin/orders"
     * <a href={buildAdminUrl('invoices')}>Invoices</a>
     */
    const buildAdminUrl = (path: string): string => {
        if (!tenantSlug) {
            console.error('[buildAdminUrl] Cannot build URL without tenant slug');
            return '#';
        }

        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;

        // Remove /admin prefix if present (we add it automatically)
        const finalPath = cleanPath.startsWith('admin/')
            ? cleanPath.slice(6)
            : cleanPath;

        return `/${tenantSlug}/admin/${finalPath}`;
    };

    return {
        /**
         * Navigate to tenant admin route
         * @see navigateToAdmin
         */
        navigateToAdmin,

        /**
         * Build tenant admin URL
         * @see buildAdminUrl
         */
        buildAdminUrl,

        /**
         * Current tenant slug from URL params
         */
        tenantSlug,

        /**
         * Fallback to regular navigate if needed
         * Use sparingly - prefer navigateToAdmin for admin routes
         */
        navigate,
    };
}

/**
 * Build tenant admin URL in non-React contexts
 * (utility functions, edge functions, etc.)
 * 
 * @param tenantSlug - The tenant identifier
 * @param path - The admin route path
 * @returns The full URL with tenant slug
 * @example
 * buildTenantAdminUrl('willysbo', 'orders') // → "/willysbo/admin/orders"
 */
export function buildTenantAdminUrl(tenantSlug: string, path: string): string {
    if (!tenantSlug) {
        console.error('[buildTenantAdminUrl] Tenant slug is required');
        return '#';
    }

    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // Remove /admin prefix if present
    const finalPath = cleanPath.startsWith('admin/')
        ? cleanPath.slice(6)
        : cleanPath;

    return `/${tenantSlug}/admin/${finalPath}`;
}

/**
 * Type guard to check if we're in a tenant admin context
 * @param tenantSlug - The tenant slug to check
 */
export function isTenantContext(tenantSlug: string | undefined): tenantSlug is string {
    return !!tenantSlug && tenantSlug.length > 0;
}

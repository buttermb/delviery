import { useTenantNavigate } from './useTenantNavigate';

export function useTenantNavigation() {
    const navigate = useTenantNavigate();

    const navigateToAdmin = (page: string) => {
        // Assuming page is like 'wholesale-orders' and maps to '/admin/wholesale-orders' or similar
        // Or maybe it expects a full path segment?
        // Let's assume it maps to /admin/{page}
        navigate(`/admin/${page}`);
    };

    return { navigateToAdmin };
}

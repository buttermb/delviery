/**
 * Re-export useTenantAdminAuth from its canonical location.
 * Many components import from this path — this file prevents build errors.
 */
export { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

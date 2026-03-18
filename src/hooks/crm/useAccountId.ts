import { useAccount } from '@/contexts/AccountContext';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { logger } from '@/lib/logger';

/**
 * Hook to get current account ID with validation.
 * Falls back to tenant.id when account is not available.
 * 
 * @throws {Error} If neither account ID nor tenant ID is available
 * @returns {string} Current account ID (or tenant ID fallback)
 */
export function useAccountId(): string {
    const { account, loading } = useAccount();
    const { tenant } = useTenantAdminAuth();
    
    if (loading) {
        return '';
    }

    const id = account?.id ?? tenant?.id ?? null;
    
    if (!id) {
        logger.error('Account ID not available', { 
            component: 'useAccountId',
            account,
            tenantId: tenant?.id,
            loading 
        });
        throw new Error('Account ID is required. Please ensure you are logged in.');
    }
    
    return id;
}

/**
 * Hook to get current account ID safely (returns null if not available).
 * Falls back to tenant.id when account is not available.
 * 
 * @returns {string | null} Current account ID (or tenant ID fallback), or null
 */
export function useAccountIdSafe(): string | null {
    const { account, loading } = useAccount();
    const { tenant } = useTenantAdminAuth();
    
    if (loading) return null;
    
    return account?.id ?? tenant?.id ?? null;
}


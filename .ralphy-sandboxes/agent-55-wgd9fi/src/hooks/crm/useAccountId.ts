import { useAccount } from '@/contexts/AccountContext';
import { logger } from '@/lib/logger';

/**
 * Hook to get current account ID with validation
 * Throws error if account is not available
 * 
 * @throws {Error} If account ID is not available
 * @returns {string} Current account ID
 */
export function useAccountId(): string {
    const { account, loading } = useAccount();
    
    if (loading) {
        // Return empty string during loading - caller should check enabled state
        return '';
    }
    
    if (!account?.id) {
        logger.error('Account ID not available', { 
            component: 'useAccountId',
            account: account,
            loading 
        });
        throw new Error('Account ID is required. Please ensure you are logged in.');
    }
    
    return account.id;
}

/**
 * Hook to get current account ID safely (returns null if not available)
 * Use this when you want to handle missing account gracefully
 * 
 * @returns {string | null} Current account ID or null
 */
export function useAccountIdSafe(): string | null {
    const { account, loading } = useAccount();
    
    if (loading || !account?.id) {
        return null;
    }
    
    return account.id;
}


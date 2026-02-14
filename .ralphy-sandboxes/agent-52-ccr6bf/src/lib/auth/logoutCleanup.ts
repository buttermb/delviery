import { QueryClient } from '@tanstack/react-query';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { safeStorage } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';
import { invalidateSessionNonce } from '@/lib/auth/sessionFixation';

/**
 * Comprehensive logout cleanup utility.
 * Ensures all client-side state is purged on logout to prevent
 * stale data leaking between sessions.
 *
 * Handles:
 * - TanStack Query cache clearing
 * - Encryption session destruction
 * - localStorage/sessionStorage cleanup
 * - In-memory state reset
 */

interface LogoutCleanupOptions {
  /** TanStack QueryClient instance to clear cached data */
  queryClient?: QueryClient;
  /** Which auth tier is logging out */
  tier: 'super_admin' | 'tenant_admin' | 'customer' | 'vendor' | 'base';
}

/**
 * Storage keys that should be cleared per auth tier.
 * Each tier clears its own keys plus shared session keys.
 */
const TIER_STORAGE_KEYS: Record<LogoutCleanupOptions['tier'], string[]> = {
  super_admin: [
    STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN,
    STORAGE_KEYS.SUPER_ADMIN_USER,
    STORAGE_KEYS.SUPER_ADMIN_TENANT_ID,
  ],
  tenant_admin: [
    STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN,
    STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN,
    STORAGE_KEYS.TENANT_ADMIN_USER,
    STORAGE_KEYS.TENANT_DATA,
  ],
  customer: [
    STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN,
    STORAGE_KEYS.CUSTOMER_USER,
    STORAGE_KEYS.CUSTOMER_TENANT_DATA,
    STORAGE_KEYS.GUEST_CART,
    STORAGE_KEYS.CART_ITEMS,
    STORAGE_KEYS.GUEST_CHECKOUT_DATA,
    STORAGE_KEYS.CUSTOMER_MODE,
  ],
  vendor: [
    STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN,
    STORAGE_KEYS.TENANT_DATA,
  ],
  base: [],
};

/** Keys shared across all tiers that should always be cleared */
const SHARED_KEYS = [
  'floraiq_user_id',
  'lastTenantSlug',
];

/**
 * Perform comprehensive client-side cleanup on logout.
 * Call this in the `finally` block of every logout function.
 */
export function performLogoutCleanup({ queryClient, tier }: LogoutCleanupOptions): void {
  logger.debug('[LOGOUT_CLEANUP] Starting cleanup', { tier });

  // 1. Invalidate session nonce (session fixation protection)
  try {
    invalidateSessionNonce();
  } catch (e) {
    logger.warn('[LOGOUT_CLEANUP] Session nonce invalidation failed', e);
  }

  // 2. Destroy encryption session (clears keys from memory + session storage)
  try {
    clientEncryption.destroy();
  } catch (e) {
    logger.warn('[LOGOUT_CLEANUP] Encryption destroy failed', e);
  }

  // 3. Clear TanStack Query cache to prevent stale data leaking between sessions
  if (queryClient) {
    try {
      queryClient.clear();
      logger.debug('[LOGOUT_CLEANUP] Query cache cleared');
    } catch (e) {
      logger.warn('[LOGOUT_CLEANUP] Query cache clear failed', e);
    }
  }

  // 4. Clear tier-specific storage keys
  const tierKeys = TIER_STORAGE_KEYS[tier];
  for (const key of tierKeys) {
    safeStorage.removeItem(key);
  }

  // 5. Clear shared storage keys
  for (const key of SHARED_KEYS) {
    safeStorage.removeItem(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // sessionStorage may not be available
    }
  }

  logger.debug('[LOGOUT_CLEANUP] Cleanup complete', { tier, keysCleared: tierKeys.length + SHARED_KEYS.length });
}

/**
 * Broadcast a logout event to other browser tabs.
 * Only relevant for tenant admin (which uses BroadcastChannel).
 */
export function broadcastLogout(channelName: string): void {
  try {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage({ type: 'LOGOUT' });
    channel.close();
  } catch (e) {
    logger.warn('[LOGOUT_CLEANUP] Failed to broadcast logout event', e);
  }
}

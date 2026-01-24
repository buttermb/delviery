/**
 * Token Manager
 *
 * Centralized utility for token storage, retrieval, and refresh operations.
 * Handles encryption of tokens before storage when the encryption engine is available.
 * Uses a mutex pattern to prevent race conditions during concurrent token refreshes.
 *
 * Usage:
 *   const manager = createTokenManager('tenant-admin');
 *   manager.setTokens({ accessToken, refreshToken });
 *   const token = manager.getAccessToken();
 *   if (manager.isTokenExpired()) { await manager.refreshTokens(executor); }
 */

import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { tokenRefreshManager, type TokenRefreshResult } from '@/lib/auth/tokenRefreshManager';

/** Auth scopes supported by the token manager */
export type AuthScope = 'super-admin' | 'tenant-admin' | 'customer' | 'courier';

/** Token pair stored in the manager */
export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

/** Storage key mapping per auth scope */
interface ScopeStorageKeys {
  accessToken: string;
  refreshToken: string | null;
}

/** Prefix used to identify encrypted values in storage */
const ENCRYPTED_PREFIX = 'enc:';

/** Buffer time (in seconds) before expiry to consider token expired */
const EXPIRY_BUFFER_SECONDS = 60;

/**
 * Map auth scopes to their respective STORAGE_KEYS constants.
 */
function getScopeStorageKeys(scope: AuthScope): ScopeStorageKeys {
  switch (scope) {
    case 'super-admin':
      return {
        accessToken: STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN,
        refreshToken: null, // Super admin does not use refresh tokens
      };
    case 'tenant-admin':
      return {
        accessToken: STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN,
        refreshToken: STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN,
      };
    case 'customer':
      return {
        accessToken: STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN,
        refreshToken: null,
      };
    case 'courier':
      return {
        accessToken: STORAGE_KEYS.COURIER_ACCESS_TOKEN,
        refreshToken: null,
      };
  }
}

/**
 * Encrypt a token value if the encryption engine is ready.
 * Falls back to plaintext storage if encryption is unavailable.
 */
function encryptValue(value: string): string {
  try {
    if (clientEncryption.isReady()) {
      const encrypted = clientEncryption.encrypt(value);
      return `${ENCRYPTED_PREFIX}${encrypted}`;
    }
  } catch (error) {
    logger.warn('[TokenManager] Encryption unavailable, storing plaintext', error);
  }
  return value;
}

/**
 * Decrypt a stored token value. If it was stored without encryption,
 * returns the raw value.
 */
function decryptValue(stored: string): string {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    return stored;
  }

  const encryptedPart = stored.slice(ENCRYPTED_PREFIX.length);
  try {
    if (clientEncryption.isReady()) {
      return clientEncryption.decrypt<string>(encryptedPart);
    }
  } catch (error) {
    logger.warn('[TokenManager] Decryption failed, returning raw value', error);
  }

  // If decryption fails (e.g. session expired), return empty to force re-auth
  return '';
}

/**
 * Decode a JWT token's payload without verification.
 * Used to check expiration locally.
 */
function decodeTokenPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';

    const payload = JSON.parse(atob(base64));
    return payload as { exp?: number };
  } catch {
    return null;
  }
}

/**
 * Token Manager instance for a specific auth scope.
 * Provides get/set/clear/check operations with optional encryption
 * and mutex-protected refresh.
 */
export interface TokenManager {
  /** Get the current access token (decrypted) or null if not stored */
  getAccessToken(): string | null;

  /** Get the current refresh token (decrypted) or null if not stored/supported */
  getRefreshToken(): string | null;

  /** Store tokens (encrypts before storage if possible) */
  setTokens(tokens: TokenPair): void;

  /** Clear all tokens for this scope */
  clearTokens(): void;

  /** Check if the access token is expired or will expire within the buffer window */
  isTokenExpired(): boolean;

  /**
   * Execute a token refresh with race condition protection.
   * Multiple concurrent calls will share the same in-flight refresh promise.
   * @param executor - Function that performs the actual refresh API call
   * @returns Result of the refresh operation
   */
  refreshTokens(executor: () => Promise<TokenRefreshResult>): Promise<TokenRefreshResult>;

  /** Check if a refresh is currently in progress for this scope */
  isRefreshing(): boolean;

  /** The auth scope this manager handles */
  readonly scope: AuthScope;
}

/**
 * Create a TokenManager for the specified auth scope.
 *
 * @param scope - The auth tier to manage tokens for
 * @returns TokenManager instance bound to the scope's storage keys
 */
export function createTokenManager(scope: AuthScope): TokenManager {
  const keys = getScopeStorageKeys(scope);

  const getAccessToken = (): string | null => {
    const stored = safeStorage.getItem(keys.accessToken);
    if (!stored) return null;
    const decrypted = decryptValue(stored);
    return decrypted || null;
  };

  const getRefreshToken = (): string | null => {
    if (!keys.refreshToken) return null;
    const stored = safeStorage.getItem(keys.refreshToken);
    if (!stored) return null;
    const decrypted = decryptValue(stored);
    return decrypted || null;
  };

  const setTokens = (tokens: TokenPair): void => {
    const encryptedAccess = encryptValue(tokens.accessToken);
    safeStorage.setItem(keys.accessToken, encryptedAccess);

    if (tokens.refreshToken && keys.refreshToken) {
      const encryptedRefresh = encryptValue(tokens.refreshToken);
      safeStorage.setItem(keys.refreshToken, encryptedRefresh);
    }

    logger.debug(`[TokenManager] Tokens stored for scope "${scope}"`);
  };

  const clearTokens = (): void => {
    safeStorage.removeItem(keys.accessToken);
    if (keys.refreshToken) {
      safeStorage.removeItem(keys.refreshToken);
    }
    tokenRefreshManager.reset(scope);
    logger.debug(`[TokenManager] Tokens cleared for scope "${scope}"`);
  };

  const isTokenExpired = (): boolean => {
    const token = getAccessToken();
    if (!token) return true;

    const payload = decodeTokenPayload(token);
    if (!payload?.exp) {
      // No expiration claim means we can't determine expiry - treat as valid
      return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSeconds + EXPIRY_BUFFER_SECONDS;
  };

  const refreshTokens = async (
    executor: () => Promise<TokenRefreshResult>
  ): Promise<TokenRefreshResult> => {
    // Delegate to the singleton tokenRefreshManager which handles:
    // - Deduplication of concurrent refresh calls
    // - Minimum interval between refreshes
    // - Error handling
    const result = await tokenRefreshManager.refresh(scope, async () => {
      const refreshResult = await executor();

      // On success, automatically store the new tokens
      if (refreshResult.success && refreshResult.accessToken) {
        setTokens({
          accessToken: refreshResult.accessToken,
          refreshToken: refreshResult.refreshToken,
        });
      }

      return refreshResult;
    });

    return result;
  };

  const isRefreshing = (): boolean => {
    return tokenRefreshManager.isRefreshing(scope);
  };

  return {
    getAccessToken,
    getRefreshToken,
    setTokens,
    clearTokens,
    isTokenExpired,
    refreshTokens,
    isRefreshing,
    scope,
  };
}

/**
 * Pre-configured token manager instances for each auth scope.
 * Use these singletons to avoid creating multiple managers per scope.
 */
export const tenantAdminTokenManager = createTokenManager('tenant-admin');
export const customerTokenManager = createTokenManager('customer');
export const superAdminTokenManager = createTokenManager('super-admin');
export const courierTokenManager = createTokenManager('courier');

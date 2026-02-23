/**
 * Token Refresh Manager
 *
 * Singleton manager that prevents race conditions during token refresh operations.
 * Ensures only one refresh request is in-flight at a time, deduplicating concurrent
 * refresh attempts from timers, auth state changes, and verification flows.
 */

import { logger } from '@/lib/logger';

export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

type RefreshExecutor = () => Promise<TokenRefreshResult>;

/**
 * Manages token refresh operations to prevent race conditions.
 *
 * Key behaviors:
 * - Only one refresh can run at a time per scope (tenant-admin or customer)
 * - Concurrent callers receive the same promise (deduplication)
 * - After completion, subsequent calls trigger new refreshes
 * - Minimum interval between refreshes prevents rapid-fire attempts
 */
class TokenRefreshManager {
  private refreshPromises: Map<string, Promise<TokenRefreshResult>> = new Map();
  private lastRefreshTimes: Map<string, number> = new Map();

  // Minimum 5 seconds between refresh attempts to prevent rapid-fire
  private static readonly MIN_REFRESH_INTERVAL_MS = 5000;

  /**
   * Execute a token refresh with race condition protection.
   *
   * @param scope - Unique identifier for the refresh context (e.g., 'tenant-admin', 'customer')
   * @param executor - The actual refresh logic to execute
   * @returns The refresh result (shared across concurrent callers)
   */
  async refresh(scope: string, executor: RefreshExecutor): Promise<TokenRefreshResult> {
    // If a refresh is already in progress for this scope, return the existing promise
    const existingPromise = this.refreshPromises.get(scope);
    if (existingPromise) {
      logger.debug(`[TokenRefreshManager] Refresh already in progress for "${scope}", deduplicating`);
      return existingPromise;
    }

    // Check minimum interval between refreshes
    const lastRefresh = this.lastRefreshTimes.get(scope) || 0;
    const timeSinceLastRefresh = Date.now() - lastRefresh;
    if (timeSinceLastRefresh < TokenRefreshManager.MIN_REFRESH_INTERVAL_MS) {
      logger.debug(`[TokenRefreshManager] Too soon since last refresh for "${scope}" (${timeSinceLastRefresh}ms), skipping`);
      return { success: true }; // Assume recent refresh is still valid
    }

    // Create and store the refresh promise
    const refreshPromise = this.executeRefresh(scope, executor);
    this.refreshPromises.set(scope, refreshPromise);

    return refreshPromise;
  }

  /**
   * Check if a refresh is currently in progress for the given scope.
   */
  isRefreshing(scope: string): boolean {
    return this.refreshPromises.has(scope);
  }

  /**
   * Reset the refresh state for a scope (useful during logout).
   */
  reset(scope: string): void {
    this.refreshPromises.delete(scope);
    this.lastRefreshTimes.delete(scope);
    logger.debug(`[TokenRefreshManager] Reset state for "${scope}"`);
  }

  /**
   * Reset all refresh state (useful during full logout/cleanup).
   */
  resetAll(): void {
    this.refreshPromises.clear();
    this.lastRefreshTimes.clear();
    logger.debug('[TokenRefreshManager] Reset all state');
  }

  private async executeRefresh(scope: string, executor: RefreshExecutor): Promise<TokenRefreshResult> {
    try {
      logger.debug(`[TokenRefreshManager] Starting refresh for "${scope}"`);
      const result = await executor();

      if (result.success) {
        this.lastRefreshTimes.set(scope, Date.now());
        logger.debug(`[TokenRefreshManager] Refresh successful for "${scope}"`);
      } else {
        logger.warn(`[TokenRefreshManager] Refresh failed for "${scope}": ${result.error || 'unknown error'}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[TokenRefreshManager] Refresh exception for "${scope}"`, error instanceof Error ? error : new Error(errorMessage));
      return { success: false, error: errorMessage };
    } finally {
      // Always clear the in-progress promise so new refreshes can occur
      this.refreshPromises.delete(scope);
    }
  }
}

// Singleton instance shared across the application
export const tokenRefreshManager = new TokenRefreshManager();

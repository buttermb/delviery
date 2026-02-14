import { useState, useEffect, useCallback, useMemo } from 'react';

import type { SyncModule } from '@/lib/eventBus';
import { eventBus } from '@/lib/eventBus';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS, safeStorage, safeJsonParse, safeJsonStringify } from '@/constants/storageKeys';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

/**
 * Sync status state interface
 */
export interface SyncStatus {
  /** Timestamp of last successful sync (ISO string) */
  lastSynced: string | null;
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean;
  /** Current sync error message, or null if no error */
  syncError: string | null;
  /** Module currently being synced */
  currentModule: SyncModule | null;
}

/**
 * Return type for useSyncStatus hook
 */
export interface UseSyncStatusReturn {
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Trigger a sync operation for a specific module */
  triggerSync: (module: SyncModule) => void;
  /** Clear the current sync error */
  clearError: () => void;
  /** Check if a specific module was recently synced (within threshold) */
  isRecentlySynced: (thresholdMs?: number) => boolean;
}

// Default threshold: 5 minutes
const DEFAULT_STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Stored sync data structure for localStorage
 */
interface StoredSyncData {
  lastSynced: string;
  module: SyncModule;
}

/**
 * Hook to track sync status between modules
 *
 * Listens to eventBus for sync events and maintains sync state.
 * Stores last sync time in localStorage for persistence.
 *
 * @returns Sync status object with lastSynced, isSyncing, syncError, and triggerSync function
 */
export function useSyncStatus(): UseSyncStatusReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Initialize state from localStorage
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    const stored = safeStorage.getItem(STORAGE_KEYS.SYNC_LAST_SYNCED);
    const parsedData = safeJsonParse<StoredSyncData>(stored, { lastSynced: '', module: 'all' as SyncModule });

    return {
      lastSynced: parsedData.lastSynced || null,
      isSyncing: false,
      syncError: null,
      currentModule: null,
    };
  });

  // Handle sync_started event
  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = eventBus.subscribe('sync_started', (payload) => {
      if (payload.tenantId !== tenantId) return;

      logger.debug('[useSyncStatus] Sync started', { module: payload.module });

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: true,
        syncError: null,
        currentModule: payload.module,
      }));
    });

    return unsubscribe;
  }, [tenantId]);

  // Handle sync_completed event
  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = eventBus.subscribe('sync_completed', (payload) => {
      if (payload.tenantId !== tenantId) return;

      logger.debug('[useSyncStatus] Sync completed', {
        module: payload.module,
        syncedAt: payload.syncedAt
      });

      // Persist to localStorage
      const dataToStore: StoredSyncData = {
        lastSynced: payload.syncedAt,
        module: payload.module,
      };
      const stringified = safeJsonStringify(dataToStore);
      if (stringified) {
        safeStorage.setItem(STORAGE_KEYS.SYNC_LAST_SYNCED, stringified);
      }

      setSyncStatus((prev) => ({
        ...prev,
        lastSynced: payload.syncedAt,
        isSyncing: false,
        syncError: null,
        currentModule: null,
      }));
    });

    return unsubscribe;
  }, [tenantId]);

  // Handle sync_error event
  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = eventBus.subscribe('sync_error', (payload) => {
      if (payload.tenantId !== tenantId) return;

      logger.error('[useSyncStatus] Sync error', {
        module: payload.module,
        error: payload.error
      });

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: payload.error,
        currentModule: null,
      }));
    });

    return unsubscribe;
  }, [tenantId]);

  /**
   * Trigger a sync operation for a specific module
   * Publishes sync_started event to the eventBus
   */
  const triggerSync = useCallback((module: SyncModule) => {
    if (!tenantId) {
      logger.warn('[useSyncStatus] Cannot trigger sync: no tenant context');
      return;
    }

    if (syncStatus.isSyncing) {
      logger.debug('[useSyncStatus] Sync already in progress, ignoring trigger');
      return;
    }

    logger.info('[useSyncStatus] Triggering sync', { module, tenantId });

    // Publish sync_started event
    eventBus.publish('sync_started', {
      tenantId,
      module,
    });

    // Note: The actual sync logic should be handled by subscribers to sync_started
    // They should publish sync_completed or sync_error when done
  }, [tenantId, syncStatus.isSyncing]);

  /**
   * Clear the current sync error
   */
  const clearError = useCallback(() => {
    setSyncStatus((prev) => ({
      ...prev,
      syncError: null,
    }));
  }, []);

  /**
   * Check if the last sync was within the threshold
   */
  const isRecentlySynced = useCallback((thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS): boolean => {
    if (!syncStatus.lastSynced) return false;

    const lastSyncedTime = new Date(syncStatus.lastSynced).getTime();
    const now = Date.now();

    return (now - lastSyncedTime) < thresholdMs;
  }, [syncStatus.lastSynced]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({
    syncStatus,
    triggerSync,
    clearError,
    isRecentlySynced,
  }), [syncStatus, triggerSync, clearError, isRecentlySynced]);
}

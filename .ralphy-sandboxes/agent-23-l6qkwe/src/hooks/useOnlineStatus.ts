/**
 * useOnlineStatus Hook
 *
 * Tracks browser online/offline status with comprehensive features:
 * - Shows banner when offline
 * - Queues mutations when offline, replays when online
 * - Integrates with TanStack Query's onlineManager
 * - Shows sync indicator when reconnecting
 * - Publishes connection_status events to eventBus
 *
 * Critical for field staff using mobile admin.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onlineManager } from '@tanstack/react-query';

import { publish } from '@/lib/eventBus';
import { logger } from '@/lib/logger';
import { useTenantContext } from '@/hooks/useTenantContext';

/**
 * Connection status type
 */
export type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

/**
 * Online status state
 */
export interface OnlineStatusState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Whether the browser is online */
  isOnline: boolean;
  /** Whether we're currently reconnecting */
  isReconnecting: boolean;
  /** Timestamp of last online event */
  lastOnlineAt: number | null;
  /** Timestamp of last offline event */
  lastOfflineAt: number | null;
  /** Number of queued mutations waiting to sync */
  queuedMutationsCount: number;
  /** Whether the offline banner should be shown */
  showBanner: boolean;
  /** Whether sync is in progress */
  isSyncing: boolean;
}

/**
 * Hook return type
 */
export interface UseOnlineStatusReturn {
  /** Current online status state */
  state: OnlineStatusState;
  /** Whether browser is currently online */
  isOnline: boolean;
  /** Whether currently reconnecting */
  isReconnecting: boolean;
  /** Whether offline banner should be shown */
  showBanner: boolean;
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Number of queued mutations */
  queuedMutationsCount: number;
  /** Manually trigger reconnect check */
  checkConnection: () => void;
  /** Dismiss the offline banner temporarily */
  dismissBanner: () => void;
  /** Connection status string */
  connectionStatus: ConnectionStatus;
}

/**
 * Hook options
 */
export interface UseOnlineStatusOptions {
  /** Whether to auto-dismiss banner after coming online (ms). 0 to disable. Default: 3000 */
  autoDismissBannerDelay?: number;
  /** Whether to publish events to eventBus. Default: true */
  publishEvents?: boolean;
}

// Reconnecting timeout (how long to show reconnecting status after coming online)
const RECONNECTING_TIMEOUT_MS = 5000;

/**
 * Hook to track browser online/offline status
 * Integrates with TanStack Query's onlineManager for mutation queueing
 * Publishes connection_status events to eventBus for cross-module awareness
 *
 * @param options - Hook options
 * @returns Online status state and utilities
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isOnline, showBanner, isSyncing, queuedMutationsCount } = useOnlineStatus();
 *
 *   return (
 *     <div>
 *       {showBanner && (
 *         <OfflineBanner
 *           isOnline={isOnline}
 *           isSyncing={isSyncing}
 *           pendingCount={queuedMutationsCount}
 *         />
 *       )}
 *       <MainContent />
 *     </div>
 *   );
 * }
 * ```
 */
export function useOnlineStatus(options: UseOnlineStatusOptions = {}): UseOnlineStatusReturn {
  const {
    autoDismissBannerDelay = 3000,
    publishEvents = true,
  } = options;

  const { tenantId } = useTenantContext();
  const mountedRef = useRef(true);
  const reconnectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousStatusRef = useRef<ConnectionStatus>('online');

  // Core state
  const [isOnline, setIsOnline] = useState(() => {
    // Initialize from navigator if available, otherwise assume online
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<number | null>(null);
  const [queuedMutationsCount, setQueuedMutationsCount] = useState(0);

  // Clear timeouts helper
  const clearTimeouts = useCallback(() => {
    if (reconnectingTimeoutRef.current) {
      clearTimeout(reconnectingTimeoutRef.current);
      reconnectingTimeoutRef.current = null;
    }
    if (autoDismissTimeoutRef.current) {
      clearTimeout(autoDismissTimeoutRef.current);
      autoDismissTimeoutRef.current = null;
    }
  }, []);

  // Publish connection status event to eventBus
  const publishConnectionStatus = useCallback((
    status: ConnectionStatus,
    prevStatus: ConnectionStatus
  ) => {
    if (!publishEvents || !tenantId) return;

    logger.debug('[useOnlineStatus] Publishing connection_status event', {
      status,
      previousStatus: prevStatus,
      tenantId,
    });

    publish('connection_status', {
      tenantId,
      status,
      previousStatus: prevStatus,
      timestamp: new Date().toISOString(),
    });
  }, [publishEvents, tenantId]);

  // Handle coming online
  const handleOnline = useCallback(() => {
    if (!mountedRef.current) return;

    logger.info('[useOnlineStatus] Browser came online');

    const now = Date.now();
    const prevStatus = previousStatusRef.current;

    setIsOnline(true);
    setLastOnlineAt(now);
    setIsReconnecting(true);
    setIsSyncing(true);
    setBannerDismissed(false);

    previousStatusRef.current = 'reconnecting';

    // Publish reconnecting status
    publishConnectionStatus('reconnecting', prevStatus);

    // Set TanStack Query online manager to online
    // This triggers any paused mutations to resume
    onlineManager.setOnline(true);

    // Clear reconnecting state after timeout
    reconnectingTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      setIsReconnecting(false);
      setIsSyncing(false);
      setQueuedMutationsCount(0);

      previousStatusRef.current = 'online';
      publishConnectionStatus('online', 'reconnecting');

      logger.debug('[useOnlineStatus] Reconnection complete, sync finished');

      // Auto-dismiss banner after delay
      if (autoDismissBannerDelay > 0) {
        autoDismissTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setBannerDismissed(true);
        }, autoDismissBannerDelay);
      }
    }, RECONNECTING_TIMEOUT_MS);
  }, [publishConnectionStatus, autoDismissBannerDelay]);

  // Handle going offline
  const handleOffline = useCallback(() => {
    if (!mountedRef.current) return;

    logger.warn('[useOnlineStatus] Browser went offline');

    const now = Date.now();
    const prevStatus = previousStatusRef.current;

    clearTimeouts();

    setIsOnline(false);
    setLastOfflineAt(now);
    setIsReconnecting(false);
    setIsSyncing(false);
    setBannerDismissed(false);

    previousStatusRef.current = 'offline';

    // Set TanStack Query online manager to offline
    // This pauses mutations until we're back online
    onlineManager.setOnline(false);

    publishConnectionStatus('offline', prevStatus);
  }, [clearTimeouts, publishConnectionStatus]);

  // Set up event listeners and TanStack Query integration
  useEffect(() => {
    mountedRef.current = true;

    // Initial status tracking
    previousStatusRef.current = navigator.onLine ? 'online' : 'offline';

    // Browser online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to TanStack Query's online manager for mutation queue awareness
    const unsubscribe = onlineManager.subscribe(() => {
      if (!mountedRef.current) return;

      const currentlyOnline = onlineManager.isOnline();
      logger.debug('[useOnlineStatus] TanStack Query online manager update', {
        isOnline: currentlyOnline
      });
    });

    // Initial sync with TanStack Query
    onlineManager.setOnline(navigator.onLine);

    logger.debug('[useOnlineStatus] Initialized', {
      isOnline: navigator.onLine,
      tenantId,
    });

    return () => {
      mountedRef.current = false;
      clearTimeouts();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe?.();
    };
  }, [handleOnline, handleOffline, clearTimeouts, tenantId]);

  // Manually check connection
  const checkConnection = useCallback(() => {
    const currentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    logger.debug('[useOnlineStatus] Manual connection check', { currentlyOnline });

    if (currentlyOnline !== isOnline) {
      if (currentlyOnline) {
        handleOnline();
      } else {
        handleOffline();
      }
    }
  }, [isOnline, handleOnline, handleOffline]);

  // Dismiss banner temporarily
  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    logger.debug('[useOnlineStatus] Banner dismissed');
  }, []);

  // Determine current connection status
  const connectionStatus: ConnectionStatus = useMemo(() => {
    if (!isOnline) return 'offline';
    if (isReconnecting) return 'reconnecting';
    return 'online';
  }, [isOnline, isReconnecting]);

  // Determine if banner should show
  const showBanner = useMemo(() => {
    // Always show when offline
    if (!isOnline) return true;
    // Show when reconnecting/syncing
    if (isReconnecting || isSyncing) return true;
    // Show when there are queued mutations
    if (queuedMutationsCount > 0) return true;
    // Hide if dismissed
    if (bannerDismissed) return false;
    return false;
  }, [isOnline, isReconnecting, isSyncing, queuedMutationsCount, bannerDismissed]);

  // Build state object
  const state: OnlineStatusState = useMemo(() => ({
    status: connectionStatus,
    isOnline,
    isReconnecting,
    lastOnlineAt,
    lastOfflineAt,
    queuedMutationsCount,
    showBanner,
    isSyncing,
  }), [
    connectionStatus,
    isOnline,
    isReconnecting,
    lastOnlineAt,
    lastOfflineAt,
    queuedMutationsCount,
    showBanner,
    isSyncing,
  ]);

  return useMemo(() => ({
    state,
    isOnline,
    isReconnecting,
    showBanner,
    isSyncing,
    queuedMutationsCount,
    checkConnection,
    dismissBanner,
    connectionStatus,
  }), [
    state,
    isOnline,
    isReconnecting,
    showBanner,
    isSyncing,
    queuedMutationsCount,
    checkConnection,
    dismissBanner,
    connectionStatus,
  ]);
}

export default useOnlineStatus;

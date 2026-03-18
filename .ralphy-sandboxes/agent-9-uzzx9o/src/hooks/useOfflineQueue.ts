/**
 * Offline Queue React Hook
 * Provides offline status and queue management in React components
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import {
    initOfflineQueue,
    getOnlineStatus,
    onOnlineStatusChange,
    onQueueChange,
    getPendingActions,
    getFailedActions,
    getQueueStats,
    syncQueue,
    retryAction,
    removeAction,
    QueuedAction,
} from '@/lib/offlineQueue';

export interface UseOfflineQueueReturn {
    isOnline: boolean;
    isInitialized: boolean;
    pendingCount: number;
    failedCount: number;
    pendingActions: QueuedAction[];
    failedActions: QueuedAction[];
    sync: () => Promise<{ success: number; failed: number }>;
    retry: (actionId: string) => Promise<void>;
    remove: (actionId: string) => Promise<void>;
}

/**
 * Hook for managing offline queue state and actions
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { isOnline, pendingCount, sync } = useOfflineQueue();
 * 
 *   return (
 *     <div>
 *       {!isOnline && <OfflineBanner />}
 *       {pendingCount > 0 && (
 *         <div>
 *           {pendingCount} actions pending
 *           <button onClick={sync}>Sync Now</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
    const [isOnline, setIsOnline] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [pendingActions, setPendingActions] = useState<QueuedAction[]>([]);
    const [failedActions, setFailedActions] = useState<QueuedAction[]>([]);
    const [stats, setStats] = useState({ pending: 0, failed: 0, total: 0 });

    // Initialize on mount
    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                await initOfflineQueue();

                if (mounted) {
                    setIsOnline(getOnlineStatus());
                    setIsInitialized(true);

                    // Load initial data
                    const [pending, failed, queueStats] = await Promise.all([
                        getPendingActions(),
                        getFailedActions(),
                        getQueueStats(),
                    ]);

                    setPendingActions(pending);
                    setFailedActions(failed);
                    setStats(queueStats);
                }
            } catch (error) {
                logger.error('Failed to initialize offline queue', error);
                if (mounted) {
                    setIsInitialized(true); // Still mark as initialized
                }
            }
        }

        init();

        return () => {
            mounted = false;
        };
    }, []);

    // Subscribe to online status changes
    useEffect(() => {
        const unsubscribe = onOnlineStatusChange((online) => {
            setIsOnline(online);
        });
        return unsubscribe;
    }, []);

    // Subscribe to queue changes
    useEffect(() => {
        const unsubscribe = onQueueChange(async (queue) => {
            setPendingActions(queue);
            const [failed, queueStats] = await Promise.all([
                getFailedActions(),
                getQueueStats(),
            ]);
            setFailedActions(failed);
            setStats(queueStats);
        });
        return unsubscribe;
    }, []);

    const sync = useCallback(async () => {
        const result = await syncQueue();
        // Refresh stats after sync
        const queueStats = await getQueueStats();
        setStats(queueStats);
        return result;
    }, []);

    const retry = useCallback(async (actionId: string) => {
        await retryAction(actionId);
    }, []);

    const remove = useCallback(async (actionId: string) => {
        await removeAction(actionId);
    }, []);

    return {
        isOnline,
        isInitialized,
        pendingCount: stats.pending,
        failedCount: stats.failed,
        pendingActions,
        failedActions,
        sync,
        retry,
        remove,
    };
}

/**
 * Simple hook for just checking online status
 */
export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}

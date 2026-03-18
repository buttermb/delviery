/**
 * Offline Action Queue
 * 
 * Queues user actions when offline and syncs when connection is restored.
 * Uses IndexedDB for persistence across sessions.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

// Action types that can be queued
export type QueuedActionType =
    | 'create_order'
    | 'update_order_status'
    | 'update_inventory'
    | 'create_customer'
    | 'update_customer'
    | 'send_message'
    | 'create_menu'
    | 'generic';

export interface QueuedAction {
    id: string;
    type: QueuedActionType;
    payload: Record<string, unknown>;
    endpoint: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    createdAt: string;
    retryCount: number;
    maxRetries: number;
    lastError?: string;
    status: 'pending' | 'processing' | 'failed' | 'completed';
}

interface OfflineQueueDB extends DBSchema {
    actions: {
        key: string;
        value: QueuedAction;
        indexes: { 'by-status': string; 'by-created': string };
    };
}

// Singleton database instance
let db: IDBPDatabase<OfflineQueueDB> | null = null;

// Connection state
let isOnline = true;
let syncInProgress = false;
const listeners: Set<(online: boolean) => void> = new Set();
const queueListeners: Set<(queue: QueuedAction[]) => void> = new Set();

/**
 * Initialize the offline queue database
 */
async function initDB(): Promise<IDBPDatabase<OfflineQueueDB>> {
    if (db) return db;

    db = await openDB<OfflineQueueDB>('offline-queue', 1, {
        upgrade(database) {
            const store = database.createObjectStore('actions', { keyPath: 'id' });
            store.createIndex('by-status', 'status');
            store.createIndex('by-created', 'createdAt');
        },
    });

    return db;
}

/**
 * Generate unique ID for queued actions
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Initialize network monitoring
 */
export async function initOfflineQueue(): Promise<void> {
    // Initialize DB
    await initDB();

    // Check initial network status
    if (Capacitor.isNativePlatform()) {
        const status = await Network.getStatus();
        isOnline = status.connected;

        // Listen for network changes
        Network.addListener('networkStatusChange', (status) => {
            const wasOnline = isOnline;
            isOnline = status.connected;

            // Notify listeners
            listeners.forEach((listener) => listener(isOnline));

            // Sync when coming back online
            if (!wasOnline && isOnline) {
                syncQueue();
            }
        });
    } else {
        // Web fallback
        isOnline = navigator.onLine;

        window.addEventListener('online', () => {
            isOnline = true;
            listeners.forEach((listener) => listener(true));
            syncQueue();
        });

        window.addEventListener('offline', () => {
            isOnline = false;
            listeners.forEach((listener) => listener(false));
        });
    }

    // Try to sync any pending actions on init
    if (isOnline) {
        syncQueue();
    }
}

/**
 * Check if currently online
 */
export function getOnlineStatus(): boolean {
    return isOnline;
}

/**
 * Subscribe to online status changes
 */
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

/**
 * Subscribe to queue changes
 */
export function onQueueChange(callback: (queue: QueuedAction[]) => void): () => void {
    queueListeners.add(callback);
    return () => queueListeners.delete(callback);
}

/**
 * Notify queue listeners
 */
async function notifyQueueListeners(): Promise<void> {
    const queue = await getPendingActions();
    queueListeners.forEach((listener) => listener(queue));
}

/**
 * Queue an action for later sync
 */
export async function queueAction(
    type: QueuedActionType,
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    payload: Record<string, unknown>,
    maxRetries = 3
): Promise<string> {
    const database = await initDB();

    const action: QueuedAction = {
        id: generateId(),
        type,
        endpoint,
        method,
        payload,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries,
        status: 'pending',
    };

    await database.put('actions', action);
    await notifyQueueListeners();

    // If online, try to sync immediately
    if (isOnline) {
        syncQueue();
    }

    return action.id;
}

/**
 * Get all pending actions
 */
export async function getPendingActions(): Promise<QueuedAction[]> {
    const database = await initDB();
    const actions = await database.getAllFromIndex('actions', 'by-status', 'pending');
    return actions.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

/**
 * Get all failed actions
 */
export async function getFailedActions(): Promise<QueuedAction[]> {
    const database = await initDB();
    return database.getAllFromIndex('actions', 'by-status', 'failed');
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
    pending: number;
    failed: number;
    total: number;
}> {
    const database = await initDB();
    const pending = await database.countFromIndex('actions', 'by-status', 'pending');
    const failed = await database.countFromIndex('actions', 'by-status', 'failed');
    return {
        pending,
        failed,
        total: pending + failed,
    };
}

/**
 * Remove an action from the queue
 */
export async function removeAction(id: string): Promise<void> {
    const database = await initDB();
    await database.delete('actions', id);
    await notifyQueueListeners();
}

/**
 * Retry a failed action
 */
export async function retryAction(id: string): Promise<void> {
    const database = await initDB();
    const action = await database.get('actions', id);

    if (action && action.status === 'failed') {
        action.status = 'pending';
        action.retryCount = 0;
        action.lastError = undefined;
        await database.put('actions', action);
        await notifyQueueListeners();

        if (isOnline) {
            syncQueue();
        }
    }
}

/**
 * Clear all completed actions
 */
export async function clearCompleted(): Promise<void> {
    const database = await initDB();
    const actions = await database.getAllFromIndex('actions', 'by-status', 'completed');

    for (const action of actions) {
        await database.delete('actions', action.id);
    }

    await notifyQueueListeners();
}

/**
 * Execute a single action
 */
async function executeAction(action: QueuedAction): Promise<boolean> {
    const database = await initDB();

    try {
        // Update status to processing
        action.status = 'processing';
        await database.put('actions', action);

        // Make the API request
        const response = await fetch(action.endpoint, {
            method: action.method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(action.payload),
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Mark as completed and remove
        action.status = 'completed';
        await database.put('actions', action);

        // Remove completed actions after a delay
        setTimeout(async () => {
            await removeAction(action.id);
        }, 5000);

        return true;
    } catch (error) {
        action.retryCount++;
        action.lastError = error instanceof Error ? error.message : 'Unknown error';

        if (action.retryCount >= action.maxRetries) {
            action.status = 'failed';
        } else {
            action.status = 'pending';
        }

        await database.put('actions', action);
        return false;
    }
}

/**
 * Sync all pending actions
 */
export async function syncQueue(): Promise<{ success: number; failed: number }> {
    if (!isOnline || syncInProgress) {
        return { success: 0, failed: 0 };
    }

    syncInProgress = true;
    let success = 0;
    let failed = 0;

    try {
        const pendingActions = await getPendingActions();

        for (const action of pendingActions) {
            const result = await executeAction(action);
            if (result) {
                success++;
            } else {
                failed++;
            }

            // Notify listeners after each action
            await notifyQueueListeners();
        }
    } finally {
        syncInProgress = false;
    }

    return { success, failed };
}

/**
 * Higher-order function to wrap API calls with offline support
 */
export function withOfflineSupport<T extends Record<string, unknown>>(
    type: QueuedActionType,
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
) {
    return async (payload: T): Promise<{ queued: boolean; id?: string; data?: unknown }> => {
        if (isOnline) {
            try {
                const response = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                return { queued: false, data };
            } catch {
                // Network error - queue the action
                const id = await queueAction(type, endpoint, method, payload);
                return { queued: true, id };
            }
        } else {
            // Offline - queue immediately
            const id = await queueAction(type, endpoint, method, payload);
            return { queued: true, id };
        }
    };
}

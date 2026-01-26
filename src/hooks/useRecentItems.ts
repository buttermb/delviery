import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS, safeJsonParse, safeJsonStringify } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';

export interface RecentItem {
    id: string;
    type: 'order' | 'product' | 'client';
    label: string;
    subLabel?: string;
    path: string;
    timestamp: number;
}

const MAX_ITEMS = 10;

/**
 * Hook for tracking recently used items with localStorage persistence
 * - Limits to 10 items maximum
 * - Syncs across browser tabs via storage event
 * - Uses safe storage utilities to handle incognito/private mode
 */
export function useRecentItems() {
    const [items, setItems] = useState<RecentItem[]>([]);

    // Load items from localStorage on mount
    useEffect(() => {
        const stored = safeStorage.getItem(STORAGE_KEYS.RECENTLY_USED_ITEMS);
        if (stored) {
            const parsed = safeJsonParse<RecentItem[]>(stored, []);
            // Ensure we never exceed MAX_ITEMS limit
            setItems(parsed.slice(0, MAX_ITEMS));
        }
    }, []);

    // Sync across tabs using storage event
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEYS.RECENTLY_USED_ITEMS && e.newValue) {
                const parsed = safeJsonParse<RecentItem[]>(e.newValue, []);
                setItems(parsed.slice(0, MAX_ITEMS));
            } else if (e.key === STORAGE_KEYS.RECENTLY_USED_ITEMS && e.newValue === null) {
                // Storage was cleared in another tab
                setItems([]);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('storage', handleStorageChange);
            return () => window.removeEventListener('storage', handleStorageChange);
        }
    }, []);

    const addRecentItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
        setItems(prev => {
            const newItem = { ...item, timestamp: Date.now() };
            // Remove duplicates (by id and type)
            const filtered = prev.filter(i => !(i.id === item.id && i.type === item.type));
            // Add to top and limit to MAX_ITEMS (10)
            const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);

            // Persist to localStorage
            const json = safeJsonStringify(updated);
            if (json) {
                safeStorage.setItem(STORAGE_KEYS.RECENTLY_USED_ITEMS, json);
            } else {
                logger.warn('Failed to stringify recent items for storage', { component: 'useRecentItems' });
            }

            return updated;
        });
    }, []);

    const clearRecentItems = useCallback(() => {
        setItems([]);
        safeStorage.removeItem(STORAGE_KEYS.RECENTLY_USED_ITEMS);
    }, []);

    return {
        items,
        addRecentItem,
        clearRecentItems
    };
}

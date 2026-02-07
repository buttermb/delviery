import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

export interface RecentItem {
    id: string;
    type: 'order' | 'product' | 'client';
    label: string;
    subLabel?: string;
    path: string;
    timestamp: number;
}

const MAX_ITEMS = 10;
const STORAGE_KEY = 'admin-recent-items';

export function useRecentItems() {
    const [items, setItems] = useState<RecentItem[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setItems(JSON.parse(stored));
            } catch (e) {
                logger.error('Failed to parse recent items', e instanceof Error ? e : new Error(String(e)), { component: 'useRecentItems' });
            }
        }
    }, []);

    const addRecentItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
        setItems(prev => {
            const newItem = { ...item, timestamp: Date.now() };
            // Remove duplicates (by id and type)
            const filtered = prev.filter(i => !(i.id === item.id && i.type === item.type));
            // Add to top
            const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);

            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const clearRecentItems = useCallback(() => {
        setItems([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return {
        items,
        addRecentItem,
        clearRecentItems
    };
}

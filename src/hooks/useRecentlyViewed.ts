import { useEffect, useState, useCallback } from "react";
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { logger } from '@/lib/logger';

const MAX_ITEMS = 6;

export const useRecentlyViewed = () => {
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = safeStorage.getItem(STORAGE_KEYS.RECENTLY_VIEWED);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentlyViewed(parsed);
        }
      }
    } catch (error) {
      logger.warn('Failed to load recently viewed products', error);
    }
  }, []);

  const addToRecentlyViewed = useCallback((productId: string) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((id) => id !== productId);
      const updated = [productId, ...filtered].slice(0, MAX_ITEMS);
      try {
        safeStorage.setItem(STORAGE_KEYS.RECENTLY_VIEWED, JSON.stringify(updated));
      } catch (error) {
        logger.warn('Failed to save recently viewed products', error);
      }
      return updated;
    });
  }, []);

  return { recentlyViewed, addToRecentlyViewed };
};

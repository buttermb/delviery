import { useEffect, useState } from "react";
import { STORAGE_KEYS } from '@/constants/storageKeys';
const MAX_ITEMS = 6;

export const useRecentlyViewed = () => {
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.RECENTLY_VIEWED);
    if (stored) {
      setRecentlyViewed(JSON.parse(stored));
    }
  }, []);

  const addToRecentlyViewed = (productId: string) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((id) => id !== productId);
      const updated = [productId, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEYS.RECENTLY_VIEWED, JSON.stringify(updated));
      return updated;
    });
  };

  return { recentlyViewed, addToRecentlyViewed };
};

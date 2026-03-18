import { useState, useEffect } from "react";
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';

function parseViewCounts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCT_VIEWS) || '{}');
  } catch (error) {
    logger.warn('Failed to parse JSON', error);
    return {};
  }
}

// Note: menu_product_interactions table doesn't exist yet
// Using view counts as fallback - in production, create this table
export const useProductViewCount = (productId: string) => {
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    // Simple localStorage tracking for now
    // In production, create menu_product_interactions table
    const sessionKey = `product_view_${productId}`;
    const hasViewed = sessionStorage.getItem(sessionKey);

    if (!hasViewed) {
      const counts = parseViewCounts();
      counts[productId] = (counts[productId] ?? 0) + 1;
      localStorage.setItem(STORAGE_KEYS.PRODUCT_VIEWS, JSON.stringify(counts));
      sessionStorage.setItem(sessionKey, 'true');
      setViewCount(counts[productId]);
    } else {
      const counts = parseViewCounts();
      setViewCount(counts[productId] ?? 0);
    }
  }, [productId]);

  return viewCount;
};

export const getProductViewCount = (productId: string): number => {
  const counts = parseViewCounts();
  return counts[productId] ?? 0;
};

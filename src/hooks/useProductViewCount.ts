import { useState, useEffect } from "react";

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
      const counts = JSON.parse(localStorage.getItem('product_views') || '{}');
      counts[productId] = (counts[productId] || 0) + 1;
      localStorage.setItem('product_views', JSON.stringify(counts));
      sessionStorage.setItem(sessionKey, 'true');
      setViewCount(counts[productId]);
    } else {
      const counts = JSON.parse(localStorage.getItem('product_views') || '{}');
      setViewCount(counts[productId] || 0);
    }
  }, [productId]);

  return viewCount;
};

export const getProductViewCount = (productId: string): number => {
  const counts = JSON.parse(localStorage.getItem('product_views') || '{}');
  return counts[productId] || 0;
};

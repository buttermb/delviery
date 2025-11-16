import { useState, useEffect } from "react";

const STORAGE_KEY = "product_view_counts";
const SESSION_KEY = "current_session_views";

export const useProductViewCount = (productId: string) => {
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    // Get current view counts from localStorage
    const storedCounts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const sessionViews = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");

    // Check if this user has already viewed this product in this session
    if (!sessionViews[productId]) {
      // Increment view count
      const currentCount = (storedCounts[productId] || 0) + 1;
      storedCounts[productId] = currentCount;
      sessionViews[productId] = true;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedCounts));
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionViews));
    }

    // Add some randomization to make it feel more realistic (20-40% variation)
    const baseCount = storedCounts[productId] || 5;
    const variation = Math.floor(baseCount * (0.2 + Math.random() * 0.2));
    const displayCount = baseCount + variation;

    setViewCount(displayCount);
  }, [productId]);

  return viewCount;
};

export const getProductViewCount = (productId: string): number => {
  const storedCounts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  const baseCount = storedCounts[productId] || Math.floor(Math.random() * 15) + 5;
  const variation = Math.floor(baseCount * (0.2 + Math.random() * 0.2));
  return baseCount + variation;
};

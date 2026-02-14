import { useState, useEffect } from "react";

const STORAGE_KEY = "product_views_tracked";

export const useProductViewTracking = () => {
  const [viewedCount, setViewedCount] = useState(0);

  useEffect(() => {
    const tracked = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    setViewedCount(tracked.length);
  }, []);

  const trackProductView = (productId: string) => {
    const tracked = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    
    if (!tracked.includes(productId)) {
      tracked.push(productId);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tracked));
      setViewedCount(tracked.length);
    }
  };

  const shouldShowMembershipOffer = () => {
    return viewedCount >= 3;
  };

  return { viewedCount, trackProductView, shouldShowMembershipOffer };
};

export const getViewedProductsCount = (): number => {
  const tracked = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
  return tracked.length;
};

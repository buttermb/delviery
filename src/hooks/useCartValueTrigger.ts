import { useState, useEffect } from "react";

interface CartValueTriggerProps {
  cartTotal: number;
  threshold?: number;
}

export const useCartValueTrigger = ({ cartTotal, threshold = 75 }: CartValueTriggerProps) => {
  const [shouldShowOffer, setShouldShowOffer] = useState(false);

  useEffect(() => {
    // Check if user has already seen high-value cart offer
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };

    const hasSeenOffer = getCookie("high_value_cart_offer_shown");
    
    if (!hasSeenOffer && cartTotal >= threshold) {
      setShouldShowOffer(true);
      // Set cookie so we only show once
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `high_value_cart_offer_shown=true; expires=${expires}; path=/; SameSite=Lax`;
    }
  }, [cartTotal, threshold]);

  return { shouldShowOffer };
};

/**
 * Marketplace Analytics Hook
 * Track customer events and gather analytics data
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

type EventType = 
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_start'
  | 'checkout_complete'
  | 'search'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'share'
  | 'review_submit';

interface TrackEventParams {
  storeId: string;
  eventType: EventType;
  productId?: string;
  eventData?: Record<string, unknown>;
  sessionId?: string;
  customerId?: string;
}

export function useMarketplaceAnalytics() {
  const trackEvent = useCallback(async ({
    storeId,
    eventType,
    productId,
    eventData = {},
    sessionId,
    customerId,
  }: TrackEventParams) => {
    try {
      // Store analytics in a generic way - could be expanded to use analytics table
      // For now, just log since marketplace_events table may not exist
      logger.debug('Marketplace event tracked', { 
        storeId, 
        eventType, 
        productId, 
        eventData,
        sessionId,
        customerId,
        url: window.location.href,
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
      });
      
      // If we want to persist to database, we could use a general analytics table
      // or create the marketplace_events table via migration
    } catch (error: unknown) {
      // Silent fail - analytics shouldn't break the app
      logger.debug('Analytics tracking failed', { eventType, error });
    }
  }, []);

  const trackPageView = useCallback((storeId: string, pageName: string) => {
    trackEvent({
      storeId,
      eventType: 'page_view',
      eventData: { page: pageName },
    });
  }, [trackEvent]);

  const trackProductView = useCallback((storeId: string, productId: string, productName: string) => {
    trackEvent({
      storeId,
      eventType: 'product_view',
      productId,
      eventData: { product_name: productName },
    });
  }, [trackEvent]);

  const trackAddToCart = useCallback((storeId: string, productId: string, quantity: number, price: number) => {
    trackEvent({
      storeId,
      eventType: 'add_to_cart',
      productId,
      eventData: { quantity, price, value: quantity * price },
    });
  }, [trackEvent]);

  const trackCheckoutStart = useCallback((storeId: string, cartValue: number, itemCount: number) => {
    trackEvent({
      storeId,
      eventType: 'checkout_start',
      eventData: { cart_value: cartValue, item_count: itemCount },
    });
  }, [trackEvent]);

  const trackSearch = useCallback((storeId: string, query: string, resultsCount: number) => {
    trackEvent({
      storeId,
      eventType: 'search',
      eventData: { query, results_count: resultsCount },
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackPageView,
    trackProductView,
    trackAddToCart,
    trackCheckoutStart,
    trackSearch,
  };
}

export default useMarketplaceAnalytics;

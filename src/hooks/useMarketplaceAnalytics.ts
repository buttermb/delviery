// @ts-nocheck
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
  eventData?: Record<string, any>;
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
      const { error } = await supabase
        .from('marketplace_events')
        .insert({
          store_id: storeId,
          event_type: eventType,
          product_id: productId,
          event_data: {
            ...eventData,
            url: window.location.href,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
          session_id: sessionId,
          customer_id: customerId,
        });

      if (error) {
        logger.error('Failed to track event', error, { component: 'useMarketplaceAnalytics' });
      }
    } catch (error) {
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




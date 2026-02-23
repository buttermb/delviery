import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { safeStorage } from '@/utils/safeStorage';

/**
 * Event types for menu customer tracking
 */
export type MenuEventType =
  | 'view'           // Customer visited menu
  | 'product_view'   // Customer viewed product details
  | 'add_to_cart'    // Customer added product to cart
  | 'checkout_start' // Customer started checkout
  | 'order_complete'; // Customer completed order

/**
 * Metadata that can be attached to events
 */
export interface MenuEventMetadata {
  product_name?: string;
  product_category?: string;
  product_price?: number;
  cart_total?: number;
  cart_item_count?: number;
  order_id?: string;
  order_total?: number;
  referrer?: string;
  user_agent?: string;
  screen_size?: string;
  [key: string]: unknown;
}

/**
 * Configuration for the menu event tracker
 */
interface UseMenuEventsConfig {
  menuId: string;
  tenantId?: string;
  customerId?: string;
}

/**
 * Generate a unique session ID for tracking
 * Persists across page refreshes within the same browser session
 */
function getOrCreateSessionId(menuId: string): string {
  const storageKey = `menu_session_${menuId}`;
  let sessionId = safeStorage.getItem(storageKey);

  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    safeStorage.setItem(storageKey, sessionId);
  }

  return sessionId;
}

/**
 * Hook for tracking customer interactions with menus
 * Logs events to menu_events table for conversion funnel analysis
 */
export function useMenuEvents(config: UseMenuEventsConfig) {
  const { menuId, tenantId, customerId } = config;
  const sessionIdRef = useRef<string | null>(null);
  const trackedEventsRef = useRef<Set<string>>(new Set());

  // Initialize session ID
  useEffect(() => {
    if (menuId) {
      sessionIdRef.current = getOrCreateSessionId(menuId);
    }
  }, [menuId]);

  /**
   * Track a menu event
   * Silent failure - never blocks UI or shows errors to users
   */
  const trackEvent = useCallback(async (
    eventType: MenuEventType,
    productId?: string,
    metadata?: MenuEventMetadata
  ): Promise<void> => {
    // Validate required fields
    if (!menuId || !tenantId) {
      logger.debug('Menu event tracking skipped - missing menuId or tenantId', {
        menuId,
        tenantId,
        eventType,
      });
      return;
    }

    const sessionId = sessionIdRef.current || getOrCreateSessionId(menuId);

    // Deduplicate events within the same session
    // For 'view' events, only track once per session
    // For 'product_view', track once per product per session
    const eventKey = productId
      ? `${eventType}-${productId}`
      : eventType === 'view'
        ? 'view'
        : `${eventType}-${Date.now()}`;

    if (eventType === 'view' && trackedEventsRef.current.has(eventKey)) {
      logger.debug('Duplicate view event skipped', { menuId, sessionId });
      return;
    }

    if (eventType === 'product_view' && trackedEventsRef.current.has(eventKey)) {
      logger.debug('Duplicate product view event skipped', { menuId, productId, sessionId });
      return;
    }

    try {
      // Enrich metadata with browser context
      const enrichedMetadata: MenuEventMetadata = {
        ...metadata,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        screen_size: typeof window !== 'undefined'
          ? `${window.innerWidth}x${window.innerHeight}`
          : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      };

      // Call the database function
      const { error } = await (supabase as any).rpc('log_menu_event', {
        p_tenant_id: tenantId,
        p_menu_id: menuId,
        p_session_id: sessionId,
        p_event_type: eventType,
        p_customer_id: customerId || null,
        p_product_id: productId || null,
        p_metadata: enrichedMetadata,
      });

      if (error) {
        // Log but don't throw - tracking should never break the UI
        logger.warn('Menu event tracking failed', {
          error: error.message,
          eventType,
          menuId,
        });
        return;
      }

      // Mark event as tracked for deduplication
      trackedEventsRef.current.add(eventKey);

      logger.debug('Menu event tracked', {
        eventType,
        menuId,
        productId,
        sessionId,
      });
    } catch (error) {
      // Silent failure - never break the UI for analytics
      logger.warn('Menu event tracking error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType,
        menuId,
      });
    }
  }, [menuId, tenantId, customerId]);

  /**
   * Track menu view event
   */
  const trackView = useCallback(() => {
    return trackEvent('view');
  }, [trackEvent]);

  /**
   * Track product view event
   */
  const trackProductView = useCallback((
    productId: string,
    productName?: string,
    productCategory?: string
  ) => {
    return trackEvent('product_view', productId, {
      product_name: productName,
      product_category: productCategory,
    });
  }, [trackEvent]);

  /**
   * Track add to cart event
   */
  const trackAddToCart = useCallback((
    productId: string,
    productName?: string,
    productPrice?: number
  ) => {
    return trackEvent('add_to_cart', productId, {
      product_name: productName,
      product_price: productPrice,
    });
  }, [trackEvent]);

  /**
   * Track checkout start event
   */
  const trackCheckoutStart = useCallback((
    cartTotal?: number,
    cartItemCount?: number
  ) => {
    return trackEvent('checkout_start', undefined, {
      cart_total: cartTotal,
      cart_item_count: cartItemCount,
    });
  }, [trackEvent]);

  /**
   * Track order complete event
   */
  const trackOrderComplete = useCallback((
    orderId: string,
    orderTotal?: number
  ) => {
    return trackEvent('order_complete', undefined, {
      order_id: orderId,
      order_total: orderTotal,
    });
  }, [trackEvent]);

  /**
   * Get the current session ID
   */
  const getSessionId = useCallback(() => {
    return sessionIdRef.current || getOrCreateSessionId(menuId);
  }, [menuId]);

  /**
   * Reset tracking state (useful for testing)
   */
  const resetTracking = useCallback(() => {
    trackedEventsRef.current.clear();
    const storageKey = `menu_session_${menuId}`;
    safeStorage.removeItem(storageKey);
    sessionIdRef.current = getOrCreateSessionId(menuId);
  }, [menuId]);

  return {
    trackEvent,
    trackView,
    trackProductView,
    trackAddToCart,
    trackCheckoutStart,
    trackOrderComplete,
    getSessionId,
    resetTracking,
  };
}

/**
 * Standalone function for tracking events outside of React components
 * Useful for imperative tracking in callbacks
 */
export async function trackMenuEvent(
  tenantId: string,
  menuId: string,
  sessionId: string,
  eventType: MenuEventType,
  options?: {
    customerId?: string;
    productId?: string;
    metadata?: MenuEventMetadata;
  }
): Promise<boolean> {
  try {
    const { error } = await (supabase as any).rpc('log_menu_event', {
      p_tenant_id: tenantId,
      p_menu_id: menuId,
      p_session_id: sessionId,
      p_event_type: eventType,
      p_customer_id: options?.customerId || null,
      p_product_id: options?.productId || null,
      p_metadata: options?.metadata || {},
    });

    if (error) {
      logger.warn('Menu event tracking failed', { error: error.message, eventType });
      return false;
    }

    return true;
  } catch (error) {
    logger.warn('Menu event tracking error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

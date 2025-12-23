/**
 * Abandoned Cart Recovery Hook
 * Tracks cart abandonment and triggers recovery actions
 */

import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface AbandonedCartRecoveryOptions {
  storeId?: string;
  cartItems: Array<{
    productId: string;
    quantity: number;
    price: number;
    name: string;
  }>;
  customerEmail?: string;
  customerPhone?: string;
  abandonmentThresholdMs?: number; // Time before cart is considered abandoned
  enabled?: boolean;
}

interface CartRecoveryState {
  isAbandoned: boolean;
  lastActivity: number;
  recoveryEmailSent: boolean;
}

const STORAGE_KEY_PREFIX = 'cart_recovery_';
const DEFAULT_ABANDONMENT_THRESHOLD = 10 * 60 * 1000; // 10 minutes

export function useAbandonedCartRecovery({
  storeId,
  cartItems,
  customerEmail,
  customerPhone,
  abandonmentThresholdMs = DEFAULT_ABANDONMENT_THRESHOLD,
  enabled = true,
}: AbandonedCartRecoveryOptions) {
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoggedAbandonment = useRef(false);

  const storageKey = storeId ? `${STORAGE_KEY_PREFIX}${storeId}` : null;

  // Get stored state
  const getStoredState = useCallback((): CartRecoveryState | null => {
    if (!storageKey) return null;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  // Save state
  const saveState = useCallback((state: Partial<CartRecoveryState>) => {
    if (!storageKey) return;
    try {
      const current = getStoredState() || {
        isAbandoned: false,
        lastActivity: Date.now(),
        recoveryEmailSent: false,
      };
      localStorage.setItem(storageKey, JSON.stringify({ ...current, ...state }));
    } catch (error) {
      logger.error('Failed to save cart recovery state', error);
    }
  }, [storageKey, getStoredState]);

  // Update last activity time
  const updateActivity = useCallback(() => {
    if (!enabled || cartItems.length === 0) return;

    saveState({
      lastActivity: Date.now(),
      isAbandoned: false,
    });

    // Reset abandonment detection
    hasLoggedAbandonment.current = false;

    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Set new timeout for abandonment detection
    activityTimeoutRef.current = setTimeout(() => {
      if (cartItems.length > 0) {
        handleAbandonment();
      }
    }, abandonmentThresholdMs);
  }, [enabled, cartItems, abandonmentThresholdMs, saveState]);

  // Handle cart abandonment
  const handleAbandonment = useCallback(async () => {
    if (!storeId || cartItems.length === 0 || hasLoggedAbandonment.current) return;

    hasLoggedAbandonment.current = true;
    saveState({ isAbandoned: true });

    const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Log abandonment (localStorage only - no database table yet)
    logger.info('Cart abandonment detected', { storeId, cartTotal, itemCount: cartItems.length });

    // Trigger recovery flow if we have contact info
    if (customerEmail || customerPhone) {
      triggerRecoveryFlow();
    }
  }, [storeId, cartItems, customerEmail, customerPhone, saveState]);

  // Trigger recovery flow (email/SMS)
  const triggerRecoveryFlow = useCallback(async () => {
    const state = getStoredState();
    if (state?.recoveryEmailSent) return;

    try {
      // Call edge function to send recovery email
      const { error } = await supabase.functions.invoke('send-cart-recovery', {
        body: {
          storeId,
          customerEmail,
          customerPhone,
          cartItems,
          discountCode: 'COMEBACK10', // 10% off
        },
      });

      if (!error) {
        saveState({ recoveryEmailSent: true });
        logger.info('Cart recovery email triggered', { storeId, customerEmail });
      }
    } catch (error) {
      // Edge function might not exist yet - that's OK
      logger.debug('Could not trigger cart recovery (function may not exist)', error);
    }
  }, [storeId, customerEmail, customerPhone, cartItems, getStoredState, saveState]);

  // Mark cart as recovered (on checkout)
  const markRecovered = useCallback(() => {
    if (!storageKey) return;
    localStorage.removeItem(storageKey);
    logger.info('Cart marked as recovered', { storeId });
  }, [storageKey, storeId]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled || cartItems.length === 0) return;

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];

    // Debounced activity handler
    let activityDebounce: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (activityDebounce) clearTimeout(activityDebounce);
      activityDebounce = setTimeout(updateActivity, 1000);
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial activity update
    updateActivity();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (activityDebounce) {
        clearTimeout(activityDebounce);
      }
    };
  }, [enabled, cartItems.length, updateActivity]);

  // Check for existing abandoned cart on mount
  useEffect(() => {
    const state = getStoredState();
    if (state?.isAbandoned && cartItems.length > 0 && !state.recoveryEmailSent) {
      // Cart was previously abandoned, trigger recovery
      triggerRecoveryFlow();
    }
  }, [getStoredState, cartItems.length, triggerRecoveryFlow]);

  return {
    markRecovered,
    isAbandoned: getStoredState()?.isAbandoned || false,
  };
}

export default useAbandonedCartRecovery;

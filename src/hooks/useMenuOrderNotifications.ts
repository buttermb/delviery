/**
 * useMenuOrderNotifications Hook
 *
 * Listens for menu_order_created events and notifies admin with:
 * - Database notification with full order details
 * - Sound notification (optional)
 * - Browser push notification (if PWA installed and permission granted)
 *
 * Uses useNotificationDispatcher pattern for consistency.
 */

import { useEffect, useCallback, useRef } from 'react';

import type { EventPayloads } from '@/lib/eventBus';
import { subscribe } from '@/lib/eventBus';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { playNotificationSound } from '@/utils/notificationSound';
import {
  sendBrowserNotification,
  isBrowserNotificationEnabled,
  getBrowserNotificationPermission,
} from '@/utils/browserNotifications';
import { showServiceWorkerNotification } from '@/utils/serviceWorkerNotifications';
import { STORAGE_KEYS } from '@/constants/storageKeys';

/**
 * Settings for menu order notifications
 */
export interface MenuOrderNotificationSettings {
  /** Enable sound notifications */
  soundEnabled: boolean;
  /** Enable browser push notifications */
  pushEnabled: boolean;
  /** Enable vibration on mobile */
  vibrateEnabled: boolean;
}

const SETTINGS_STORAGE_KEY = STORAGE_KEYS.MENU_ORDER_NOTIFICATION_SETTINGS;

/**
 * Get notification settings from localStorage
 */
export function getMenuOrderNotificationSettings(): MenuOrderNotificationSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  // Default settings
  return {
    soundEnabled: true,
    pushEnabled: true,
    vibrateEnabled: true,
  };
}

/**
 * Save notification settings to localStorage
 */
export function setMenuOrderNotificationSettings(
  settings: Partial<MenuOrderNotificationSettings>
): void {
  try {
    const current = getMenuOrderNotificationSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Format order items for display in notification
 */
function formatOrderItems(
  items: EventPayloads['menu_order_created']['items']
): string {
  if (items.length === 0) return 'No items';
  if (items.length === 1) {
    return `${items[0].quantity}x ${items[0].productName}`;
  }
  if (items.length === 2) {
    return `${items[0].quantity}x ${items[0].productName}, ${items[1].quantity}x ${items[1].productName}`;
  }
  // More than 2 items - show first 2 and count
  return `${items[0].quantity}x ${items[0].productName}, ${items[1].quantity}x ${items[1].productName} +${items.length - 2} more`;
}

/**
 * Options for the hook
 */
export interface UseMenuOrderNotificationsOptions {
  /** Enable/disable the listener (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the hook
 */
export interface UseMenuOrderNotificationsResult {
  /** Whether the listener is active */
  isActive: boolean;
  /** Current notification settings */
  settings: MenuOrderNotificationSettings;
  /** Update notification settings */
  updateSettings: (settings: Partial<MenuOrderNotificationSettings>) => void;
}

/**
 * Hook that listens for menu order events and notifies admin
 *
 * @example
 * ```tsx
 * // In AdminLayout or similar wrapper component
 * const { settings, updateSettings } = useMenuOrderNotifications();
 *
 * // Toggle sound
 * updateSettings({ soundEnabled: !settings.soundEnabled });
 * ```
 */
export function useMenuOrderNotifications(
  options: UseMenuOrderNotificationsOptions = {}
): UseMenuOrderNotificationsResult {
  const { enabled = true } = options;
  const { tenantId, tenantSlug, isReady: contextReady } = useTenantContext();
  const mountedRef = useRef(true);
  const settingsRef = useRef<MenuOrderNotificationSettings>(
    getMenuOrderNotificationSettings()
  );

  const isActive = contextReady && enabled && !!tenantId;

  /**
   * Handle menu_order_created events
   */
  const handleMenuOrderCreated = useCallback(
    async (payload: EventPayloads['menu_order_created']) => {
      if (!mountedRef.current || !tenantId) return;

      // Only process events for our tenant
      if (payload.tenantId !== tenantId) {
        logger.debug('[MenuOrderNotifications] Ignoring event from different tenant');
        return;
      }

      logger.info('[MenuOrderNotifications] Processing menu order notification', {
        orderId: payload.orderId,
        menuId: payload.menuId,
        customerPhone: payload.customerPhone,
        totalAmount: payload.totalAmount,
      });

      const settings = settingsRef.current;
      const itemsSummary = formatOrderItems(payload.items);
      const customerDisplay = payload.customerName || payload.customerPhone;

      // Build detailed message for database notification
      const messageLines = [
        `Customer: ${customerDisplay}`,
        `Phone: ${payload.customerPhone}`,
        `Items: ${itemsSummary}`,
        `Total: ${formatCurrency(payload.totalAmount)}`,
      ];
      if (payload.deliveryAddress) {
        messageLines.push(`Delivery: ${payload.deliveryAddress}`);
      }
      if (payload.customerNotes) {
        messageLines.push(`Notes: ${payload.customerNotes}`);
      }

      const detailedMessage = messageLines.join('\n');

      // 1. Create database notification
      try {
        const { error } = await supabase.from('notifications').insert({
          tenant_id: tenantId,
          user_id: null, // Notify all admins
          title: 'New Menu Order Received',
          message: detailedMessage,
          type: 'success',
          entity_type: 'order',
          entity_id: payload.orderId,
          read: false,
        });

        if (error) {
          logger.error('[MenuOrderNotifications] Failed to create notification', error);
        } else {
          logger.debug('[MenuOrderNotifications] Database notification created');
        }
      } catch (err) {
        logger.error('[MenuOrderNotifications] Error creating notification', err as Error);
      }

      // 2. Play sound notification
      if (settings.soundEnabled) {
        try {
          playNotificationSound(settings.vibrateEnabled);
          logger.debug('[MenuOrderNotifications] Sound notification played');
        } catch (err) {
          logger.warn('[MenuOrderNotifications] Failed to play sound', { error: err });
        }
      }

      // 3. Send browser push notification
      if (settings.pushEnabled) {
        const browserPermission = getBrowserNotificationPermission();
        const browserEnabled = isBrowserNotificationEnabled();

        if (browserPermission === 'granted' && browserEnabled) {
          const shortMessage = `${customerDisplay} - ${formatCurrency(payload.totalAmount)} - ${itemsSummary}`;

          // Try service worker notification first (works on lock screen)
          try {
            await showServiceWorkerNotification('New Menu Order! 🛒', {
              body: shortMessage,
              tag: `menu-order-${payload.orderId}`,
              requireInteraction: true,
              data: {
                type: 'menu_order',
                orderId: payload.orderId,
                menuId: payload.menuId,
              },
            });
            logger.debug('[MenuOrderNotifications] Service worker notification sent');
          } catch {
            // Fallback to regular browser notification
            const orderPath = tenantSlug
              ? `/${tenantSlug}/admin/orders/${payload.orderId}`
              : `/admin/orders/${payload.orderId}`;
            sendBrowserNotification(
              'New Menu Order! 🛒',
              shortMessage,
              orderPath
            );
            logger.debug('[MenuOrderNotifications] Browser notification sent (fallback)');
          }
        } else {
          logger.debug('[MenuOrderNotifications] Push notifications not available', {
            permission: browserPermission,
            enabled: browserEnabled,
          });
        }
      }
    },
    [tenantId, tenantSlug]
  );

  /**
   * Update settings and persist to localStorage
   */
  const updateSettings = useCallback(
    (newSettings: Partial<MenuOrderNotificationSettings>) => {
      settingsRef.current = {
        ...settingsRef.current,
        ...newSettings,
      };
      setMenuOrderNotificationSettings(newSettings);
      logger.debug('[MenuOrderNotifications] Settings updated', newSettings);
    },
    []
  );

  // Set up event subscription
  useEffect(() => {
    mountedRef.current = true;

    if (!isActive) {
      logger.debug('[MenuOrderNotifications] Not active, skipping subscription', {
        contextReady,
        enabled,
        hasTenantId: !!tenantId,
      });
      return;
    }

    // Refresh settings from storage
    settingsRef.current = getMenuOrderNotificationSettings();

    logger.debug('[MenuOrderNotifications] Setting up event subscription', {
      tenantId,
      settings: settingsRef.current,
    });

    const unsubscribe = subscribe('menu_order_created', handleMenuOrderCreated);

    return () => {
      mountedRef.current = false;
      unsubscribe();
      logger.debug('[MenuOrderNotifications] Cleaned up subscription');
    };
  }, [isActive, contextReady, enabled, tenantId, handleMenuOrderCreated]);

  return {
    isActive,
    settings: settingsRef.current,
    updateSettings,
  };
}

export default useMenuOrderNotifications;

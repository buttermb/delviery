/**
 * Browser Push Notifications Utility
 *
 * Provides a simple API for requesting permission and sending
 * browser-native notifications (Web Notification API).
 * Settings are persisted in localStorage.
 */

import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';

const BROWSER_NOTIF_KEY = STORAGE_KEYS.BROWSER_NOTIFICATIONS_ENABLED;

// ============================================================================
// Permission & Settings
// ============================================================================

/**
 * Check if browser notifications are supported
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get the current permission state
 */
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Check if browser notifications are enabled by the user (localStorage toggle)
 */
export function isBrowserNotificationEnabled(): boolean {
  try {
    return localStorage.getItem(BROWSER_NOTIF_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Set browser notification enabled/disabled (localStorage toggle)
 */
export function setBrowserNotificationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BROWSER_NOTIF_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Request browser notification permission.
 * Returns true if permission was granted.
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) {
    logger.debug('Browser notifications not supported', { component: 'browserNotifications' });
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    logger.debug('Browser notifications already denied', { component: 'browserNotifications' });
    return false;
  }

  try {
    const result = await Notification.requestPermission();
    const granted = result === 'granted';
    logger.info('Browser notification permission result', {
      result,
      component: 'browserNotifications',
    });
    return granted;
  } catch (err) {
    logger.warn('Failed to request notification permission', {
      error: err,
      component: 'browserNotifications',
    });
    return false;
  }
}

// ============================================================================
// Sending Notifications
// ============================================================================

/**
 * Send a browser notification.
 * Respects the user's localStorage toggle and browser permission.
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @param link - Optional URL to navigate to when clicked
 */
export function sendBrowserNotification(
  title: string,
  body: string,
  link?: string
): void {
  if (!isBrowserNotificationSupported()) return;
  if (!isBrowserNotificationEnabled()) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `floraiq-${Date.now()}`,
    });

    if (link) {
      notification.onclick = () => {
        window.focus();
        // Use location.href for navigation since this runs outside React router
        window.location.href = link;
        notification.close();
      };
    }

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);
  } catch (err) {
    logger.warn('Failed to show browser notification', {
      error: err,
      component: 'browserNotifications',
    });
  }
}

// ============================================================================
// Init helper (call from AdminLayout on first load)
// ============================================================================

/**
 * Initialize browser notifications on admin load.
 * Requests permission if not yet decided and notifications are enabled.
 */
export function initBrowserNotifications(): void {
  if (!isBrowserNotificationSupported()) return;
  if (!isBrowserNotificationEnabled()) return;

  if (Notification.permission === 'default') {
    // Delay the permission request slightly to avoid blocking initial render
    setTimeout(() => {
      requestBrowserNotificationPermission().catch(() => {
        // Silently ignore
      });
    }, 3000);
  }
}

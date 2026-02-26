import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-Burn Security Module
 *
 * Handles screenshot detection with menu burn triggers,
 * velocity checking for suspicious access patterns,
 * DevTools detection, and suspicious activity logging.
 */

// ============================================
// Types
// ============================================

export interface SuspiciousActivityLog {
  menuId: string;
  type: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface VelocityCheckResult {
  allowed: boolean;
  reason?: string;
  requestCount?: number;
}

interface VelocityWindow {
  timestamps: number[];
}

export interface ScreenshotDetectionConfig {
  burnOnPrintScreen: boolean;
  burnOnSnippingTool: boolean;
  logDevTools: boolean;
  logVisibilityChange: boolean;
  preventCopy: boolean;
  preventPrint: boolean;
}

export interface AutoBurnResult {
  burned: boolean;
  reason: string;
  burnType: 'soft' | 'hard';
}

// ============================================
// In-Memory Velocity Store (Client-side)
// ============================================

const velocityStore = new Map<string, VelocityWindow>();

const VELOCITY_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Clean expired entries from the velocity store
 */
const cleanVelocityStore = (key: string): number[] => {
  const now = Date.now();
  const velocityWindow = velocityStore.get(key);
  if (!velocityWindow) return [];

  const validTimestamps = velocityWindow.timestamps.filter(
    (ts) => now - ts < VELOCITY_WINDOW_MS
  );
  velocityStore.set(key, { timestamps: validTimestamps });
  return validTimestamps;
};

// ============================================
// Suspicious Activity Logging
// ============================================

/**
 * Log suspicious activity to the database
 */
export const logSuspiciousActivity = async (
  menuId: string,
  activityType: string,
  metadata?: Record<string, unknown>
): Promise<void> => {
  try {
    const insertData = {
      menu_id: menuId,
      event_type: activityType,
      severity: getSeverityForActivity(activityType),
      event_data: {
        ...metadata,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        screen_resolution: `${screen.width}x${screen.height}`,
      },
    };

    // Use type assertion to handle dynamic table
    const client = supabase;
    await client.from('menu_security_events').insert(insertData);

    logger.warn('Suspicious activity logged', {
      menuId,
      type: activityType,
    });
  } catch (error) {
    logger.error('Failed to log suspicious activity', error);
  }
};

/**
 * Determine severity level based on activity type
 */
const getSeverityForActivity = (
  type: string
): 'low' | 'medium' | 'high' | 'critical' => {
  switch (type) {
    case 'screenshot_detected':
    case 'print_screen_key':
      return 'high';
    case 'devtools_opened':
    case 'velocity_exceeded':
      return 'high';
    case 'visibility_hidden':
    case 'clipboard_copy_attempt':
      return 'medium';
    case 'print_attempt':
      return 'medium';
    case 'right_click_attempt':
      return 'low';
    default:
      return 'low';
  }
};

// ============================================
// Menu Burn Trigger
// ============================================

/**
 * Trigger a menu burn via the edge function
 */
export const burnMenu = async (
  menuId: string,
  reason: string,
  burnType: 'soft' | 'hard' = 'soft'
): Promise<AutoBurnResult> => {
  try {
    logger.warn('Initiating menu burn', { menuId, reason, burnType });

    // Log the burn event
    const client = supabase;
    await client.from('menu_security_events').insert({
      menu_id: menuId,
      event_type: 'auto_burn_triggered',
      severity: 'critical',
      event_data: {
        reason,
        burn_type: burnType,
        triggered_at: new Date().toISOString(),
      },
    });

    // Update menu status to burned
    const statusValue = burnType === 'hard' ? 'hard_burned' : 'soft_burned';
    const { error } = await supabase
      .from('disposable_menus')
      .update({
        status: statusValue,
        burned_at: new Date().toISOString(),
        burn_reason: reason,
      })
      .eq('id', menuId);

    if (error) {
      logger.error('Failed to burn menu', error);
      return { burned: false, reason: 'Database error', burnType };
    }

    logger.warn('Menu burned successfully', { menuId, reason });
    return { burned: true, reason, burnType };
  } catch (error) {
    logger.error('Error during menu burn', error);
    return { burned: false, reason: 'Exception during burn', burnType };
  }
};

// ============================================
// Screenshot Detection (Enhanced)
// ============================================

/**
 * Initialize screenshot detection with auto-burn capability
 *
 * Monitors for:
 * - Visibility changes (app switching for screenshots) - logs activity
 * - PrintScreen key press - BURNS menu
 * - Snipping Tool / Mac screenshot shortcuts - BURNS menu
 * - DevTools opening (inspection/scraping) - logs activity
 * - Clipboard copy attempts - prevents and logs
 * - Print attempts - prevents and logs
 * - Right-click context menu - prevents
 */
export const initScreenshotDetection = (
  menuId: string,
  onDetect: () => void,
  config: ScreenshotDetectionConfig = {
    burnOnPrintScreen: true,
    burnOnSnippingTool: true,
    logDevTools: true,
    logVisibilityChange: true,
    preventCopy: true,
    preventPrint: true,
  }
): (() => void) => {
  let devToolsOpen = false;
  let devToolsCheckCount = 0;
  const cleanupFns: (() => void)[] = [];

  // Method 1: Visibility change (switching apps to screenshot)
  if (config.logVisibilityChange) {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logSuspiciousActivity(menuId, 'visibility_hidden', {
          source: 'screenshot_detection',
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    cleanupFns.push(() =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    );
  }

  // Method 2: PrintScreen key detection - BURNS menu
  if (config.burnOnPrintScreen) {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        onDetect();
        burnMenu(menuId, 'screenshot_detected');
        logSuspiciousActivity(menuId, 'print_screen_key', {
          triggered_burn: true,
        });
      }

      // Windows: Win + Shift + S (Snipping Tool)
      if (
        config.burnOnSnippingTool &&
        e.key === 's' &&
        e.shiftKey &&
        (e.metaKey || e.ctrlKey)
      ) {
        onDetect();
        logSuspiciousActivity(menuId, 'screenshot_detected', {
          method: 'snipping_tool_shortcut',
          triggered_burn: true,
        });
        burnMenu(menuId, 'screenshot_detected');
      }

      // Mac: Cmd + Shift + 3/4/5
      if (
        config.burnOnSnippingTool &&
        e.metaKey &&
        e.shiftKey &&
        ['3', '4', '5'].includes(e.key)
      ) {
        onDetect();
        logSuspiciousActivity(menuId, 'screenshot_detected', {
          method: 'mac_screenshot_shortcut',
          triggered_burn: true,
        });
        burnMenu(menuId, 'screenshot_detected');
      }
    };
    document.addEventListener('keyup', handleKeyUp);
    cleanupFns.push(() => document.removeEventListener('keyup', handleKeyUp));
  }

  // Method 3: DevTools detection - logs activity
  if (config.logDevTools) {
    const threshold = 160;
    const devToolsInterval = setInterval(() => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        if (!devToolsOpen) {
          devToolsOpen = true;
          devToolsCheckCount++;
          logSuspiciousActivity(menuId, 'devtools_opened', {
            outer_width: window.outerWidth,
            inner_width: window.innerWidth,
            outer_height: window.outerHeight,
            inner_height: window.innerHeight,
            detection_count: devToolsCheckCount,
          });

          // After 3 devtools detections, burn the menu
          if (devToolsCheckCount >= 3) {
            onDetect();
            burnMenu(menuId, 'repeated_devtools_usage', 'soft');
          }
        }
      } else {
        devToolsOpen = false;
      }
    }, 1000);
    cleanupFns.push(() => clearInterval(devToolsInterval));
  }

  // Method 4: Clipboard copy prevention
  if (config.preventCopy) {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logSuspiciousActivity(menuId, 'clipboard_copy_attempt');
    };
    document.addEventListener('copy', handleCopy);
    cleanupFns.push(() => document.removeEventListener('copy', handleCopy));
  }

  // Method 5: Print detection
  if (config.preventPrint) {
    const handleBeforePrint = () => {
      logSuspiciousActivity(menuId, 'print_attempt');
      document.body.style.display = 'none';
    };
    const handleAfterPrint = () => {
      document.body.style.display = '';
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    cleanupFns.push(() => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    });
  }

  // Method 6: Right-click prevention
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    logSuspiciousActivity(menuId, 'right_click_attempt');
  };
  document.addEventListener('contextmenu', handleContextMenu);
  cleanupFns.push(() =>
    document.removeEventListener('contextmenu', handleContextMenu)
  );

  // Method 7: Drag prevention (prevents drag-to-share)
  const handleDragStart = (e: DragEvent) => {
    e.preventDefault();
  };
  document.addEventListener('dragstart', handleDragStart);
  cleanupFns.push(() =>
    document.removeEventListener('dragstart', handleDragStart)
  );

  // Return cleanup function
  return () => {
    cleanupFns.forEach((fn) => fn());
  };
};

// ============================================
// Velocity Check (Client-side)
// ============================================

/**
 * Check if access velocity exceeds threshold
 * Used client-side to pre-check before making API calls
 * Tracks requests per IP per minute (max 10), burns menu on exceed
 */
export const checkVelocity = async (
  menuId: string,
  ip: string
): Promise<VelocityCheckResult> => {
  const key = `menu_velocity:${menuId}:${ip}`;
  const now = Date.now();

  // Clean expired timestamps and get current window
  const recentRequests = cleanVelocityStore(key);

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    await logSuspiciousActivity(menuId, 'velocity_exceeded', {
      ip_hash: ip,
      request_count: recentRequests.length,
      window_ms: VELOCITY_WINDOW_MS,
      max_requests: MAX_REQUESTS_PER_WINDOW,
    });

    await burnMenu(menuId, 'velocity_exceeded');

    return {
      allowed: false,
      reason: 'Too many requests',
      requestCount: recentRequests.length,
    };
  }

  // Record this request
  addRequest(key, now);

  return {
    allowed: true,
    requestCount: recentRequests.length + 1,
  };
};

/**
 * Record a request timestamp for velocity tracking
 */
const addRequest = (key: string, timestamp: number): void => {
  const velocityWindow = velocityStore.get(key) || { timestamps: [] };
  velocityWindow.timestamps.push(timestamp);
  velocityStore.set(key, velocityWindow);
};

/**
 * Get recent requests within the velocity window
 */
export const getRecentRequests = (
  key: string,
  windowMs: number = VELOCITY_WINDOW_MS
): number[] => {
  const now = Date.now();
  const velocityWindow = velocityStore.get(key);
  if (!velocityWindow) return [];
  return velocityWindow.timestamps.filter((ts) => now - ts < windowMs);
};

// ============================================
// IP Hashing Utility
// ============================================

/**
 * Hash an IP address for privacy-preserving velocity tracking
 */
export const hashIp = async (ip: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

// ============================================
// Velocity Store Management
// ============================================

/**
 * Clear the entire velocity store (useful for testing)
 */
export const clearVelocityStore = (): void => {
  velocityStore.clear();
};

/**
 * Get the current size of the velocity store
 */
export const getVelocityStoreSize = (): number => {
  return velocityStore.size;
};

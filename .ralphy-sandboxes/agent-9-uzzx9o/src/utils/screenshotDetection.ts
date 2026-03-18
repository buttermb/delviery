import { logger } from '@/lib/logger';
/**
 * Screenshot Detection & Protection
 * Detects screenshot attempts and logs them for security
 */

export interface ScreenshotAttempt {
  menuId: string;
  customerId?: string;
  customerName?: string;
  deviceFingerprint: string;
  timestamp: Date;
  method: 'keyboard' | 'api' | 'visibility';
}

type ScreenshotCallback = (attempt: ScreenshotAttempt) => void;

let screenshotListeners: ScreenshotCallback[] = [];
let isMonitoring = false;

/**
 * Initialize screenshot detection
 */
export const initScreenshotDetection = (
  menuId: string,
  customerId?: string,
  customerName?: string,
  onDetected?: ScreenshotCallback
) => {
  if (isMonitoring) return;
  isMonitoring = true;

  if (onDetected) {
    screenshotListeners.push(onDetected);
  }

  const deviceFingerprint = generateSimpleFingerprint();

  // Method 1: Keyboard shortcuts detection
  const handleKeyDown = (e: KeyboardEvent) => {
    // PrintScreen key
    if (e.key === 'PrintScreen') {
      notifyScreenshotAttempt(menuId, customerId, customerName, deviceFingerprint, 'keyboard');
    }

    // Windows: Win + Shift + S (Snipping Tool)
    if (e.key === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      notifyScreenshotAttempt(menuId, customerId, customerName, deviceFingerprint, 'keyboard');
    }

    // Mac: Cmd + Shift + 3/4/5
    if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
      notifyScreenshotAttempt(menuId, customerId, customerName, deviceFingerprint, 'keyboard');
    }
  };

  // Method 2: Visibility change (often triggered by screenshot tools)
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page became hidden, might be screenshot tool
      notifyScreenshotAttempt(menuId, customerId, customerName, deviceFingerprint, 'visibility');
    }
  };

  // Method 3: Monitor for screenshot API (if available)
  if ('getScreenDetails' in window) {
    (window as unknown as Record<string, () => Promise<unknown>>).getScreenDetails().then(() => {
      notifyScreenshotAttempt(menuId, customerId, customerName, deviceFingerprint, 'api');
    }).catch(() => {
      // API not available or permission denied
    });
  }

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    isMonitoring = false;
    screenshotListeners = [];
  };
};

/**
 * Notify all listeners about screenshot attempt
 */
const notifyScreenshotAttempt = (
  menuId: string,
  customerId: string | undefined,
  customerName: string | undefined,
  deviceFingerprint: string,
  method: 'keyboard' | 'api' | 'visibility'
) => {
  const attempt: ScreenshotAttempt = {
    menuId,
    customerId,
    customerName,
    deviceFingerprint,
    timestamp: new Date(),
    method,
  };

  screenshotListeners.forEach(callback => {
    try {
      callback(attempt);
    } catch (error) {
      logger.error('Error in screenshot callback:', error);
    }
  });
};

/**
 * Generate a simple device fingerprint
 */
const generateSimpleFingerprint = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ];

  const fingerprint = components.join('|');
  return hashString(fingerprint);
};

/**
 * Simple string hash function
 */
const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

/**
 * Add watermark to page (visual deterrent)
 */
export const addWatermark = (text: string, opacity: number = 0.15) => {
  const existingWatermark = document.getElementById('security-watermark');
  if (existingWatermark) {
    existingWatermark.remove();
  }

  const watermark = document.createElement('div');
  watermark.id = 'security-watermark';
  watermark.style.position = 'fixed';
  watermark.style.top = '50%';
  watermark.style.left = '50%';
  watermark.style.transform = 'translate(-50%, -50%) rotate(-45deg)';
  watermark.style.fontSize = '48px';
  watermark.style.fontWeight = 'bold';
  watermark.style.color = 'rgba(0, 0, 0, ' + opacity + ')';
  watermark.style.pointerEvents = 'none';
  watermark.style.userSelect = 'none';
  watermark.style.zIndex = 'var(--z-max)';
  watermark.style.whiteSpace = 'nowrap';
  watermark.textContent = text;

  document.body.appendChild(watermark);

  return () => {
    watermark.remove();
  };
};

/**
 * Disable right-click context menu (basic protection)
 */
export const disableRightClick = () => {
  const handler = (e: MouseEvent) => {
    e.preventDefault();
    return false;
  };

  document.addEventListener('contextmenu', handler);

  return () => {
    document.removeEventListener('contextmenu', handler);
  };
};

/**
 * Blur content on screenshot attempt (optional aggressive protection)
 */
export const blurOnScreenshot = (selector: string = 'body') => {
  let blurTimeout: NodeJS.Timeout;

  const blurContent = () => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.style.filter = 'blur(20px)';
      
      // Remove blur after 2 seconds
      blurTimeout = setTimeout(() => {
        element.style.filter = 'none';
      }, 2000);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (
      e.key === 'PrintScreen' ||
      (e.key === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) ||
      (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
    ) {
      blurContent();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    if (blurTimeout) clearTimeout(blurTimeout);
  };
};
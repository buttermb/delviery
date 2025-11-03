/**
 * Mobile Utility Functions
 * iOS/Android touch target guidelines and mobile helpers
 */

/**
 * Minimum touch target size per iOS Human Interface Guidelines
 * Ensures buttons are easily tappable on mobile devices
 */
export const TOUCH_TARGET_SIZE = 'min-h-[44px] min-w-[44px]';

/**
 * Mobile-friendly button class combination
 * Combines touch target size with standard button styling
 */
export const MOBILE_BUTTON_CLASS = `${TOUCH_TARGET_SIZE} touch-manipulation active:scale-95 transition-transform`;

/**
 * Check if device is mobile
 */
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1024; // lg breakpoint
};

/**
 * Check if device is touch-enabled
 */
export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};


/**
 * Mobile Utility Functions
 * iOS/Android touch target guidelines and mobile helpers
 */

/**
 * Minimum touch target size per iOS Human Interface Guidelines
 * Ensures buttons are easily tappable on mobile devices
 */
export const TOUCH_TARGET_SIZE = 'min-h-[48px] min-w-[48px]';

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

/**
 * Trigger haptic feedback on supported devices
 * @param style - Intensity of haptic feedback
 */
export const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light'): void => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[style]);
  }
};

/**
 * Get current viewport size category
 */
export const getViewportSize = (): 'xs' | 'sm' | 'md' | 'lg' => {
  if (typeof window === 'undefined') return 'lg';
  const width = window.innerWidth;
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  return 'lg';
};


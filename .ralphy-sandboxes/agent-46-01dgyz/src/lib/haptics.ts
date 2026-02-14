/**
 * Haptic Feedback Utilities
 * Provides native-like haptic feedback for mobile interactions
 */

/**
 * Haptic feedback types
 */
export type HapticType = 
  | 'light'      // Light tap feedback
  | 'medium'     // Medium tap feedback
  | 'heavy'      // Heavy tap feedback
  | 'selection'  // Selection change
  | 'success'    // Success notification
  | 'warning'    // Warning notification
  | 'error';     // Error notification

/**
 * Vibration patterns in milliseconds
 */
const VIBRATION_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  selection: 5,
  success: [10, 50, 10],
  warning: [30, 50, 30],
  error: [50, 50, 50, 50, 50],
};

/**
 * Check if haptic feedback is available
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 * Falls back gracefully on unsupported devices
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  if (!isHapticSupported()) return;

  // Check user preference for reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  try {
    const pattern = VIBRATION_PATTERNS[type];
    navigator.vibrate(pattern);
  } catch {
    // Silently fail if vibration not available
  }
}

/**
 * Light tap - for button presses, selections
 */
export function hapticLight(): void {
  triggerHaptic('light');
}

/**
 * Medium tap - for confirmations, toggles
 */
export function hapticMedium(): void {
  triggerHaptic('medium');
}

/**
 * Heavy tap - for important actions, drag end
 */
export function hapticHeavy(): void {
  triggerHaptic('heavy');
}

/**
 * Selection feedback - for picker/carousel changes
 */
export function hapticSelection(): void {
  triggerHaptic('selection');
}

/**
 * Success feedback - for completed actions
 */
export function hapticSuccess(): void {
  triggerHaptic('success');
}

/**
 * Warning feedback - for warnings, confirmations
 */
export function hapticWarning(): void {
  triggerHaptic('warning');
}

/**
 * Error feedback - for errors, failed actions
 */
export function hapticError(): void {
  triggerHaptic('error');
}

/**
 * React hook for haptic feedback
 */
import { useCallback } from 'react';

export function useHaptic() {
  const vibrate = useCallback((type: HapticType = 'light') => {
    triggerHaptic(type);
  }, []);

  return {
    vibrate,
    light: useCallback(() => hapticLight(), []),
    medium: useCallback(() => hapticMedium(), []),
    heavy: useCallback(() => hapticHeavy(), []),
    selection: useCallback(() => hapticSelection(), []),
    success: useCallback(() => hapticSuccess(), []),
    warning: useCallback(() => hapticWarning(), []),
    error: useCallback(() => hapticError(), []),
    isSupported: isHapticSupported(),
  };
}

/**
 * Higher-order function to add haptic feedback to event handlers
 */
export function withHaptic<T extends (...args: unknown[]) => unknown>(
  fn: T,
  type: HapticType = 'light'
): T {
  return ((...args: Parameters<T>) => {
    triggerHaptic(type);
    return fn(...args);
  }) as T;
}

/**
 * Add haptic feedback to a button click handler
 */
export function hapticClick<E extends React.MouseEvent>(
  handler?: (e: E) => void,
  type: HapticType = 'light'
) {
  return (e: E) => {
    triggerHaptic(type);
    handler?.(e);
  };
}


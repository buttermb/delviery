/**
 * Toast utilities with deduplication to prevent spam
 * 
 * Usage:
 *   import { showErrorToast, showSuccessToast } from '@/lib/toastUtils';
 *   showErrorToast('Failed to save');
 */

import { toast } from 'sonner';

// Track recent toasts to prevent duplicates
const recentToasts = new Map<string, number>();
const TOAST_DEDUPE_WINDOW_MS = 5000; // 5 seconds

/**
 * Clean up old toast entries
 */
function cleanupOldToasts() {
  const now = Date.now();
  for (const [key, timestamp] of recentToasts.entries()) {
    if (now - timestamp > TOAST_DEDUPE_WINDOW_MS) {
      recentToasts.delete(key);
    }
  }
}

/**
 * Check if toast was recently shown
 */
function shouldShowToast(message: string): boolean {
  cleanupOldToasts();
  
  const lastShown = recentToasts.get(message);
  const now = Date.now();
  
  if (lastShown && now - lastShown < TOAST_DEDUPE_WINDOW_MS) {
    return false; // Duplicate within window
  }
  
  recentToasts.set(message, now);
  return true;
}

/**
 * Show error toast with deduplication
 */
export function showErrorToast(message: string, description?: string) {
  if (!shouldShowToast(message)) {
    return; // Skip duplicate
  }
  
  toast.error(message, {
    description,
    duration: 5000,
  });
}

/**
 * Show success toast with deduplication
 */
export function showSuccessToast(message: string, description?: string) {
  if (!shouldShowToast(message)) {
    return; // Skip duplicate
  }
  
  toast.success(message, {
    description,
    duration: 3000,
  });
}

/**
 * Show warning toast with deduplication
 */
export function showWarningToast(message: string, description?: string) {
  if (!shouldShowToast(message)) {
    return; // Skip duplicate
  }
  
  toast.warning(message, {
    description,
    duration: 4000,
  });
}

/**
 * Show info toast with deduplication
 */
export function showInfoToast(message: string, description?: string) {
  if (!shouldShowToast(message)) {
    return; // Skip duplicate
  }
  
  toast.info(message, {
    description,
    duration: 3000,
  });
}

/**
 * Show loading toast (no deduplication needed)
 */
export function showLoadingToast(message: string) {
  return toast.loading(message);
}

/**
 * Dismiss a specific toast
 */
export function dismissToast(toastId: string | number) {
  toast.dismiss(toastId);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts() {
  toast.dismiss();
}

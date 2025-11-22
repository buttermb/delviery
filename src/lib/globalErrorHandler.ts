import { logger } from '@/lib/logger';
/**
 * Global error handlers for unhandled errors and promise rejections
 * Sets up window.onerror and window.onunhandledrejection
 * 
 * Usage: Call setupGlobalErrorHandlers() in main.tsx
 */

import { logger } from './logger';
import { showErrorToast } from './toastUtils';

let isSetup = false;

/**
 * Setup global error handlers
 * Should be called once in main.tsx
 */
export function setupGlobalErrorHandlers() {
  if (isSetup) {
    logger.warn('Global error handlers already setup');
    return;
  }

  // Handle uncaught errors
  window.onerror = (message, source, lineno, colno, error) => {
    // Ignore benign ResizeObserver errors
    const messageStr = String(message);
    if (messageStr.includes('ResizeObserver')) {
      return false;
    }

    logger.error('Uncaught error', error || new Error(messageStr), {
      source,
      lineno,
      colno,
    });

    // Only show toast in development
    if (import.meta.env.DEV) {
      showErrorToast('An unexpected error occurred');
    }

    // Return false to allow default error handling
    return false;
  };

  // Handle unhandled promise rejections
  window.onunhandledrejection = (event) => {
    // Ignore benign ResizeObserver errors
    const reason = event.reason;
    if (reason && typeof reason === 'object' && 'message' in reason) {
      if (String(reason.message).includes('ResizeObserver')) {
        event.preventDefault();
        return;
      }
    }

    logger.error('Unhandled promise rejection', reason, {
      promise: event.promise,
    });

    // Only show toast in development
    if (import.meta.env.DEV) {
      showErrorToast('An unexpected error occurred');
    }

    // Prevent default browser console error
    event.preventDefault();
  };

  isSetup = true;
  logger.info('Global error handlers initialized');
}

/**
 * Capture exception manually (for use in catch blocks)
 */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  logger.error('Captured exception', error, context);
  
  // TODO: Send to Sentry or other monitoring service
  // Example:
  // if (import.meta.env.PROD && window.Sentry) {
  //   window.Sentry.captureException(error, { extra: context });
  // }
}

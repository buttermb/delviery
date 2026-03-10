import { logger } from '@/lib/logger';
/**
 * Global Button Interceptor
 * Automatically monitors all button clicks across the application
 * Works with any Button component or button element
 */

import { buttonMonitor } from './buttonMonitor';

let isInitialized = false;
let healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;
let mutationObserverRef: MutationObserver | null = null;
let unhandledRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
let clickHandler: ((event: MouseEvent) => void) | null = null;
let submitHandler: ((event: SubmitEvent) => void) | null = null;

/**
 * Initialize global button monitoring
 * Call this once in your app initialization
 */
export function initializeGlobalButtonMonitoring() {
  if (isInitialized) {
    logger.info('Reinitializing global button monitoring (HMR support)', { component: 'globalButtonInterceptor' });
    cleanupGlobalButtonMonitoring();
  }

  if (typeof window === 'undefined') {
    return; // Server-side rendering
  }

  // Track active button clicks for error detection
  const activeClicks = new Map<string, {
    complete: (status: 'success' | 'error' | 'timeout', error?: Error | string) => void;
    timeout: NodeJS.Timeout;
    startTime: number;
  }>();

  // Monitor unhandled promise rejections (common in async button handlers)
  unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
    // Try to match to active button click
    const now = Date.now();
    for (const [key, click] of activeClicks.entries()) {
      // If error occurred within 10 seconds of button click, assume it's related
      if (now - click.startTime < 10000) {
        click.complete('error', event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
        clearTimeout(click.timeout);
        activeClicks.delete(key);
        logger.error(
          'Unhandled promise rejection from button action',
          event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
          { component: 'globalButtonInterceptor' }
        );
        break;
      }
    }
  };
  window.addEventListener('unhandledrejection', unhandledRejectionHandler);

  // Monitor all button clicks
  clickHandler = ((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // Check if clicked element is a button or inside a button
    const button = target.closest('button, [role="button"]');
    if (!button) return;

    // Skip if disabled
    if (button.hasAttribute('disabled') || (button as HTMLButtonElement).disabled) return;

    // Get button identifier
    const buttonId = button.id || 
                    button.getAttribute('data-button-id') ||
                    button.getAttribute('aria-label') ||
                    button.textContent?.trim().slice(0, 50) ||
                    `button-${Date.now()}`;

    // Get component name from React component tree or data attributes
    const component = button.getAttribute('data-component') ||
                     button.closest('[data-component]')?.getAttribute('data-component') ||
                     button.closest('[class*="Component"]')?.className?.split(' ')[0] ||
                     'UnknownComponent';

    // Get action from data attribute or button text
    const action = button.getAttribute('data-action') ||
                  button.textContent?.trim().slice(0, 30) ||
                  'click';

    // Track the click
    const startTime = Date.now();
    const complete = buttonMonitor.trackClick(buttonId, component, action, startTime);
    const clickKey = `${component}.${action}.${startTime}`;

    // Set up timeout detection (30 seconds default)
    const timeout = setTimeout(() => {
      complete('timeout', new Error('Button action timed out after 30 seconds'));
      activeClicks.delete(clickKey);
      logger.warn(
        `Button timeout detected: ${component}.${action}`,
        { buttonId, duration: Date.now() - startTime, component: 'globalButtonInterceptor' }
      );
    }, 30000);

    // Store active click for error detection
    activeClicks.set(clickKey, { complete, timeout, startTime });

    // For React buttons, we can't intercept onClick directly
    // Instead, monitor the button state and check for errors after a delay
    // Most async operations complete within 5 seconds
    setTimeout(() => {
      // Check if button is still disabled (indicates async operation in progress)
      const stillDisabled = button.hasAttribute('disabled') || (button as HTMLButtonElement).disabled;
      
      if (!stillDisabled && activeClicks.has(clickKey)) {
        // Button is enabled again, assume success (unless error occurred)
        clearTimeout(timeout);
        activeClicks.delete(clickKey);
        // Give a bit more time for errors to surface
        setTimeout(() => {
          // If no error was logged, mark as success
          // This is a best-effort approach for React buttons
          complete('success');
        }, 500);
      }
    }, 5000);

    // Also check for navigation (link buttons)
    const href = button.getAttribute('href');
    if (href && !href.startsWith('#')) {
      // Navigation button - complete immediately
      clearTimeout(timeout);
      activeClicks.delete(clickKey);
      setTimeout(() => complete('success'), 100);
    }

    // Clean up old active clicks (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    for (const [key, click] of activeClicks.entries()) {
      if (click.startTime < oneMinuteAgo) {
        clearTimeout(click.timeout);
        activeClicks.delete(key);
      }
    }
  }) as EventListener;
  document.addEventListener('click', clickHandler, true); // Use capture phase to catch all clicks

  // Monitor form submissions (buttons in forms)
  submitHandler = ((event: SubmitEvent) => {
    const form = event.target as HTMLFormElement;
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement;
    
    if (submitButton) {
      const buttonId = submitButton.id || 
                     submitButton.getAttribute('data-button-id') ||
                     'form-submit';
      const component = submitButton.getAttribute('data-component') ||
                       form.getAttribute('data-component') ||
                       'Form';
      const action = 'submit';

      const startTime = Date.now();
      const complete = buttonMonitor.trackClick(buttonId, component, action, startTime);

      // Monitor form submission
      form.addEventListener('submit', async (_e) => {
        try {
          // Wait a bit to see if form submission succeeds
          await new Promise(resolve => setTimeout(resolve, 1000));
          complete('success');
        } catch (err) {
          complete('error', err);
        }
      }, { once: true });
    }
  }) as EventListener;
  document.addEventListener('submit', submitHandler, true);

  // MutationObserver removed — the callback body was empty (buttons are
  // monitored on first click via the document-level click handler above),
  // and observing every DOM mutation across document.body with subtree:true
  // caused severe GC pressure on a large SPA.

  isInitialized = true;
  logger.info('Global button monitoring initialized', { component: 'globalButtonInterceptor' });

  // Expose to window for console access (development only)
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const devWindow = window as unknown as Record<string, unknown>;
    devWindow.buttonMonitor = buttonMonitor;
    devWindow.getButtonHealth = () => buttonMonitor.getHealthReport();
    devWindow.getBrokenButtons = (threshold = 0.3) => buttonMonitor.getBrokenButtons(threshold);
    logger.debug('🔍 Button Monitor available in console: window.buttonMonitor');
  }

  // Log health report periodically in development
  if (import.meta.env.DEV) {
    healthCheckIntervalId = setInterval(() => {
      const report = buttonMonitor.getHealthReport();
      if (report.errorRate > 0.1 || report.brokenButtons > 0) {
        logger.warn('Button health check', { ...report, component: 'globalButtonInterceptor' });
        logger.warn('⚠️ Button Health Alert:', {
          brokenButtons: report.brokenButtons,
          errorRate: `${Math.round(report.errorRate * 100)}%`,
          topErrors: report.topErrors.slice(0, 3),
        });
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

/**
 * Cleanup global button monitoring
 * Removes all event listeners, disconnects observers, and clears intervals.
 * Call this before reinitializing or when tearing down the app.
 */
export function cleanupGlobalButtonMonitoring() {
  if (healthCheckIntervalId !== null) {
    clearInterval(healthCheckIntervalId);
    healthCheckIntervalId = null;
  }

  if (mutationObserverRef !== null) {
    mutationObserverRef.disconnect();
    mutationObserverRef = null;
  }

  if (unhandledRejectionHandler !== null) {
    window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    unhandledRejectionHandler = null;
  }

  if (clickHandler !== null) {
    document.removeEventListener('click', clickHandler, true);
    clickHandler = null;
  }

  if (submitHandler !== null) {
    document.removeEventListener('submit', submitHandler, true);
    submitHandler = null;
  }

  isInitialized = false;
  logger.info('Global button monitoring cleaned up', { component: 'globalButtonInterceptor' });
}

/**
 * Get button monitoring status
 */
export function getButtonMonitoringStatus() {
  return {
    initialized: isInitialized,
    stats: buttonMonitor.getStats(),
    healthReport: buttonMonitor.getHealthReport(),
  };
}


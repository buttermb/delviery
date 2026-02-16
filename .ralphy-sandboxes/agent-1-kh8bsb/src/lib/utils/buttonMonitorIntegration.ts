import { logger } from '@/lib/logger';
/**
 * Button Monitor Integration
 * Provides easy integration for existing buttons
 */

import { buttonMonitor } from './buttonMonitor';

/**
 * Wrap an async function with button monitoring
 */
export function monitorButtonAction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  component: string,
  action: string,
  buttonId?: string
): T {
  return (async (...args: Parameters<T>) => {
    const id = buttonId || `${component}-${action}-${Date.now()}`;
    const startTime = Date.now();
    const complete = buttonMonitor.trackClick(id, component, action, startTime);

    try {
      const result = await fn(...args);
      complete('success');
      return result;
    } catch (error) {
      complete('error', error);
      throw error;
    }
  }) as T;
}

/**
 * Create a monitored button handler
 */
export function createMonitoredHandler(
  handler: () => void | Promise<void>,
  component: string,
  action: string,
  buttonId?: string
): () => Promise<void> {
  return monitorButtonAction(
    async () => {
      await handler();
    },
    component,
    action,
    buttonId
  );
}

/**
 * Log button health report to console (for debugging)
 */
export function logButtonHealthReport() {
  const report = buttonMonitor.getHealthReport();
  const broken = buttonMonitor.getBrokenButtons(0.3);

  logger.info('Button Health Report', { ...report, component: 'ButtonMonitor' });

  if (broken.length > 0) {
    logger.warn(
      `Found ${broken.length} broken buttons`,
      { brokenButtons: broken.map((b) => `${b.component}.${b.action}`), component: 'ButtonMonitor' }
    );
  }

  // Also log to console in development
  if (import.meta.env.DEV) {
    /* eslint-disable no-console */
    console.group('Button Health Report');
    logger.debug('Total Buttons:', report.totalButtons);
    logger.debug('Total Clicks:', report.totalClicks);
    logger.debug('Success Rate:', `${Math.round(report.successRate * 100)}%`);
    logger.debug('Error Rate:', `${Math.round(report.errorRate * 100)}%`);
    logger.debug('Broken Buttons:', report.brokenButtons);
    if (broken.length > 0) {
      console.group('Broken Buttons');
      broken.forEach((b) => {
        const errorRate = b.totalClicks > 0 ? b.errorCount / b.totalClicks : 0;
        logger.error(
          `${b.component}.${b.action}: ${Math.round(errorRate * 100)}% error rate (${b.errorCount}/${b.totalClicks})`
        );
        if (b.lastError) {
          logger.error('  Last Error:', b.lastError);
        }
      });
      console.groupEnd();
    }
    console.groupEnd();
    /* eslint-enable no-console */
  }

  return report;
}

/**
 * Auto-log button health on errors (call this in error boundaries)
 * Returns a cleanup function to clear the interval.
 */
export function autoLogButtonHealth(): () => void {
  // Log health report every 5 minutes
  const intervalId = setInterval(() => {
    const report = buttonMonitor.getHealthReport();
    if (report.errorRate > 0.1) {
      // Only log if error rate is significant
      logButtonHealthReport();
    }
  }, 5 * 60 * 1000); // 5 minutes

  return () => clearInterval(intervalId);
}


import { logger } from '@/lib/logger';
/**
 * Production-ready logging utility
 * Replaces console.log/error throughout the app
 * 
 * Usage:
 *   logger.debug('Debug message', { data });
 *   logger.error('Error occurred', error, { context });
 */

export type LogContext = string | Record<string, unknown>;

class Logger {
  private isDev = import.meta.env.DEV;
  private isProduction = import.meta.env.PROD;

  /**
   * Debug logging - only in development
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDev) {
      console.log(`[DEBUG] ${message}`, context || '');
    }
  }

  /**
   * Info logging - only in development
   */
  info(message: string, context?: LogContext): void {
    if (this.isDev) {
      console.info(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Warning logging - always logged
   */
  warn(message: string, errorOrContext?: unknown, context?: LogContext): void {
    const actualContext = typeof errorOrContext === 'object' && errorOrContext !== null && !('message' in errorOrContext)
      ? errorOrContext as LogContext
      : context;

    console.warn(`[WARN] ${message}`, actualContext || '');

    if (this.isProduction) {
      this.sendToMonitoring('warn', message, actualContext);
    }
  }

  /**
   * Error logging - always logged
   */
  error(message: string, errorOrContext?: unknown, context?: LogContext): void {
    let errorDetails = null;
    let actualContext: Record<string, unknown> = {};

    if (errorOrContext instanceof Error) {
      errorDetails = {
        message: errorOrContext.message,
        stack: errorOrContext.stack,
        name: errorOrContext.name
      };
    } else if (typeof errorOrContext === 'object' && errorOrContext !== null) {
      if ('message' in errorOrContext) {
        errorDetails = errorOrContext;
      } else {
        actualContext = errorOrContext as Record<string, unknown>;
      }
    }

    // Merge context if provided
    if (context) {
      if (typeof context === 'string') {
        actualContext = { ...actualContext, context };
      } else {
        actualContext = { ...actualContext, ...context };
      }
    }

    console.error(`[ERROR] ${message}`, errorDetails, actualContext);

    if (this.isProduction) {
      this.sendToMonitoring('error', message, {
        ...actualContext,
        error: errorDetails
      });
    }
  }

  /**
   * Send logs to monitoring service (placeholder for Sentry integration)
   */
  private sendToMonitoring(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: LogContext): void {
    // Placeholder for future Sentry/monitoring integration
    // Example:
    // Sentry.captureMessage(message, {
    //   level,
    //   extra: context
    // });
  }
}

export const logger = new Logger();

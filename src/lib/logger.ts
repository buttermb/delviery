/**
 * Production-ready logging utility
 * Replaces console.log/error throughout the app
 * 
 * Usage:
 *   logger.debug('Debug message', { data });
 *   logger.error('Error occurred', error, { context });
 */

export type LogContext = string | Record<string, unknown>;

/* eslint-disable no-console */
class Logger {
  private isDev = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
  private isProduction = (typeof import.meta !== 'undefined' && import.meta.env?.PROD) || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

  /**
   * Debug logging - only in development
   * Supports both 2-param and 3-param signatures for compatibility
   */
  debug(message: string, data?: unknown, sourceOrContext?: string | Record<string, unknown>): void {
    if (this.isDev) {
      const context = typeof sourceOrContext === 'string' ? sourceOrContext : sourceOrContext;
      console.log(`[DEBUG] ${message}`, data || '', context || '');
    }
  }

  /**
   * Info logging - only in development
   * Supports both 2-param and 3-param signatures for compatibility
   */
  info(message: string, data?: unknown, sourceOrContext?: string | Record<string, unknown>): void {
    if (this.isDev) {
      const context = typeof sourceOrContext === 'string' ? sourceOrContext : sourceOrContext;
      console.log(`[INFO] ${message}`, data || '', context || '');
    }
  }

  /**
   * Warning logging - always logged
   * Supports both 2-param and 3-param signatures for compatibility
   */
  warn(message: string, data?: unknown, sourceOrContext?: string | Record<string, unknown>): void {
    const context = typeof sourceOrContext === 'string' ? sourceOrContext : sourceOrContext;
    console.warn(`[WARN] ${message}`, data || '', context || '');

    if (this.isProduction) {
      this.sendToMonitoring('warn', message, context);
    }
  }

  /**
   * Error logging - always logged
   * Supports both 2-param and 3-param signatures for compatibility
   */
  error(message: string, error?: Error | unknown, sourceOrContext?: string | Record<string, unknown>): void {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;

    const context = typeof sourceOrContext === 'string' ? sourceOrContext : sourceOrContext;

    console.error(`[ERROR] ${message}`, errorData || '', context || '');

    if (this.isProduction && error) {
      this.sendToMonitoring('error', message, {
        error: errorData,
        context
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

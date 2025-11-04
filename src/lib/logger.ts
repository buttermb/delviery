/**
 * Production-ready logging utility
 * Replaces console.log/error throughout the app
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('Debug message', { data });
 *   logger.error('Error occurred', error, { context });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  userId?: string;
  tenantId?: string;
  action?: string;
  [key: string]: unknown;
}

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
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context || '');
    
    if (this.isProduction) {
      // TODO: Send to monitoring service (Sentry, etc.)
      this.sendToMonitoring('warn', message, context);
    }
  }

  /**
   * Error logging - always logged
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;

    console.error(`[ERROR] ${message}`, errorDetails, context || '');
    
    if (this.isProduction) {
      // TODO: Send to monitoring service
      this.sendToMonitoring('error', message, {
        ...context,
        error: errorDetails
      });
    }
  }

  /**
   * Send logs to monitoring service (placeholder for Sentry integration)
   */
  private sendToMonitoring(level: LogLevel, message: string, context?: LogContext): void {
    // Placeholder for future Sentry/monitoring integration
    // Example:
    // Sentry.captureMessage(message, {
    //   level,
    //   extra: context
    // });
  }
}

export const logger = new Logger();

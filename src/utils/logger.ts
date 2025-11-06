/**
 * Centralized Logging Utility
 * Replaces console.log with environment-aware logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  source?: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private isProduction = import.meta.env.PROD;

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, data?: unknown, source?: string): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data || '');
      this.logToService('debug', message, data, source);
    }
  }

  /**
   * Log info messages (development + production)
   */
  info(message: string, data?: unknown, source?: string): void {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, data || '');
    }
    this.logToService('info', message, data, source);
  }

  /**
   * Log warnings (always logged)
   */
  warn(message: string, data?: unknown, source?: string): void {
    console.warn(`[WARN] ${message}`, data || '');
    this.logToService('warn', message, data, source);
  }

  /**
   * Log errors (always logged, sent to error tracking)
   */
  error(message: string, error?: Error | unknown, source?: string): void {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;

    console.error(`[ERROR] ${message}`, errorData || '');
    this.logToService('error', message, errorData, source);
    
    // In production, send to error tracking service
    if (this.isProduction && error) {
      this.sendToErrorTracking(message, error);
    }
  }

  /**
   * Log to logging service (if configured)
   */
  private logToService(
    level: LogLevel,
    message: string,
    data?: unknown,
    source?: string
  ): void {
    // In production, you can send logs to:
    // - Logtail, Datadog, Sentry, etc.
    // For now, we just format the log entry
    
    const logEntry: LogEntry = {
      level,
      message,
      data: this.sanitizeData(data),
      timestamp: new Date().toISOString(),
      source,
    };

    // Only log to service in production if configured
    if (this.isProduction && import.meta.env.VITE_LOG_SERVICE_URL) {
      // Send to logging service (implement based on your service)
      this.sendToLoggingService(logEntry);
    }
  }

  /**
   * Sanitize sensitive data before logging
   */
  private sanitizeData(data: unknown): unknown {
    if (!data) return data;
    
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
    const dataStr = JSON.stringify(data);
    
    // Remove sensitive data from logs
    let sanitized = dataStr;
    sensitiveKeys.forEach(key => {
      const regex = new RegExp(`"${key}":\\s*"[^"]*"`, 'gi');
      sanitized = sanitized.replace(regex, `"${key}": "[REDACTED]"`);
    });
    
    try {
      return JSON.parse(sanitized);
    } catch {
      return data;
    }
  }

  /**
   * Send error to error tracking service (e.g., Sentry)
   */
  private sendToErrorTracking(message: string, error: Error | unknown): void {
    // Integrate with your error tracking service
    // Example: Sentry.captureException(error)
    
    // For now, we'll just format it
    if (error instanceof Error) {
      // Could send to Sentry, LogRocket, etc.
      console.error('[Error Tracking]', {
        message,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Send logs to external logging service
   */
  private sendToLoggingService(entry: LogEntry): void {
    // Implement based on your logging service
    // Example: fetch(import.meta.env.VITE_LOG_SERVICE_URL, { method: 'POST', body: JSON.stringify(entry) })
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (message: string, data?: unknown, source?: string) => logger.debug(message, data, source),
  info: (message: string, data?: unknown, source?: string) => logger.info(message, data, source),
  warn: (message: string, data?: unknown, source?: string) => logger.warn(message, data, source),
  error: (message: string, error?: Error | unknown, source?: string) => logger.error(message, error, source),
};





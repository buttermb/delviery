import { logger } from '@/lib/logger';
/**
 * Enhanced Production Logger with Category-Based Logging
 * 
 * Features:
 * - Category-based log tracking for critical flows
 * - In-memory storage for AdminDebugPanel
 * - Environment-aware console output
 * - Error reporting to localStorage (production)
 * - Export functionality for debugging
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogCategory = 
  | 'AUTH' 
  | 'ORDER_CREATE' 
  | 'ORDER_QUERY' 
  | 'REALTIME' 
  | 'DB_QUERY'
  | 'RLS_FAILURE'
  | 'STATE_CHANGE';

export interface LogEntry {
  category: LogCategory;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  tenantId?: string;
}

class ProductionLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private isDev = import.meta.env.DEV;
  private isProduction = import.meta.env.PROD;

  /**
   * Main logging method with category tracking
   */
  log(entry: Omit<LogEntry, 'timestamp'>): void {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    // Console output with emoji for visibility (dev only unless error/warn)
    const emoji: Record<LogLevel, string> = {
      info: '📘',
      warn: '⚠️',
      error: '🔴',
      debug: '🔍'
    };

    // In development, log everything. In production, only log errors and warnings
    if (this.isDev || entry.level === 'error' || entry.level === 'warn') {
      logger.info(
        `${emoji[entry.level]} [${entry.category}] ${entry.message}`,
        entry.data || ''
      );
    }

    // Always store in memory for Debug Panel
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // In production, store critical errors to localStorage for manual review
    if (this.isProduction && (entry.level === 'error' || entry.level === 'warn')) {
      this.reportError(logEntry);
    }
  }

  /**
   * Store critical errors in localStorage for manual review
   */
  private reportError(entry: LogEntry): void {
    try {
      const key = 'production_debug_logs';
      const existingLogs = JSON.parse(localStorage.getItem(key) || '[]');
      existingLogs.push(entry);
      // Keep only last 50 errors
      const trimmedLogs = existingLogs.slice(-50);
      localStorage.setItem(key, JSON.stringify(trimmedLogs));
    } catch {
      // Silent fail - don't break app for logging
    }
  }

  /**
   * Get all logs in memory
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by category
   */
  getLogsByCategory(category: LogCategory): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get stored production errors from localStorage
   */
  getStoredErrors(): LogEntry[] {
    try {
      return JSON.parse(localStorage.getItem('production_debug_logs') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear stored production errors
   */
  clearStoredErrors(): void {
    try {
      localStorage.removeItem('production_debug_logs');
    } catch {
      // Silent fail
    }
  }
}

// Singleton instance
export const debugLogger = new ProductionLogger();

// Convenience functions for specific categories
export const logAuth = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'AUTH', level: 'info', message, data });
};

export const logAuthWarn = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'AUTH', level: 'warn', message, data });
};

export const logAuthError = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'AUTH', level: 'error', message, data });
};

export const logOrderCreate = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'ORDER_CREATE', level: 'info', message, data });
};

export const logOrderCreateError = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'ORDER_CREATE', level: 'error', message, data });
};

export const logOrderQuery = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'ORDER_QUERY', level: 'info', message, data });
};

export const logOrderQueryError = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'ORDER_QUERY', level: 'error', message, data });
};

export const logRealtime = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'REALTIME', level: 'info', message, data });
};

export const logRealtimeWarn = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'REALTIME', level: 'warn', message, data });
};

export const logRealtimeError = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'REALTIME', level: 'error', message, data });
};

export const logRLSFailure = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'RLS_FAILURE', level: 'error', message, data });
};

export const logDBQuery = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'DB_QUERY', level: 'debug', message, data });
};

export const logDBQueryWarn = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'DB_QUERY', level: 'warn', message, data });
};

export const logStateChange = (message: string, data?: Record<string, unknown>): void => {
  debugLogger.log({ category: 'STATE_CHANGE', level: 'info', message, data });
};


import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
/**
 * Production Error Logger
 * Logs critical errors in production where console is stripped
 */

interface LogEntry {
  timestamp: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
}

const MAX_LOGS = 100;
const PROD_LOG_KEY = STORAGE_KEYS.APP_PRODUCTION_LOGS;

class ProductionLogger {
  private logs: LogEntry[] = [];

  constructor() {
    this.loadLogs();
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(PROD_LOG_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch {
      // Silent fail - localStorage might be unavailable
    }
  }

  private saveLogs() {
    try {
      // Keep only the most recent logs
      const recentLogs = this.logs.slice(-MAX_LOGS);
      localStorage.setItem(PROD_LOG_KEY, JSON.stringify(recentLogs));
    } catch {
      // Silent fail
    }
  }

  error(message: string, context?: Record<string, unknown>, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message,
      context,
      stack: error?.stack,
    };

    this.logs.push(entry);
    this.saveLogs();

    // Log critical production errors via logger
    logger.error('[Production Error]', message, context);
  }

  warning(message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'warning',
      message,
      context,
    };

    this.logs.push(entry);
    this.saveLogs();
  }

  info(message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'info',
      message,
      context,
    };

    this.logs.push(entry);
    this.saveLogs();
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem(PROD_LOG_KEY);
    } catch {
      // Silent fail
    }
  }

  getRecentErrors(count: number = 10): LogEntry[] {
    return this.logs
      .filter(log => log.type === 'error')
      .slice(-count);
  }
}

export const productionLogger = new ProductionLogger();

/**
 * Production Error Logger
 * Logs critical errors in production where console is stripped
 */

interface LogEntry {
  timestamp: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  context?: any;
  stack?: string;
}

const MAX_LOGS = 100;
const STORAGE_KEY = 'nym_production_logs';

class ProductionLogger {
  private logs: LogEntry[] = [];

  constructor() {
    this.loadLogs();
  }

  private loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      // Silent fail - localStorage might be unavailable
    }
  }

  private saveLogs() {
    try {
      // Keep only the most recent logs
      const recentLogs = this.logs.slice(-MAX_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentLogs));
    } catch (e) {
      // Silent fail
    }
  }

  error(message: string, context?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message,
      context,
      stack: error?.stack,
    };

    this.logs.push(entry);
    this.saveLogs();

    // Keep console.error in production for critical issues
    if (typeof console !== 'undefined' && console.error) {
      console.error('[NYM Production Error]', message, context);
    }
  }

  warning(message: string, context?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'warning',
      message,
      context,
    };

    this.logs.push(entry);
    this.saveLogs();
  }

  info(message: string, context?: any) {
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
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
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

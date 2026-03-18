/**
 * Centralized error reporting for admin panel
 * Helps track and debug issues in production
 */


import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
interface ErrorReport {
  message: string;
  stack?: string;
  component?: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

const MAX_ERRORS = 50;
const ERROR_LOG_KEY = STORAGE_KEYS.ADMIN_ERROR_LOGS;

class ErrorReporter {
  private errors: ErrorReport[] = [];

  constructor() {
    this.loadErrors();
  }

  private loadErrors() {
    try {
      const stored = localStorage.getItem(ERROR_LOG_KEY);
      if (stored) {
        this.errors = JSON.parse(stored);
      }
    } catch (e) {
      logger.error('Failed to load error logs', e);
    }
  }

  private saveErrors() {
    try {
      const recentErrors = this.errors.slice(-MAX_ERRORS);
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(recentErrors));
    } catch (e) {
      logger.error('Failed to save error logs', e);
    }
  }

  report(error: Error, component?: string) {
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      component,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.errors.push(errorReport);
    this.saveErrors();

    // Log to console in development
    if (import.meta.env.DEV) {
      logger.error('[Error Reporter]', errorReport);
    }
  }

  getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
    try {
      localStorage.removeItem(ERROR_LOG_KEY);
    } catch (e) {
      logger.error('Failed to clear error logs', e);
    }
  }

  getRecentErrors(count: number = 10): ErrorReport[] {
    return this.errors.slice(-count);
  }
}

export const errorReporter = new ErrorReporter();

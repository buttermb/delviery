/**
 * Centralized error reporting for admin panel
 * Helps track and debug issues in production
 */

interface ErrorReport {
  message: string;
  stack?: string;
  component?: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

const MAX_ERRORS = 50;
const STORAGE_KEY = 'admin_error_logs';

class ErrorReporter {
  private errors: ErrorReport[] = [];

  constructor() {
    this.loadErrors();
  }

  private loadErrors() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.errors = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load error logs', e);
    }
  }

  private saveErrors() {
    try {
      const recentErrors = this.errors.slice(-MAX_ERRORS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentErrors));
    } catch (e) {
      console.error('Failed to save error logs', e);
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
      console.error('[Error Reporter]', errorReport);
    }
  }

  getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear error logs', e);
    }
  }

  getRecentErrors(count: number = 10): ErrorReport[] {
    return this.errors.slice(-count);
  }
}

export const errorReporter = new ErrorReporter();

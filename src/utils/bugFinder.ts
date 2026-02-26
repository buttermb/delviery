import { logger } from '@/lib/logger';
/**
 * Comprehensive Bug Finder and Error Scanner
 * Monitors, detects, and reports all types of errors across the application
 */

import { errorReporter } from './errorReporting';

export interface BugReport {
  id: string;
  type: 'api' | '404' | 'fetch' | 'edge' | 'realtime' | 'promise' | 'runtime' | 'build';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  url?: string;
  statusCode?: number;
  timestamp: string;
  stack?: string;
  component?: string;
  userAgent: string;
  context?: Record<string, unknown>;
}

export interface BugScanResult {
  totalBugs: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  bugs: BugReport[];
  summary: {
    apiErrors: number;
    fetchErrors: number;
    edgeErrors: number;
    realtimeErrors: number;
    promiseRejections: number;
    runtimeErrors: number;
    notFoundErrors: number;
  };
}

class BugFinder {
  private bugs: BugReport[] = [];
  private fetchInterceptor?: typeof fetch;
  private originalFetch?: typeof fetch;
  private apiErrors: Map<string, number> = new Map();
  private edgeFunctionErrors: Map<string, number> = new Map();
  private maxBugs = 1000;
  private listeners: Set<(bug: BugReport) => void> = new Set();

  constructor() {
    this.setupGlobalHandlers();
    this.setupFetchInterceptor();
  }

  /**
   * Setup global error handlers for unhandled errors
   */
  private setupGlobalHandlers() {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportBug({
        type: 'promise',
        severity: 'high',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        context: {
          reason: event.reason,
          promise: event.promise.toString(),
        },
      });
    });

    // Global runtime errors
    window.addEventListener('error', (event) => {
      this.reportBug({
        type: 'runtime',
        severity: event.error ? 'high' : 'medium',
        message: event.message,
        url: event.filename,
        stack: event.error?.stack,
        context: {
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        },
      });
    });
  }

  /**
   * Intercept fetch calls to monitor API errors
   */
  private setupFetchInterceptor() {
    if (typeof window === 'undefined') return;

    // Store original fetch with proper binding to window
    this.originalFetch = window.fetch.bind(window);
    const originalFetch = this.originalFetch;
    const reportBug = this.reportBug.bind(this);

    window.fetch = async function(...args): Promise<Response> {
      const [url, options] = args;
      const urlString = typeof url === 'string' ? url : url.toString();
      const method = options?.method || 'GET';
      const startTime = Date.now();

      try {
        // Call with proper context using apply
        const response = await originalFetch!.apply(window, args);
        const duration = Date.now() - startTime;

        // Check for errors
        if (!response.ok) {
          let errorBody: unknown = null;
          try {
            const clone = response.clone();
            errorBody = await clone.text();
            try {
              errorBody = JSON.parse(errorBody as string);
            } catch (e) { logger.warn('[BugFinder] Failed to parse error response body as JSON', { error: e }); }
          } catch (e) { logger.warn('[BugFinder] Failed to read error response body', { error: e }); }

          const severity = response.status >= 500
            ? 'critical'
            : response.status >= 400
            ? 'high'
            : 'medium';

          reportBug({
            type: response.status === 404 ? '404' : 'api',
            severity,
            message: `HTTP ${response.status} ${response.statusText}`,
            url: urlString,
            statusCode: response.status,
            context: {
              method,
              duration,
              body: errorBody,
              headers: Object.fromEntries(response.headers.entries()),
            },
          });
        }

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        reportBug({
          type: 'fetch',
          severity: 'high',
          message: error instanceof Error ? error.message : String(error),
          url: urlString,
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            method,
            duration,
            error: error,
          },
        });

        throw error;
      }
    };
  }

  /**
   * Report a Supabase Edge Function error
   */
  reportEdgeFunctionError(functionName: string, error: Error | string, context?: Record<string, unknown>) {
    const count = this.edgeFunctionErrors.get(functionName) ?? 0;
    this.edgeFunctionErrors.set(functionName, count + 1);

    this.reportBug({
      type: 'edge',
      severity: 'high',
      message: error instanceof Error ? error.message : error,
      url: `/functions/${functionName}`,
      stack: error instanceof Error ? error.stack : undefined,
      context: {
        functionName,
        errorCount: count + 1,
        ...context,
      },
    });
  }

  /**
   * Report a Realtime subscription error
   */
  reportRealtimeError(channel: string, error: Error | string, status?: string) {
    this.reportBug({
      type: 'realtime',
      severity: status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' ? 'high' : 'medium',
      message: error instanceof Error ? error.message : error,
      context: {
        channel,
        status,
      },
    });
  }

  /**
   * Report a 404 error
   */
  report404(url: string, context?: Record<string, unknown>) {
    this.reportBug({
      type: '404',
      severity: 'medium',
      message: `Resource not found: ${url}`,
      url,
      statusCode: 404,
      context,
    });
  }

  /**
   * Report a runtime error
   */
  reportRuntimeError(error: Error, component?: string, context?: Record<string, unknown>) {
    this.reportBug({
      type: 'runtime',
      severity: 'high',
      message: error.message,
      stack: error.stack,
      component,
      context,
    });
  }

  /**
   * Core bug reporting method
   */
  private reportBug(bug: Partial<BugReport>) {
    const bugReport: BugReport = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ...bug,
    } as BugReport;

    // Add to bugs array
    this.bugs.push(bugReport);

    // Limit size
    if (this.bugs.length > this.maxBugs) {
      this.bugs.shift();
    }

    // Report to error reporter
    if (bug.stack || bug.message) {
      errorReporter.report(
        new Error(bug.message || 'Unknown error'),
        bug.component
      );
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(bugReport);
      } catch (e) {
        logger.error('Bug listener error:', e);
      }
    });

    // Log in development
    if (import.meta.env.DEV) {
      logger.warn('[Bug Finder]', bugReport);
    }
  }

  /**
   * Scan for bugs and generate report
   */
  scanBugs(): BugScanResult {
    const summary = {
      apiErrors: this.bugs.filter(b => b.type === 'api').length,
      fetchErrors: this.bugs.filter(b => b.type === 'fetch').length,
      edgeErrors: this.bugs.filter(b => b.type === 'edge').length,
      realtimeErrors: this.bugs.filter(b => b.type === 'realtime').length,
      promiseRejections: this.bugs.filter(b => b.type === 'promise').length,
      runtimeErrors: this.bugs.filter(b => b.type === 'runtime').length,
      notFoundErrors: this.bugs.filter(b => b.type === '404').length,
    };

    const critical = this.bugs.filter(b => b.severity === 'critical').length;
    const high = this.bugs.filter(b => b.severity === 'high').length;
    const medium = this.bugs.filter(b => b.severity === 'medium').length;
    const low = this.bugs.filter(b => b.severity === 'low').length;

    return {
      totalBugs: this.bugs.length,
      critical,
      high,
      medium,
      low,
      bugs: [...this.bugs].reverse(), // Most recent first
      summary,
    };
  }

  /**
   * Get bugs by type
   */
  getBugsByType(type: BugReport['type']): BugReport[] {
    return this.bugs.filter(b => b.type === type);
  }

  /**
   * Get bugs by severity
   */
  getBugsBySeverity(severity: BugReport['severity']): BugReport[] {
    return this.bugs.filter(b => b.severity === severity);
  }

  /**
   * Get recent bugs
   */
  getRecentBugs(count: number = 20): BugReport[] {
    return this.bugs.slice(-count).reverse();
  }

  /**
   * Clear all bugs
   */
  clearBugs() {
    this.bugs = [];
    this.apiErrors.clear();
    this.edgeFunctionErrors.clear();
  }

  /**
   * Subscribe to bug reports
   */
  onBugReport(callback: (bug: BugReport) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get API error statistics
   */
  getAPIErrorStats() {
    const stats: Record<string, { count: number; lastError?: BugReport }> = {};
    
    this.getBugsByType('api').forEach(bug => {
      const key = bug.url || 'unknown';
      if (!stats[key]) {
        stats[key] = { count: 0 };
      }
      stats[key].count++;
      stats[key].lastError = bug;
    });

    return stats;
  }

  /**
   * Get Edge Function error statistics
   */
  getEdgeFunctionErrorStats() {
    return Object.fromEntries(this.edgeFunctionErrors);
  }

  /**
   * Export bugs as JSON
   */
  exportBugs(): string {
    return JSON.stringify(this.scanBugs(), null, 2);
  }

  /**
   * Check for common issues
   */
  checkCommonIssues(): {
    issues: Array<{ type: string; message: string; severity: string }>;
    recommendations: string[];
  } {
    const issues: Array<{ type: string; message: string; severity: string }> = [];
    const recommendations: string[] = [];

    const scan = this.scanBugs();

    // Check for critical errors
    if (scan.critical > 0) {
      issues.push({
        type: 'critical',
        message: `${scan.critical} critical error(s) detected`,
        severity: 'critical',
      });
      recommendations.push('Investigate critical errors immediately');
    }

    // Check for high error rate
    if (scan.totalBugs > 50) {
      issues.push({
        type: 'error_rate',
        message: `High error rate: ${scan.totalBugs} errors detected`,
        severity: 'high',
      });
      recommendations.push('Review application stability and error handling');
    }

    // Check for API errors
    if (scan.summary.apiErrors > 10) {
      issues.push({
        type: 'api_errors',
        message: `${scan.summary.apiErrors} API errors detected`,
        severity: 'high',
      });
      recommendations.push('Check API endpoints and network connectivity');
    }

    // Check for 404s
    if (scan.summary.notFoundErrors > 5) {
      issues.push({
        type: '404_errors',
        message: `${scan.summary.notFoundErrors} 404 errors detected`,
        severity: 'medium',
      });
      recommendations.push('Fix broken links and missing routes');
    }

    // Check for realtime errors
    if (scan.summary.realtimeErrors > 10) {
      issues.push({
        type: 'realtime_errors',
        message: `${scan.summary.realtimeErrors} realtime subscription errors`,
        severity: 'medium',
      });
      recommendations.push('Review realtime subscriptions and connection handling');
    }

    // Check for promise rejections
    if (scan.summary.promiseRejections > 5) {
      issues.push({
        type: 'promise_rejections',
        message: `${scan.summary.promiseRejections} unhandled promise rejections`,
        severity: 'high',
      });
      recommendations.push('Add error handling to async operations');
    }

    return { issues, recommendations };
  }
}

export const bugFinder = new BugFinder();

// Export for use in components
export default bugFinder;


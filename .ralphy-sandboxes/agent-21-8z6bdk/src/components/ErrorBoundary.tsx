import { logger } from '@/lib/logger';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home, AlertTriangle, Copy, Check } from 'lucide-react';
import { analytics } from '@/utils/analytics';
import bugFinder from '@/utils/bugFinder';
import { errorReporter } from '@/utils/errorReporting';
import { clearAllCachesAndServiceWorkers, reloadWithCacheBypass } from '@/utils/serviceWorkerCache';

const MAX_AUTO_RETRIES = 2;
const AUTO_RETRY_DELAY_MS = 3000;

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallback?: ReactNode;
  title?: string;
  description?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isAutoRetrying: boolean;
  copied: boolean;
}

function isChunkLoadError(error: Error | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('chunk') ||
    msg.includes('loading module') ||
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch')
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private autoRetryTimer: ReturnType<typeof setTimeout> | null = null;

  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
    isAutoRetrying: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const retryCount = this.state.retryCount + 1;

    logger.error('ErrorBoundary caught an error', error, {
      component: 'ErrorBoundary',
      retryCount,
      url: window.location.href,
    });
    analytics.trackError('error_boundary', error.message);
    errorReporter.report(error, 'ErrorBoundary');

    const chunkError = isChunkLoadError(error);

    bugFinder.reportRuntimeError(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack,
      isChunkError: chunkError,
      retryCount,
    });

    this.props.onError?.(error, errorInfo);
    this.setState({ errorInfo, retryCount });

    // Auto-retry once for chunk loading errors (deployment-related)
    if (chunkError && retryCount <= MAX_AUTO_RETRIES) {
      this.scheduleAutoRetry();
    }
  }

  public componentWillUnmount() {
    if (this.autoRetryTimer) {
      clearTimeout(this.autoRetryTimer);
    }
  }

  private scheduleAutoRetry = () => {
    this.setState({ isAutoRetrying: true });
    this.autoRetryTimer = setTimeout(() => {
      this.autoRetryTimer = null;
      logger.info('Auto-retrying after error', {
        component: 'ErrorBoundary',
        retryCount: this.state.retryCount,
      });
      this.setState({ hasError: false, error: null, errorInfo: null, isAutoRetrying: false });
    }, AUTO_RETRY_DELAY_MS);
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isAutoRetrying: false,
    });
  };

  private handleClearCacheAndReload = async () => {
    try {
      logger.info('Clearing cache and reloading', { component: 'ErrorBoundary' });
      await clearAllCachesAndServiceWorkers();
      reloadWithCacheBypass();
    } catch (cacheError) {
      logger.error('Error clearing cache', cacheError, { component: 'ErrorBoundary' });
      reloadWithCacheBypass();
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const report = [
      `Error: ${error?.message ?? 'Unknown error'}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
      error?.stack ? `\nStack:\n${error.stack}` : '',
      errorInfo?.componentStack ? `\nComponent Stack:\n${errorInfo.componentStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      logger.warn('Failed to copy error to clipboard', { component: 'ErrorBoundary' });
    }
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, retryCount, isAutoRetrying, copied } = this.state;
    const chunkError = isChunkLoadError(error);
    const exhaustedRetries = retryCount > MAX_AUTO_RETRIES;

    const title =
      this.props.title ||
      (chunkError ? 'Connection Issue' : 'Oops! Something went wrong');

    const description =
      this.props.description ||
      (chunkError
        ? 'We had trouble loading the latest version of the app. This usually happens when a new update is deployed.'
        : 'We encountered an unexpected error. Don\'t worry, your data is safe.');

    return (
      <div
        className="min-h-dvh flex items-center justify-center p-4 bg-background"
        role="alert"
        aria-live="assertive"
      >
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              {chunkError ? (
                <AlertTriangle className="h-5 w-5 text-warning" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <CardTitle>{title}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-retry indicator */}
            {isAutoRetrying && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Retrying automatically...
                </p>
              </div>
            )}

            {/* Chunk error update notice */}
            {chunkError && !isAutoRetrying && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold mb-1">
                  Update Available
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {exhaustedRetries
                    ? 'Automatic recovery failed. Please clear your cache and reload.'
                    : 'Please clear your cache and reload to get the latest version.'}
                </p>
              </div>
            )}

            {/* Error details (non-chunk errors only) */}
            {error && !chunkError && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                  {error.message}
                </pre>
              </details>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {chunkError ? (
                <Button
                  onClick={this.handleClearCacheAndReload}
                  className="w-full"
                  disabled={isAutoRetrying}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Update & Reload
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={this.handleRetry} className="flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </div>
              )}

              {/* Copy error report */}
              {!isAutoRetrying && (
                <Button
                  onClick={this.handleCopyError}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-3 w-3" />
                      Copy error report
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

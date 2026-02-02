import { logger } from '@/lib/logger';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Home from "lucide-react/dist/esm/icons/home";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { analytics } from '@/utils/analytics';
import bugFinder from '@/utils/bugFinder';
import { clearAllCachesAndServiceWorkers, reloadWithCacheBypass } from '@/utils/serviceWorkerCache';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallback?: ReactNode;
  title?: string;
  description?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error', error, { component: 'ErrorBoundary' });
    analytics.trackError('error_boundary', error.message);

    // Detect chunk/module loading errors
    const isChunkError = error.message?.includes('chunk') ||
      error.message?.includes('Loading') ||
      error.message?.includes('createContext') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('dynamically imported module');

    // Report to bug finder
    bugFinder.reportRuntimeError(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack,
      isChunkError,
    });

    // Call onError callback if provided
    this.props.onError?.(error, errorInfo);

    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Try soft reset first - only reload if error persists
    setTimeout(() => {
      if (this.state.hasError) {
        window.location.reload();
      }
    }, 100);
  };

  private handleClearCacheAndReload = async () => {
    try {
      logger.info('Clearing cache and reloading', { component: 'ErrorBoundary' });
      await clearAllCachesAndServiceWorkers();
      reloadWithCacheBypass();
    } catch (error) {
      logger.error('Error clearing cache', error, { component: 'ErrorBoundary' });
      reloadWithCacheBypass();
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError = this.state.error?.message?.includes('chunk') ||
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Failed to fetch');

      const title = this.props.title || (isChunkError ? 'Connection Issue' : 'Oops! Something went wrong');
      const description = this.props.description || (isChunkError
        ? 'We had trouble loading the latest version of the app. This usually happens when a new update is deployed.'
        : 'We encountered an unexpected error. Don\'t worry, your data is safe.');

      return (
        <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                {isChunkError ? (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <CardTitle>{title}</CardTitle>
              </div>
              <CardDescription>
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && !isChunkError && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Error details
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              {isChunkError && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold mb-1">Update Available</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Please clear your cache and reload to get the latest version.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {isChunkError ? (
                  <Button onClick={this.handleClearCacheAndReload} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update & Reload
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={this.handleReset} className="flex-1">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reload
                    </Button>
                    <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                      <Home className="mr-2 h-4 w-4" />
                      Go Home
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

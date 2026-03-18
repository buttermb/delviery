import { logger } from '@/lib/logger';
import { Component, ReactNode, ErrorInfo } from 'react';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Home from "lucide-react/dist/esm/icons/home";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { errorReporter } from '@/utils/errorReporting';
import bugFinder from '@/utils/bugFinder';
import { clearAllCachesAndServiceWorkers, reloadWithCacheBypass } from '@/utils/serviceWorkerCache';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  routePath?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * RouteErrorBoundary Component
 *
 * A specialized error boundary for catching and handling errors in route content.
 * This wraps the <Outlet /> component in layouts to prevent route-level errors
 * from crashing the entire application.
 *
 * Features:
 * - Catches errors in child route components
 * - Provides user-friendly error messages
 * - Logs errors for debugging
 * - Offers recovery options (retry, go home, clear cache)
 * - Handles chunk loading errors gracefully
 *
 * @example
 * ```tsx
 * <RouteErrorBoundary routePath="/admin/orders">
 *   <Outlet />
 * </RouteErrorBoundary>
 * ```
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { routePath } = this.props;

    // Report error to error reporter
    errorReporter.report(error, `RouteErrorBoundary:${routePath}`);

    // Detect chunk/module loading errors specifically
    const isChunkError = error.message?.includes('chunk') ||
                        error.message?.includes('Loading') ||
                        error.message?.includes('createContext') ||
                        error.message?.includes('Failed to fetch') ||
                        error.message?.includes('dynamically imported module') ||
                        error.message?.includes('Failed to fetch dynamically imported module') ||
                        errorInfo.componentStack?.includes('chunk') ||
                        errorInfo.componentStack?.includes('lazy');

    // Also report to bug finder
    bugFinder.reportRuntimeError(error, 'RouteErrorBoundary', {
      routePath,
      componentStack: errorInfo.componentStack,
      isWebSocketError: error.message?.includes('WebSocket') ||
                       error.message?.includes('realtime') ||
                       error.message?.includes('connection'),
      isChunkError,
    });

    // Log error details for debugging
    logger.error('Route Error Boundary caught an error', error, {
      component: 'RouteErrorBoundary',
      routePath,
    });

    // Detect specific error types
    const isWebSocketError = error.message?.includes('WebSocket') ||
                             error.message?.includes('realtime') ||
                             error.message?.includes('connection');

    const isDataError = error.message?.includes('undefined') ||
                        error.message?.includes('null') ||
                        error.message?.includes('Cannot read');

    // Log error context
    logger.debug('Error context', {
      isWebSocketError,
      isDataError,
      isChunkError,
      errorType: error.name,
      stack: errorInfo?.componentStack,
      component: 'RouteErrorBoundary',
      routePath,
    });

    this.setState({
      error,
      errorInfo: errorInfo.componentStack || 'No stack trace available',
    });

    // Log WebSocket errors but don't auto-recover (prevents reload loops)
    if (isWebSocketError) {
      logger.warn('WebSocket error detected. Manual recovery required.', {
        component: 'RouteErrorBoundary',
        routePath,
      });
    }

    // Log chunk errors with recovery suggestion
    if (isChunkError) {
      logger.error('Chunk loading error detected in RouteErrorBoundary', error, {
        component: 'RouteErrorBoundary',
        routePath,
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleClearCacheAndReload = async () => {
    try {
      logger.info('Clearing cache and reloading', {
        component: 'RouteErrorBoundary',
        routePath: this.props.routePath,
      });

      // Clear all caches and service workers
      await clearAllCachesAndServiceWorkers();

      // Reload with cache bypass
      reloadWithCacheBypass();
    } catch (error) {
      logger.error('Error clearing cache', error, {
        component: 'RouteErrorBoundary',
      });
      // Fallback to simple reload
      reloadWithCacheBypass();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError = this.state.error?.message?.includes('chunk') ||
                          this.state.error?.message?.includes('dynamically imported module') ||
                          this.state.error?.message?.includes('Failed to fetch');

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                <CardTitle>Page Error</CardTitle>
              </div>
              <CardDescription>
                An error occurred while loading this page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
                  <p className="font-mono text-sm text-destructive font-semibold mb-2">
                    {this.state.error.message}
                  </p>
                  {isChunkError && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold mb-1">
                        Module Loading Error Detected
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        This usually happens when cached JavaScript files are outdated or the service worker is serving stale code.
                        Click "Clear Cache & Reload" to fix this issue.
                      </p>
                    </div>
                  )}
                  {import.meta.env.DEV && this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        View stack trace
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-48 text-muted-foreground">
                        {this.state.errorInfo}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Try refreshing the page, going back, or returning to the dashboard. If the problem persists,
                check the browser console for more details.
              </p>
            </CardContent>
            <CardFooter className="flex gap-2 flex-wrap">
              <Button onClick={this.handleReset} variant="outline" className="flex-1 min-w-[120px]">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleGoBack} variant="outline" className="flex-1 min-w-[120px]">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              {isChunkError && (
                <Button onClick={this.handleClearCacheAndReload} variant="destructive" className="flex-1 min-w-[120px]">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear Cache & Reload
                </Button>
              )}
              <Button onClick={() => window.location.href = '/'} className="flex-1 min-w-[120px]">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

import { logger } from '@/lib/logger';
import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { errorReporter } from '@/utils/errorReporting';
import bugFinder from '@/utils/bugFinder';
import { logger } from '@/utils/logger';
import { clearAllCachesAndServiceWorkers, reloadWithCacheBypass } from '@/utils/serviceWorkerCache';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
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
    // Report error to error reporter
    errorReporter.report(error, 'AdminErrorBoundary');
    
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
    bugFinder.reportRuntimeError(error, 'AdminErrorBoundary', {
      componentStack: errorInfo.componentStack,
      isWebSocketError: error.message?.includes('WebSocket') || 
                       error.message?.includes('realtime') ||
                       error.message?.includes('connection'),
      isChunkError,
    });
    
    // Log error details for debugging
    logger.error('Admin Error Boundary caught an error', error, { component: 'AdminErrorBoundary' });
    
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
      component: 'AdminErrorBoundary'
    });
    
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || 'No stack trace available',
    });
    
    // Log WebSocket errors but don't auto-recover (prevents reload loops)
    if (isWebSocketError) {
      logger.warn('WebSocket error detected. Manual recovery required.', { component: 'AdminErrorBoundary' });
    }
    
    // Log chunk errors with recovery suggestion
    if (isChunkError) {
      logger.error('Chunk loading error detected in AdminErrorBoundary', error, { component: 'AdminErrorBoundary' });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleClearCacheAndReload = async () => {
    try {
      logger.info('Clearing cache and reloading', { component: 'AdminErrorBoundary' });
      
      // Clear all caches and service workers
      await clearAllCachesAndServiceWorkers();
      
      // Reload with cache bypass
      reloadWithCacheBypass();
    } catch (error) {
      logger.error('Error clearing cache', error, { component: 'AdminErrorBoundary' });
      // Fallback to simple reload
      reloadWithCacheBypass();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                An error occurred while rendering this admin page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
                  <p className="font-mono text-sm text-destructive font-semibold mb-2">
                    {this.state.error.message}
                  </p>
                  {(this.state.error.message?.includes('chunk') || 
                     this.state.error.message?.includes('dynamically imported module') ||
                     this.state.error.message?.includes('Failed to fetch')) && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold mb-1">Module Loading Error Detected</p>
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
                Try refreshing the page or returning to the admin dashboard. If the problem persists,
                check the browser console for more details.
              </p>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={this.handleReset} variant="outline" className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              {(this.state.error?.message?.includes('chunk') || 
                 this.state.error?.message?.includes('dynamically imported module') ||
                 this.state.error?.message?.includes('Failed to fetch')) && (
                <Button onClick={this.handleClearCacheAndReload} variant="destructive" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear Cache & Reload
                </Button>
              )}
              <Button onClick={() => window.location.href = '/'} className="flex-1">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

interface ModuleErrorBoundaryProps {
  children: ReactNode;
  moduleName: string;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  copied: boolean;
}

/**
 * ModuleErrorBoundary - A React error boundary for admin modules
 *
 * Catches errors in admin modules and shows a friendly error state with retry button.
 * Logs errors with module context and displays toast notifications.
 *
 * Usage:
 * ```tsx
 * <ModuleErrorBoundary moduleName="Orders">
 *   <OrdersPage />
 * </ModuleErrorBoundary>
 * ```
 */
export class ModuleErrorBoundary extends Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ModuleErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { moduleName } = this.props;

    // Log error with module context
    logger.error(`Error in ${moduleName} module`, error, {
      module: moduleName,
      componentStack: errorInfo.componentStack,
    });

    // Show toast notification
    toast.error(`${moduleName} encountered an error`, {
      description: humanizeError(error, 'An unexpected error occurred'),
    });

    // Update state with error details
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || 'No stack trace available',
    });
  }

  handleRetry = (): void => {
    const { onRetry, moduleName } = this.props;

    logger.info(`Retrying ${moduleName} module`, { module: moduleName });

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });

    // Call custom retry handler if provided
    if (onRetry) {
      onRetry();
    }
  };

  handleCopyError = (): void => {
    const { error, errorInfo } = this.state;
    const { moduleName } = this.props;

    const errorText = [
      `Module: ${moduleName}`,
      `Error: ${error?.message || 'Unknown error'}`,
      errorInfo ? `\nStack trace:\n${errorInfo}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      toast.success('Error copied to clipboard');
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(() => {
      // Fallback: select text for manual copy
      toast.error('Failed to copy — try selecting the text manually');
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, copied } = this.state;
    const { children, moduleName, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      return (
        <div className="flex items-center justify-center p-6 min-h-[400px]">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-lg">{moduleName} Error</CardTitle>
              </div>
              <CardDescription>
                Something went wrong while loading the {moduleName} module
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 relative group">
                  <p className="font-mono text-sm text-destructive select-all pr-10">
                    {error.message || 'An unexpected error occurred'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-7 w-7 p-0 opacity-60 hover:opacity-100"
                    onClick={this.handleCopyError}
                    title="Copy error details"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  {errorInfo && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        View stack trace
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-40 text-muted-foreground whitespace-pre-wrap select-all">
                        {errorInfo}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Try clicking the retry button below. If the problem persists,
                refresh the page or contact support.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={this.handleRetry} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry {moduleName}
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return children;
  }
}

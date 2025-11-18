import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Mobile-optimized Error Boundary
 * Provides user-friendly error messages and recovery options
 */
export class MobileErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Mobile navigation error', error, {
      componentStack: errorInfo.componentStack,
      component: 'MobileErrorBoundary',
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    
    // Reload the page as a last resort
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur p-4">
          <div className="max-w-sm w-full bg-card border border-border rounded-lg p-6 shadow-lg">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">
                  We encountered an error loading the navigation. Try refreshing the page.
                </p>
              </div>

              <Button
                onClick={this.handleReset}
                className="w-full min-h-[48px]"
                size="lg"
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                Refresh Page
              </Button>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="w-full text-left mt-4">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    Error details
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

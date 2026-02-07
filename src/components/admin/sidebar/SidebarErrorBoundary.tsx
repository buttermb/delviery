import { logger } from '@/lib/logger';
/**
 * Sidebar Error Boundary
 * 
 * Catches errors in sidebar components and provides fallback UI
 * Prevents sidebar crashes from breaking the entire admin panel
 */

import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class SidebarErrorBoundary extends Component<Props, State> {
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Sidebar crashed', error, {
      component: 'SidebarErrorBoundary',
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-64 p-4 border-r bg-background">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sidebar Error</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="text-sm mb-4">
                The sidebar encountered an error. You can continue using the admin panel, but some features may be unavailable.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
            </AlertDescription>
          </Alert>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer font-semibold mb-2">
                Error Details (Dev Only)
              </summary>
              <pre className="bg-muted p-2 rounded overflow-auto max-h-40 text-xs">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

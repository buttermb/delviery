/**
 * WidgetErrorBoundary
 * Lightweight error boundary for individual dashboard widgets.
 * Catches errors in a single widget without taking down the entire grid.
 */

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface WidgetErrorBoundaryProps {
  children: ReactNode;
  widgetId: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  public state: WidgetErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<WidgetErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error(`Widget "${this.props.widgetId}" crashed`, error, {
      widgetId: this.props.widgetId,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 p-8 text-center">
          <AlertTriangle className="h-6 w-6 text-muted-foreground/60" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Widget failed to load
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground/60">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={this.handleRetry}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * AppCrashRecovery
 *
 * Top-level error boundary that catches unhandled React rendering errors.
 * Shows a crash screen with options to reload or clear cache.
 */

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ExternalLink } from 'lucide-react';

import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

function sanitizeErrorMessage(message: string): string {
  // Strip file paths, stack frames, and potentially sensitive data
  return message
    .replace(/https?:\/\/[^\s]+/g, '[url]')
    .replace(/at\s+\S+\s+\([^)]+\)/g, '')
    .replace(/\/[\w./\\-]+/g, '[path]')
    .slice(0, 200);
}

export class AppCrashRecovery extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: sanitizeErrorMessage(error.message || 'An unexpected error occurred'),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('AppCrashRecovery caught a rendering error', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage may be unavailable
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <CardTitle className="text-lg">Application Crashed</CardTitle>
            </div>
            <CardDescription>
              Something went wrong and the app could not recover automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {this.state.errorMessage && (
              <div className="rounded-lg bg-muted p-3 border">
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {this.state.errorMessage}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button onClick={this.handleReload} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Reload App
              </Button>
              <Button
                onClick={this.handleClearCacheAndReload}
                variant="outline"
                className="w-full gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear Cache & Reload
              </Button>
              <Button variant="ghost" className="w-full gap-2" asChild>
                <a
                  href="mailto:support@floraiq.com?subject=App Crash Report"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Report Issue
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

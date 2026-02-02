import { Component, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import LogIn from "lucide-react/dist/esm/icons/log-in";
import { clearAllAuthTokens, getLoginUrl } from '@/lib/utils/authHelpers';

interface AuthErrorBoundaryProps {
  children: ReactNode;
  userType?: 'super_admin' | 'tenant_admin' | 'customer';
  tenantSlug?: string;
}

interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isSessionExpired: boolean;
}

function isAuthError(error: Error): boolean {
  const authKeywords = [
    'token',
    'auth',
    'unauthorized',
    'expired',
    'session',
    'jwt',
    'credentials',
    'forbidden',
    '401',
    '403',
  ];
  const message = error.message.toLowerCase();
  return authKeywords.some((keyword) => message.includes(keyword));
}

function isSessionExpiredError(error: Error): boolean {
  const expiredKeywords = ['expired', 'session', 'token expired', 'jwt expired', 'refresh_token'];
  const message = error.message.toLowerCase();
  return expiredKeywords.some((keyword) => message.includes(keyword));
}

export class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, isSessionExpired: false };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return {
      hasError: true,
      error,
      isSessionExpired: isSessionExpiredError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('AuthErrorBoundary caught error', error, {
      component: 'AuthErrorBoundary',
      componentStack: errorInfo.componentStack,
      isAuthError: isAuthError(error),
      isSessionExpired: isSessionExpiredError(error),
      userType: this.props.userType,
    });

    if (isAuthError(error)) {
      clearAllAuthTokens();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isSessionExpired: false });
  };

  handleLoginRedirect = () => {
    clearAllAuthTokens();
    const userType = this.props.userType ?? 'tenant_admin';
    const loginUrl = getLoginUrl(userType, this.props.tenantSlug);
    window.location.href = loginUrl;
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { isSessionExpired, error } = this.state;

    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <CardTitle>
                {isSessionExpired ? 'Session Expired' : 'Authentication Error'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isSessionExpired
                ? 'Your session has expired. Please log in again to continue.'
                : 'We encountered an issue with your authentication. This may be caused by:'}
            </p>
            {!isSessionExpired && (
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>An expired session token</li>
                <li>Invalid credentials</li>
                <li>A change in account status</li>
                <li>Network connectivity issues</li>
              </ul>
            )}
            {error && (
              <details className="text-xs text-muted-foreground bg-muted p-2 rounded">
                <summary className="cursor-pointer">Technical details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-2 pt-4">
              {!isSessionExpired && (
                <Button onClick={this.handleRetry} variant="outline" className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
              <Button onClick={this.handleLoginRedirect} className="flex-1">
                <LogIn className="h-4 w-4 mr-2" />
                {isSessionExpired ? 'Log In' : 'Go to Login'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

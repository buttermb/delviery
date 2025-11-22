import { logger } from '@/lib/logger';
import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { clearAllAuthTokens } from "@/lib/utils/authHelpers";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
  userType?: "super_admin" | "tenant_admin" | "customer";
  tenantSlug?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Use logger utility for consistent error logging
    logger.error("Auth Error Boundary caught", error, { component: 'AuthErrorBoundary', errorInfo });
    
    // If it's an auth-related error, clear tokens
    if (
      error.message.includes("token") ||
      error.message.includes("auth") ||
      error.message.includes("unauthorized") ||
      error.message.includes("expired")
    ) {
      clearAllAuthTokens();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    clearAllAuthTokens();
    
    // Redirect to appropriate login
    if (this.props.userType === "super_admin") {
      window.location.href = "/super-admin/login";
    } else if (this.props.userType === "tenant_admin" && this.props.tenantSlug) {
      window.location.href = `/${this.props.tenantSlug}/admin/login`;
    } else if (this.props.userType === "customer" && this.props.tenantSlug) {
      window.location.href = `/${this.props.tenantSlug}/shop/login`;
    } else {
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <CardTitle>Authentication Error</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We encountered an error with your authentication session. This may be due to:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Expired session token</li>
                <li>Invalid credentials</li>
                <li>Account status change</li>
                <li>Network connectivity issues</li>
              </ul>
              {this.state.error && (
                <details className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  <summary className="cursor-pointer">Technical details</summary>
                  <pre className="mt-2 whitespace-pre-wrap">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <div className="flex gap-2 pt-4">
                <Button onClick={this.handleReset} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset & Login
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/">
                    <Home className="h-4 w-4 mr-2" />
                    Home
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}


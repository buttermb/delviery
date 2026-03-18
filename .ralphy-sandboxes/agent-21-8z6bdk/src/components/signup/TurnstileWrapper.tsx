import { logger } from '@/lib/logger';
import { Component } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface TurnstileWrapperProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onError: () => void;
  onExpire: () => void;
  turnstileRef: React.RefObject<unknown>;
}

interface TurnstileWrapperState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Error Boundary Wrapper for Turnstile CAPTCHA
 * Prevents CAPTCHA errors from crashing the entire form
 */
export class TurnstileWrapper extends Component<TurnstileWrapperProps, TurnstileWrapperState> {
  constructor(props: TurnstileWrapperProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): TurnstileWrapperState {
    return {
      hasError: true,
      errorMessage: error.message || 'CAPTCHA verification failed',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Turnstile CAPTCHA error', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Security verification is temporarily unavailable. You can proceed without verification.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Turnstile
        siteKey={this.props.siteKey}
        onSuccess={this.props.onSuccess}
        onError={this.props.onError}
        onExpire={this.props.onExpire}
        options={{
          theme: 'light',
          size: 'normal',
          action: 'signup',
          appearance: 'always',
        }}
        ref={this.props.turnstileRef as React.LegacyRef<unknown> as any}
      />
    );
  }
}

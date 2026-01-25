import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { Loader2, CheckCircle, XCircle, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

type VerificationStatus = 'loading' | 'success' | 'error' | 'already_verified';
type ErrorKind = 'expired' | 'invalid' | 'generic';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const { verifyEmail, isVerifying: isValidatingEmail } = useEmailVerification();

  const token = searchParams.get('token') || searchParams.get('token_hash');
  const type = searchParams.get('type') || 'email';

  const classifyError = useCallback((message: string): ErrorKind => {
    if (message.includes('expired') || message.includes('otp_expired')) {
      return 'expired';
    }
    if (
      message.includes('invalid') ||
      message.includes('invalid_grant') ||
      message.includes('already') ||
      message.includes('used')
    ) {
      return 'invalid';
    }
    return 'generic';
  }, []);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setErrorKind('generic');
        setErrorMessage('Missing verification token. Please check your email for the correct link.');
        logger.warn('[VerifyEmail] No token in URL params');
        return;
      }

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as 'email' | 'signup' | 'magiclink',
        });

        if (error) {
          const kind = classifyError(error.message);

          // Handle "already verified" scenario
          if (error.message.includes('already') || error.message.includes('used')) {
            setStatus('already_verified');
            logger.info('[VerifyEmail] Token already used / email already verified', {
              tokenPrefix: token.substring(0, 8),
            });
            return;
          }

          setStatus('error');
          setErrorKind(kind);
          setErrorMessage(
            kind === 'expired'
              ? 'This verification link has expired. Enter your email below to receive a new one.'
              : kind === 'invalid'
                ? 'This verification link is invalid or has already been used.'
                : error.message
          );

          logger.warn('[VerifyEmail] Verification failed', {
            tokenPrefix: token.substring(0, 8),
            type,
            errorCode: error.message,
          });
          return;
        }

        if (data.session || data.user) {
          setStatus('success');
          logger.info('[VerifyEmail] Email verified successfully', {
            userId: data.user?.id,
            tokenPrefix: token.substring(0, 8),
          });
        } else {
          // No session but no error - treat as already verified
          setStatus('already_verified');
          logger.info('[VerifyEmail] No session returned, email likely already verified');
        }
      } catch (err) {
        setStatus('error');
        setErrorKind('generic');
        setErrorMessage('An unexpected error occurred during verification. Please try again.');
        logger.error('[VerifyEmail] Unexpected error', err);
      }
    };

    verify();
  }, [token, type, classifyError]);

  const handleResend = async () => {
    if (!resendEmail || !resendEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsResending(true);

    try {
      // Just proceed with resend - the hook handles validation internally
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail,
      });

      if (error) {
        logger.error('[VerifyEmail] Resend failed', { email: resendEmail, error: error.message });
        toast.error(error.message);
      } else {
        setResendSuccess(true);
        toast.success('Verification email sent! Check your inbox.');
        logger.info('[VerifyEmail] Resend successful', { email: resendEmail });
      }
    } catch (err) {
      logger.error('[VerifyEmail] Resend error', { error: err });
      toast.error('Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
          {/* Loading State */}
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-teal-400 animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white mb-2">
                Verifying your email...
              </h1>
              <p className="text-slate-400">
                Please wait while we confirm your email address.
              </p>
            </>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white mb-2">
                Email Verified!
              </h1>
              <p className="text-slate-400 mb-6">
                Your email has been successfully verified. You can now log in to your account.
              </p>
              <Button
                onClick={() => navigate('/saas/login')}
                className="w-full bg-teal-500 hover:bg-teal-600"
              >
                Go to Login
              </Button>
            </>
          )}

          {/* Already Verified State */}
          {status === 'already_verified' && (
            <>
              <ShieldCheck className="h-12 w-12 text-teal-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white mb-2">
                Already Verified
              </h1>
              <p className="text-slate-400 mb-6">
                Your email has already been verified. You can log in to your account.
              </p>
              <Button
                onClick={() => navigate('/saas/login')}
                className="w-full bg-teal-500 hover:bg-teal-600"
              >
                Go to Login
              </Button>
            </>
          )}

          {/* Error State - Expired */}
          {status === 'error' && errorKind === 'expired' && !resendSuccess && (
            <>
              <XCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white mb-2">
                Link Expired
              </h1>
              <p className="text-slate-400 mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                />
                <Button
                  onClick={handleResend}
                  disabled={isResending || isValidatingEmail}
                  className="w-full bg-teal-500 hover:bg-teal-600"
                >
                  {isResending || isValidatingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/saas/login')}
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}

          {/* Error State - Invalid */}
          {status === 'error' && errorKind === 'invalid' && !resendSuccess && (
            <>
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white mb-2">
                Invalid Link
              </h1>
              <p className="text-slate-400 mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                />
                <Button
                  onClick={handleResend}
                  disabled={isResending || isValidatingEmail}
                  className="w-full bg-teal-500 hover:bg-teal-600"
                >
                  {isResending || isValidatingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Request New Link
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/saas/login')}
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}

          {/* Error State - Generic */}
          {status === 'error' && errorKind === 'generic' && !resendSuccess && (
            <>
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white mb-2">
                Verification Failed
              </h1>
              <p className="text-slate-400 mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                />
                <Button
                  onClick={handleResend}
                  disabled={isResending || isValidatingEmail}
                  className="w-full bg-teal-500 hover:bg-teal-600"
                >
                  {isResending || isValidatingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/saas/login')}
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}

          {/* Resend Success State */}
          {status === 'error' && resendSuccess && (
            <>
              <Mail className="h-12 w-12 text-teal-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white mb-2">
                Check Your Inbox
              </h1>
              <p className="text-slate-400 mb-6">
                We&apos;ve sent a new verification email to{' '}
                <span className="text-white font-medium">{resendEmail}</span>.
                Click the link in the email to verify your account.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/saas/login')}
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Back to Login
              </Button>
            </>
          )}
        </div>

        {/* Help text */}
        <p className="text-center text-slate-500 text-sm mt-4">
          Having trouble? Contact{' '}
          <a href="mailto:support@floraiqcrm.com" className="text-teal-400 hover:underline">
            support@floraiqcrm.com
          </a>
        </p>
      </div>
    </div>
  );
}

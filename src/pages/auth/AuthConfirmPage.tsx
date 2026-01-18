import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, RefreshCw, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

/**
 * Auth Confirm Page
 * 
 * This page handles email confirmation and magic link verification using token_hash.
 * It prevents "otp_expired" errors from email scanners that pre-fetch links.
 * 
 * Usage in Supabase Email Templates:
 * Confirm signup: https://floraiqcrm.com/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * Magic link: https://floraiqcrm.com/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
 */

type ErrorType = 'expired' | 'invalid' | 'generic';
type VerificationType = 'email' | 'signup' | 'recovery' | 'invite' | 'magiclink';

interface VerificationLog {
    timestamp: string;
    token_hash_prefix: string;
    type: VerificationType | string;
    success: boolean;
    error_code?: string;
    user_id?: string;
    redirect_target?: string;
}

export default function AuthConfirmPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorType, setErrorType] = useState<ErrorType>('generic');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [resendEmail, setResendEmail] = useState<string>('');
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as VerificationType | null;
    const next = searchParams.get('next') || '/';

    // Log verification outcomes for support visibility
    const logVerification = useCallback((log: VerificationLog) => {
        const logData = {
            ...log,
            user_agent: navigator.userAgent,
            referrer: document.referrer,
        };

        if (log.success) {
            logger.info('[AuthConfirm] Verification successful', logData);
        } else {
            logger.warn('[AuthConfirm] Verification failed', logData);
        }

        // Also log to console for debugging
        console.log('[AuthConfirm]', log.success ? 'SUCCESS' : 'FAILURE', logData);
    }, []);

    // Resend confirmation email
    const handleResendEmail = async () => {
        if (!resendEmail || !resendEmail.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }

        setIsResending(true);

        try {
            const { error } = await supabase.auth.resend({
                type: type === 'magiclink' ? 'signup' : 'signup',
                email: resendEmail,
            });

            if (error) {
                logger.error('[AuthConfirm] Resend failed', { email: resendEmail, error: error.message });
                toast.error(error.message);
            } else {
                logger.info('[AuthConfirm] Resend successful', { email: resendEmail });
                setResendSuccess(true);
                toast.success('Verification email sent! Check your inbox.');
            }
        } catch (err) {
            logger.error('[AuthConfirm] Resend error', { error: err });
            toast.error('Failed to resend email. Please try again.');
        } finally {
            setIsResending(false);
        }
    };

    useEffect(() => {
        const verifyToken = async () => {
            const tokenPrefix = tokenHash?.substring(0, 8) || 'none';

            if (!tokenHash || !type) {
                setStatus('error');
                setErrorType('generic');
                setErrorMessage('Missing verification parameters. Please request a new link.');
                logVerification({
                    timestamp: new Date().toISOString(),
                    token_hash_prefix: tokenPrefix,
                    type: type || 'unknown',
                    success: false,
                    error_code: 'missing_params',
                });
                return;
            }

            try {
                const { data, error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: type === 'email' ? 'email' : type,
                });

                if (error) {
                    setStatus('error');

                    // Determine error type for appropriate UI
                    if (error.message.includes('expired') || error.message.includes('otp_expired')) {
                        setErrorType('expired');
                        setErrorMessage('This link has expired. Enter your email below to receive a new one.');
                    } else if (
                        error.message.includes('invalid') ||
                        error.message.includes('invalid_grant') ||
                        error.message.includes('invalid_token')
                    ) {
                        setErrorType('invalid');
                        setErrorMessage('This link is invalid or has already been used.');
                    } else {
                        setErrorType('generic');
                        setErrorMessage(error.message);
                    }

                    logVerification({
                        timestamp: new Date().toISOString(),
                        token_hash_prefix: tokenPrefix,
                        type,
                        success: false,
                        error_code: error.message,
                    });
                    return;
                }

                if (data.session) {
                    setStatus('success');

                    // Determine redirect target based on user type
                    const userType = data.user?.user_metadata?.user_type;
                    const tenantSlug = data.user?.user_metadata?.tenant_slug;
                    let redirectTarget = next;

                    if (userType === 'super_admin') {
                        redirectTarget = '/super-admin/dashboard';
                    } else if (userType === 'tenant_admin') {
                        redirectTarget = tenantSlug ? `/${tenantSlug}/admin/dashboard` : next;
                    } else if (userType === 'customer') {
                        redirectTarget = tenantSlug ? `/${tenantSlug}/customer/account` : next;
                    }

                    logVerification({
                        timestamp: new Date().toISOString(),
                        token_hash_prefix: tokenPrefix,
                        type,
                        success: true,
                        user_id: data.user?.id,
                        redirect_target: redirectTarget,
                    });

                    // Short delay to show success message before redirecting
                    setTimeout(() => {
                        navigate(redirectTarget);
                    }, 1500);
                } else {
                    setStatus('error');
                    setErrorType('generic');
                    setErrorMessage('Verification completed but no session was created. Please try logging in.');

                    logVerification({
                        timestamp: new Date().toISOString(),
                        token_hash_prefix: tokenPrefix,
                        type,
                        success: false,
                        error_code: 'no_session',
                    });
                }
            } catch (err) {
                setStatus('error');
                setErrorType('generic');
                setErrorMessage('An unexpected error occurred. Please try again.');

                logVerification({
                    timestamp: new Date().toISOString(),
                    token_hash_prefix: tokenPrefix,
                    type: type || 'unknown',
                    success: false,
                    error_code: err instanceof Error ? err.message : 'unknown_error',
                });
            }
        };

        verifyToken();
    }, [tokenHash, type, navigate, next, logVerification]);

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
                                Please wait while we confirm your identity.
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
                            <p className="text-slate-400">
                                Redirecting you to your dashboard...
                            </p>
                        </>
                    )}

                    {/* Error State - Expired Link */}
                    {status === 'error' && errorType === 'expired' && !resendSuccess && (
                        <>
                            <RefreshCw className="h-12 w-12 text-amber-400 mx-auto mb-4" />
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
                                    onClick={handleResendEmail}
                                    disabled={isResending}
                                    className="w-full bg-teal-500 hover:bg-teal-600"
                                >
                                    {isResending ? (
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
                                We've sent a new verification email to <span className="text-white font-medium">{resendEmail}</span>.
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

                    {/* Error State - Invalid Link */}
                    {status === 'error' && errorType === 'invalid' && (
                        <>
                            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                            <h1 className="text-xl font-semibold text-white mb-2">
                                Invalid Link
                            </h1>
                            <p className="text-slate-400 mb-6">
                                {errorMessage}
                            </p>
                            <div className="space-y-3">
                                <Button
                                    onClick={() => navigate('/signup')}
                                    className="w-full bg-teal-500 hover:bg-teal-600"
                                >
                                    Request New Link
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
                    {status === 'error' && errorType === 'generic' && !resendSuccess && (
                        <>
                            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                            <h1 className="text-xl font-semibold text-white mb-2">
                                Verification Failed
                            </h1>
                            <p className="text-slate-400 mb-6">
                                {errorMessage}
                            </p>
                            <div className="space-y-3">
                                <Button
                                    onClick={() => navigate('/signup')}
                                    className="w-full bg-teal-500 hover:bg-teal-600"
                                >
                                    Request New Link
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/')}
                                    className="w-full border-white/20 text-white hover:bg-white/10"
                                >
                                    Go to Home
                                </Button>
                            </div>
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

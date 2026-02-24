import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
    Loader2,
    CheckCircle,
    XCircle,
    RefreshCw,
    Mail,
    Key,
    UserPlus,
    ShieldCheck,
    AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';

/**
 * Auth Confirm Page
 *
 * This page handles various email confirmations and token verification using token_hash.
 * It prevents "otp_expired" errors from email scanners that pre-fetch links.
 *
 * Supported confirmation types:
 * - email: Email verification after signup
 * - signup: Alternative signup confirmation
 * - recovery: Password reset confirmation (redirects to password change)
 * - invite: Team/organization invitation acceptance
 * - magiclink: Magic link passwordless login
 * - email_change: Email address change confirmation
 *
 * Usage in Supabase Email Templates:
 * Confirm signup: https://floraiqcrm.com/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * Magic link: https://floraiqcrm.com/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
 * Password recovery: https://floraiqcrm.com/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
 * Email change: https://floraiqcrm.com/auth/confirm?token_hash={{ .TokenHash }}&type=email_change
 */

type ErrorType = 'expired' | 'invalid' | 'generic' | 'already_confirmed';
type VerificationType = 'email' | 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change';

interface VerificationLog {
    timestamp: string;
    token_hash_prefix: string;
    type: VerificationType | string;
    success: boolean;
    error_code?: string;
    user_id?: string;
    redirect_target?: string;
}

interface ConfirmationConfig {
    title: string;
    message: string;
    icon: React.ReactNode;
    loadingMessage: string;
}

const CONFIRMATION_CONFIG: Record<VerificationType, ConfirmationConfig> = {
    email: {
        title: 'Email Verified!',
        message: 'Your email has been confirmed. Redirecting you to your dashboard...',
        icon: <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />,
        loadingMessage: 'Verifying your email...',
    },
    signup: {
        title: 'Account Confirmed!',
        message: 'Your account is now active. Redirecting you to your dashboard...',
        icon: <UserPlus className="h-12 w-12 text-green-400 mx-auto mb-4" />,
        loadingMessage: 'Confirming your account...',
    },
    recovery: {
        title: 'Identity Verified!',
        message: 'Redirecting you to set a new password...',
        icon: <Key className="h-12 w-12 text-green-400 mx-auto mb-4" />,
        loadingMessage: 'Verifying your identity...',
    },
    invite: {
        title: 'Invitation Accepted!',
        message: 'Welcome to the team! Redirecting you to your dashboard...',
        icon: <UserPlus className="h-12 w-12 text-green-400 mx-auto mb-4" />,
        loadingMessage: 'Processing your invitation...',
    },
    magiclink: {
        title: 'Signed In!',
        message: 'You have been securely signed in. Redirecting...',
        icon: <ShieldCheck className="h-12 w-12 text-green-400 mx-auto mb-4" />,
        loadingMessage: 'Signing you in...',
    },
    email_change: {
        title: 'Email Updated!',
        message: 'Your email address has been changed successfully.',
        icon: <Mail className="h-12 w-12 text-green-400 mx-auto mb-4" />,
        loadingMessage: 'Updating your email address...',
    },
};

export default function AuthConfirmPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorType, setErrorType] = useState<ErrorType>('generic');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [resendEmail, setResendEmail] = useState<string>('');
    const [isResending, setIsResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [verifiedType, setVerifiedType] = useState<VerificationType | null>(null);

    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as VerificationType | null;
    const next = searchParams.get('next') || '/';

    // Get configuration for the current verification type
    const config = type && CONFIRMATION_CONFIG[type] ? CONFIRMATION_CONFIG[type] : CONFIRMATION_CONFIG.email;

    // Validate if the type is a supported verification type
    const isValidType = (t: string | null): t is VerificationType => {
        return t !== null && Object.keys(CONFIRMATION_CONFIG).includes(t);
    };

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

        logger.debug('[AuthConfirm]', { success: log.success, ...logData });
    }, []);

    // Determine the appropriate resend type based on verification type
    const getResendType = useCallback((): 'signup' | 'email_change' => {
        if (type === 'email_change') return 'email_change';
        return 'signup';
    }, [type]);

    // Resend confirmation email
    const handleResendEmail = async () => {
        if (!resendEmail || !resendEmail.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }

        setIsResending(true);

        try {
            const resendType = getResendType();
            const { error } = await supabase.auth.resend({
                type: resendType,
                email: resendEmail,
            });

            if (error) {
                logger.error('[AuthConfirm] Resend failed', { email: resendEmail, error: error.message, type: resendType });
                toast.error('Failed to resend verification email', { description: humanizeError(error) });
            } else {
                logger.info('[AuthConfirm] Resend successful', { email: resendEmail, type: resendType });
                setResendSuccess(true);
                toast.success('Verification email sent! Check your inbox.');
            }
        } catch (err) {
            logger.error('[AuthConfirm] Resend error', { error: err });
            toast.error('Failed to resend email', { description: humanizeError(err) });
        } finally {
            setIsResending(false);
        }
    };

    // Handle password reset request
    const handleRequestPasswordReset = async () => {
        if (!resendEmail || !resendEmail.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }

        setIsResending(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
                redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
            });

            if (error) {
                logger.error('[AuthConfirm] Password reset request failed', { email: resendEmail, error: error.message });
                toast.error('Failed to send password reset email', { description: humanizeError(error) });
            } else {
                logger.info('[AuthConfirm] Password reset request sent', { email: resendEmail });
                setResendSuccess(true);
                toast.success('Password reset email sent! Check your inbox.');
            }
        } catch (err) {
            logger.error('[AuthConfirm] Password reset request error', { error: err });
            toast.error('Failed to send password reset email', { description: humanizeError(err) });
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

            // Validate the type parameter
            if (!isValidType(type)) {
                setStatus('error');
                setErrorType('invalid');
                setErrorMessage(`Unknown verification type: ${type}. Please request a new link.`);
                logVerification({
                    timestamp: new Date().toISOString(),
                    token_hash_prefix: tokenPrefix,
                    type,
                    success: false,
                    error_code: 'invalid_type',
                });
                return;
            }

            try {
                // Map our custom types to Supabase OTP types
                const otpType = type === 'email_change' ? 'email_change' : type;

                const { data, error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: otpType,
                });

                if (error) {
                    setStatus('error');

                    // Determine error type for appropriate UI
                    if (error.message.includes('expired') || error.message.includes('otp_expired')) {
                        setErrorType('expired');
                        if (type === 'recovery') {
                            setErrorMessage('This password reset link has expired. Enter your email below to receive a new one.');
                        } else if (type === 'invite') {
                            setErrorMessage('This invitation link has expired. Please contact your administrator for a new invitation.');
                        } else if (type === 'email_change') {
                            setErrorMessage('This email change link has expired. Please request a new email change from your settings.');
                        } else {
                            setErrorMessage('This link has expired. Enter your email below to receive a new one.');
                        }
                    } else if (
                        error.message.includes('invalid') ||
                        error.message.includes('invalid_grant') ||
                        error.message.includes('invalid_token')
                    ) {
                        setErrorType('invalid');
                        if (error.message.includes('already') || error.message.includes('used')) {
                            setErrorType('already_confirmed');
                            setErrorMessage('This link has already been used. You may already be verified.');
                        } else {
                            setErrorMessage('This link is invalid or has already been used.');
                        }
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

                if (data.session || data.user) {
                    setStatus('success');
                    setVerifiedType(type);

                    // Determine redirect target based on verification type and user metadata
                    const userType = data.user?.user_metadata?.user_type;
                    const tenantSlug = data.user?.user_metadata?.tenant_slug;
                    let redirectTarget = next;

                    // Handle different verification types
                    if (type === 'recovery') {
                        // For password recovery, redirect to change password page
                        redirectTarget = '/auth/secure-account';
                        logger.info('[AuthConfirm] Recovery verified, redirecting to secure account page');
                    } else if (type === 'email_change') {
                        // For email change, redirect to account settings
                        if (userType === 'super_admin') {
                            redirectTarget = '/super-admin/settings';
                        } else if (userType === 'tenant_admin' && tenantSlug) {
                            redirectTarget = `/${tenantSlug}/admin/settings`;
                        } else if (userType === 'customer' && tenantSlug) {
                            redirectTarget = `/${tenantSlug}/customer/settings`;
                        } else {
                            redirectTarget = '/';
                        }
                    } else if (type === 'invite') {
                        // For invites, redirect to the appropriate dashboard
                        if (userType === 'super_admin') {
                            redirectTarget = '/super-admin/dashboard';
                        } else if (userType === 'tenant_admin' && tenantSlug) {
                            redirectTarget = `/${tenantSlug}/admin/dashboard`;
                        } else if (tenantSlug) {
                            redirectTarget = `/${tenantSlug}/admin/dashboard`;
                        } else {
                            redirectTarget = next;
                        }
                    } else {
                        // Default redirect logic for email, signup, magiclink
                        if (userType === 'super_admin') {
                            redirectTarget = '/super-admin/dashboard';
                        } else if (userType === 'tenant_admin') {
                            redirectTarget = tenantSlug ? `/${tenantSlug}/admin/dashboard` : next;
                        } else if (userType === 'customer') {
                            redirectTarget = tenantSlug ? `/${tenantSlug}/customer/account` : next;
                        }
                    }

                    logVerification({
                        timestamp: new Date().toISOString(),
                        token_hash_prefix: tokenPrefix,
                        type,
                        success: true,
                        user_id: data.user?.id,
                        redirect_target: redirectTarget,
                    });

                    // Different delay for different types
                    const redirectDelay = type === 'recovery' ? 2000 : 1500;
                    setTimeout(() => {
                        navigate(redirectTarget);
                    }, redirectDelay);
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

    // Get the appropriate resend button label based on type
    const getResendButtonLabel = () => {
        if (type === 'recovery') return 'Send Password Reset Email';
        if (type === 'email_change') return 'Resend Email Change Link';
        if (type === 'invite') return 'Contact Administrator';
        return 'Resend Verification Email';
    };

    // Get the success configuration based on verified type
    const getSuccessConfig = () => {
        if (verifiedType && CONFIRMATION_CONFIG[verifiedType]) {
            return CONFIRMATION_CONFIG[verifiedType];
        }
        return CONFIRMATION_CONFIG.email;
    };

    // Determine if we should show the resend form for this error type
    const showResendForm = () => {
        if (type === 'invite') return false; // Invites need admin action
        return errorType === 'expired';
    };

    return (
        <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="max-w-md w-full mx-4">
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
                    {/* Loading State */}
                    {status === 'loading' && (
                        <>
                            <Loader2 className="h-12 w-12 text-teal-400 animate-spin mx-auto mb-4" />
                            <h1 className="text-xl font-semibold text-white mb-2">
                                {config.loadingMessage}
                            </h1>
                            <p className="text-slate-400">
                                Please wait while we confirm your identity.
                            </p>
                        </>
                    )}

                    {/* Success State - Dynamic based on verification type */}
                    {status === 'success' && (
                        <>
                            {getSuccessConfig().icon}
                            <h1 className="text-xl font-semibold text-white mb-2">
                                {getSuccessConfig().title}
                            </h1>
                            <p className="text-slate-400">
                                {getSuccessConfig().message}
                            </p>
                            {verifiedType === 'recovery' && (
                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <p className="text-blue-300 text-sm">
                                        You'll be able to set a new password on the next page.
                                    </p>
                                </div>
                            )}
                            {verifiedType === 'invite' && (
                                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                    <p className="text-green-300 text-sm">
                                        You now have access to your organization's dashboard.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Error State - Expired Link */}
                    {status === 'error' && errorType === 'expired' && !resendSuccess && (
                        <>
                            <RefreshCw className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                            <h1 className="text-xl font-semibold text-white mb-2">
                                {type === 'recovery' ? 'Reset Link Expired' : type === 'invite' ? 'Invitation Expired' : 'Link Expired'}
                            </h1>
                            <p className="text-slate-400 mb-6">
                                {errorMessage}
                            </p>
                            {showResendForm() ? (
                                <div className="space-y-3">
                                    <Input
                                        type="email"
                                        placeholder="Enter your email address"
                                        value={resendEmail}
                                        onChange={(e) => setResendEmail(e.target.value)}
                                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                                    />
                                    <Button
                                        onClick={type === 'recovery' ? handleRequestPasswordReset : handleResendEmail}
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
                                                {type === 'recovery' ? <Key className="h-4 w-4 mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                                                {getResendButtonLabel()}
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
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-amber-300 text-sm">
                                        Please contact your administrator to receive a new invitation.
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate('/saas/login')}
                                        className="w-full border-white/20 text-white hover:bg-white/10"
                                    >
                                        Back to Login
                                    </Button>
                                </div>
                            )}
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
                                We've sent a new {type === 'recovery' ? 'password reset' : 'verification'} email to{' '}
                                <span className="text-white font-medium">{resendEmail}</span>.
                                {type === 'recovery'
                                    ? ' Click the link in the email to reset your password.'
                                    : ' Click the link in the email to verify your account.'}
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

                    {/* Error State - Already Confirmed */}
                    {status === 'error' && errorType === 'already_confirmed' && !resendSuccess && (
                        <>
                            <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                            <h1 className="text-xl font-semibold text-white mb-2">
                                Already Verified
                            </h1>
                            <p className="text-slate-400 mb-6">
                                {errorMessage}
                            </p>
                            <div className="space-y-3">
                                <Button
                                    onClick={() => navigate('/saas/login')}
                                    className="w-full bg-teal-500 hover:bg-teal-600"
                                >
                                    Continue to Login
                                </Button>
                            </div>
                        </>
                    )}

                    {/* Error State - Invalid Link */}
                    {status === 'error' && errorType === 'invalid' && !resendSuccess && (
                        <>
                            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                            <h1 className="text-xl font-semibold text-white mb-2">
                                Invalid Link
                            </h1>
                            <p className="text-slate-400 mb-6">
                                {errorMessage}
                            </p>
                            <div className="space-y-3">
                                {type === 'recovery' ? (
                                    <>
                                        <Input
                                            type="email"
                                            placeholder="Enter your email address"
                                            value={resendEmail}
                                            onChange={(e) => setResendEmail(e.target.value)}
                                            className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                                        />
                                        <Button
                                            onClick={handleRequestPasswordReset}
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
                                                    <Key className="h-4 w-4 mr-2" />
                                                    Request New Reset Link
                                                </>
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={() => navigate('/signup')}
                                        className="w-full bg-teal-500 hover:bg-teal-600"
                                    >
                                        Request New Link
                                    </Button>
                                )}
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
                                {type === 'recovery' ? (
                                    <>
                                        <Input
                                            type="email"
                                            placeholder="Enter your email to try again"
                                            value={resendEmail}
                                            onChange={(e) => setResendEmail(e.target.value)}
                                            className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                                        />
                                        <Button
                                            onClick={handleRequestPasswordReset}
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
                                                    <Key className="h-4 w-4 mr-2" />
                                                    Request Password Reset
                                                </>
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={() => navigate('/signup')}
                                        className="w-full bg-teal-500 hover:bg-teal-600"
                                    >
                                        Request New Link
                                    </Button>
                                )}
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

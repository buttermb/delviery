import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Auth Confirm Page
 * 
 * This page handles email confirmation and magic link verification using token_hash.
 * It prevents "otp_expired" errors from email scanners that pre-fetch links.
 * 
 * Usage in Supabase Email Templates:
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export default function AuthConfirmPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as 'email' | 'signup' | 'recovery' | 'invite' | 'magiclink' | null;
    const next = searchParams.get('next') || '/';

    useEffect(() => {
        const verifyToken = async () => {
            if (!tokenHash || !type) {
                setStatus('error');
                setErrorMessage('Missing verification parameters. Please request a new link.');
                return;
            }

            try {
                const { data, error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: type === 'email' ? 'email' : type,
                });

                if (error) {
                    console.error('[AuthConfirm] Verification error:', error);
                    setStatus('error');

                    if (error.message.includes('expired')) {
                        setErrorMessage('This link has expired. Please request a new one.');
                    } else if (error.message.includes('invalid')) {
                        setErrorMessage('This link is invalid or has already been used.');
                    } else {
                        setErrorMessage(error.message);
                    }
                    return;
                }

                if (data.session) {
                    console.log('[AuthConfirm] Verification successful, user:', data.user?.email);
                    setStatus('success');

                    // Short delay to show success message before redirecting
                    setTimeout(() => {
                        // Determine redirect based on user type or default to next param
                        const userType = data.user?.user_metadata?.user_type;

                        if (userType === 'super_admin') {
                            navigate('/super-admin/dashboard');
                        } else if (userType === 'tenant_admin') {
                            const tenantSlug = data.user?.user_metadata?.tenant_slug;
                            navigate(tenantSlug ? `/${tenantSlug}/admin/dashboard` : next);
                        } else if (userType === 'customer') {
                            const tenantSlug = data.user?.user_metadata?.tenant_slug;
                            navigate(tenantSlug ? `/${tenantSlug}/customer/account` : next);
                        } else {
                            navigate(next);
                        }
                    }, 1500);
                } else {
                    setStatus('error');
                    setErrorMessage('Verification completed but no session was created. Please try logging in.');
                }
            } catch (err) {
                console.error('[AuthConfirm] Unexpected error:', err);
                setStatus('error');
                setErrorMessage('An unexpected error occurred. Please try again.');
            }
        };

        verifyToken();
    }, [tokenHash, type, navigate, next]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="max-w-md w-full mx-4">
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
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

                    {status === 'error' && (
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
            </div>
        </div>
    );
}

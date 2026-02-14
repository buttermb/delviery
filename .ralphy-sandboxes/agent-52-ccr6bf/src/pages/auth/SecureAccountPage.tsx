import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { logger } from '@/lib/logger';

type SecureStatus = 'loading' | 'success' | 'error' | 'expired';

export function SecureAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SecureStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No security token provided.');
      return;
    }

    const secureAccount = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('secure-account', {
          body: { action: 'secure', token },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data?.success) {
          setStatus('success');
        } else {
          setStatus(data?.error?.includes('expired') ? 'expired' : 'error');
          setErrorMessage(data?.error || 'Failed to secure account');
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error securing account:', error);
        setStatus('error');
        setErrorMessage(message);
      }
    };

    secureAccount();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'loading' && <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />}
            {status === 'success' && <ShieldCheck className="h-12 w-12 text-green-600" />}
            {status === 'error' && <XCircle className="h-12 w-12 text-red-600" />}
            {status === 'expired' && <AlertTriangle className="h-12 w-12 text-yellow-600" />}
          </div>
          <CardTitle>
            {status === 'loading' && 'Securing Your Account...'}
            {status === 'success' && 'Account Secured'}
            {status === 'error' && 'Security Action Failed'}
            {status === 'expired' && 'Link Expired'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we secure your account.'}
            {status === 'success' && 'Your account has been secured successfully.'}
            {status === 'error' && errorMessage}
            {status === 'expired' && 'This security link has expired. Please sign in and check your account settings.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium">All sessions have been terminated</p>
                    <p className="mt-1">The suspicious device has been removed from your trusted devices.</p>
                  </div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    We recommend changing your password immediately for additional security.
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Sign In & Change Password
              </Button>
            </div>
          )}

          {(status === 'error' || status === 'expired') && (
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Go to Sign In
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                If you continue to have concerns about your account security,
                please contact support.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

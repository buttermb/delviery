/**
 * Email Verification Page
 * Verifies tenant user email after signup
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    if (location.state) {
      setEmail(location.state.email || '');
      setTenantId(location.state.tenantId || '');
    }
  }, [location]);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter the 6-digit verification code',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      // Verify email with Supabase
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (error) throw error;

      if (data.user) {
        // Update tenant user to active
        if (tenantId) {
          await supabase
            .from('tenant_users')
            .update({
              status: 'active',
              email_verified: true,
              accepted_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId)
            .eq('email', email);
        }

        toast({
          title: 'Email Verified!',
          description: 'Your account has been activated',
        });

        navigate('/saas/onboarding');
      }
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid verification code',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'email',
        email,
      });

      if (error) throw error;

      toast({
        title: 'Code Resent',
        description: 'Check your email for the new verification code',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to Resend',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Verify Your Email</h1>
          <p className="text-muted-foreground">
            We sent a 6-digit code to
          </p>
          <p className="font-medium">{email || 'your email'}</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          <Button
            onClick={handleVerify}
            disabled={isVerifying || code.length !== 6}
            className="w-full"
            size="lg"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Verify Email
              </>
            )}
          </Button>

          <div className="text-center">
            <Button
              variant="link"
              onClick={handleResend}
              className="text-sm"
            >
              Didn't receive the code? Resend
            </Button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Check your spam folder</p>
              <p>If you don't see the email, it may have been filtered to spam.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}


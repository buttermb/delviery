import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package, Lock, ArrowLeft } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { clientEncryption } from '@/lib/encryption/clientEncryption';
import { useCsrfToken } from '@/hooks/useCsrfToken';

export default function CourierLoginPage() {
  useAuthRedirect(); // Auto-redirect if already logged in
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | 'pin'>('credentials');
  const [courierId, setCourierId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { validateToken } = useCsrfToken();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateToken()) {
      toast({
        title: 'Security Error',
        description: 'Invalid security token. Please refresh the page and try again.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Initialize encryption after successful auth (before PIN step)
      try {
        if (authData.user?.id) {
          sessionStorage.setItem('floraiq_user_id', authData.user.id);
          localStorage.setItem('floraiq_user_id', authData.user.id);
          await clientEncryption.initialize(password, authData.user.id);
          logger.debug('Encryption initialized successfully', { component: 'CourierLoginPage' });
        }
      } catch (encryptionError) {
        // Log but don't block login - encryption is optional for now
        logger.warn('Encryption initialization failed', encryptionError instanceof Error ? encryptionError : new Error(String(encryptionError)), { component: 'CourierLoginPage' });
      }

      // Clear password from memory (best effort)
      setPassword('');

      // Check if user is a courier or runner
      const { data: courierData } = await supabase
        .from('couriers')
        .select('id, is_active, admin_pin')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (courierData && courierData.is_active) {
        if (!courierData.admin_pin) {
          toast({
            title: "PIN Not Set",
            description: "Please contact admin to set up your PIN.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }
        setCourierId(courierData.id);
        setStep('pin');
        toast({
          title: "Enter Your PIN",
          description: "Enter your 6-digit PIN to continue",
        });
        return;
      }

      // Check if user is a runner
      const { data: runnerData } = await supabase
        .from('wholesale_runners')
        .select('id, status, admin_pin')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (runnerData && runnerData.status === 'active') {
        if (!runnerData.admin_pin) {
          toast({
            title: "PIN Not Set",
            description: "Please contact admin to set up your PIN.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }
        setCourierId(runnerData.id);
        setStep('pin');
        toast({
          title: "Enter Your PIN",
          description: "Enter your 6-digit PIN to continue",
        });
        return;
      }

      // Not authorized
      await supabase.auth.signOut();
      throw new Error('Not authorized as a courier or runner');
    } catch (error: any) {
      logger.error('Login error', error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePinVerification = async () => {
    if (pin.length !== 6) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be 6 digits",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Verify PIN using the database function
      const { data, error } = await supabase.rpc('verify_admin_pin', {
        courier_user_id: user.id,
        pin: pin
      });

      if (error) throw error;

      if (!data) {
        throw new Error('Invalid PIN');
      }

      // Create session token
      const { data: sessionData, error: sessionError } = await supabase.rpc(
        'create_courier_pin_session',
        { p_courier_id: courierId }
      );

      if (sessionError) throw sessionError;

      // Store session token
      localStorage.setItem('courier_pin_session', sessionData);

      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });

      navigate('/courier/dashboard');
    } catch (error: any) {
      logger.error('PIN verification error', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid PIN",
        variant: "destructive",
      });
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'pin') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Enter Your PIN</CardTitle>
            <CardDescription>
              Enter your 6-digit security PIN to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={pin}
                onChange={setPin}
                onComplete={handlePinVerification}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handlePinVerification}
                disabled={loading || pin.length !== 6}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify PIN
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setStep('credentials');
                  setPin('');
                  setCourierId(null);
                }}
                className="w-full"
              >
                Back
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Forgot your PIN? Contact admin for reset.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Courier Login</CardTitle>
          <CardDescription>
            Sign in to access your delivery dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="courier@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                enterKeyHint="done"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </form>

          <div className="mt-6 space-y-3">
            <div className="text-center text-sm text-muted-foreground">
              <p>Need help? Contact your administrator</p>
            </div>
            <div className="text-center">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login Directory
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

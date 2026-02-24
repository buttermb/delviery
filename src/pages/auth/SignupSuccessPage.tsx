import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ForceLightMode } from '@/components/marketing/ForceLightMode';
import { SEOHead } from '@/components/SEOHead';
import {
  Mail,
  Loader2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Rocket,
  BookOpen,
  Users,
  Settings,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import FloraIQLogo from '@/components/FloraIQLogo';

const RESEND_COOLDOWN_SECONDS = 60;
const SESSION_POLL_INTERVAL_MS = 5000;

interface LocationState {
  email?: string;
}

export function SignupSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const email = state?.email || '';

  const [isResending, setIsResending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start cooldown timer
  const startCooldown = useCallback(() => {
    setCooldownRemaining(RESEND_COOLDOWN_SECONDS);

    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Poll for session to detect email verification
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          logger.info('[SignupSuccess] Email verified, redirecting', {
            userId: session.user.id,
          });

          // Determine redirect based on user metadata
          const userType = session.user.user_metadata?.user_type;
          const tenantSlug = session.user.user_metadata?.tenant_slug;

          if (userType === 'super_admin') {
            navigate('/super-admin/dashboard', { replace: true });
          } else if (tenantSlug) {
            navigate(`/${tenantSlug}/admin/dashboard?welcome=true`, { replace: true });
          } else {
            navigate('/saas/login', { replace: true });
          }
        }
      } catch (error) {
        logger.debug('[SignupSuccess] Session check error', { error });
      }
    };

    // Initial check
    checkSession();

    // Poll every 5 seconds
    pollIntervalRef.current = setInterval(checkSession, SESSION_POLL_INTERVAL_MS);

    // Listen for auth state changes (e.g., if user verifies in same browser tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        logger.info('[SignupSuccess] Auth state change: verified', {
          userId: session.user.id,
        });
        const tenantSlug = session.user.user_metadata?.tenant_slug;
        if (tenantSlug) {
          navigate(`/${tenantSlug}/admin/dashboard?welcome=true`, { replace: true });
        } else {
          navigate('/saas/login', { replace: true });
        }
      }
    });

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Cleanup cooldown interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Email Unknown', {
        description: 'Unable to resend verification. Please try signing up again.',
      });
      return;
    }

    if (cooldownRemaining > 0) {
      return;
    }

    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        logger.error('[SignupSuccess] Resend failed', { email, error: error.message });
        toast.error('Failed to Resend', {
          description: humanizeError(error),
        });
      } else {
        logger.info('[SignupSuccess] Verification email resent', { email });
        toast.success('Email Sent', {
          description: 'A new verification email has been sent to your inbox.',
        });
        startCooldown();
      }
    } catch (error) {
      logger.error('[SignupSuccess] Resend error', { error });
      toast.error('Error', {
        description: 'Failed to resend verification email. Please try again.',
      });
    } finally {
      setIsResending(false);
    }
  };

  // If no email was passed via state, show a fallback
  if (!email) {
    return (
      <ForceLightMode>
        <div className="min-h-dvh flex items-center justify-center bg-background p-4">
          <div className="max-w-sm w-full text-center space-y-6">
            <FloraIQLogo size="lg" className="mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground">Check Your Email</h1>
            <p className="text-muted-foreground">
              If you recently signed up, check your inbox for a verification email.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/saas/login')}
                className="w-full"
              >
                Go to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/signup')}
                className="w-full"
              >
                Sign Up Again
              </Button>
            </div>
          </div>
        </div>
      </ForceLightMode>
    );
  }

  return (
    <ForceLightMode>
      <SEOHead
        title="Verify Your Email - FloraIQ"
        description="Check your email to verify your FloraIQ account and get started with your cannabis operations platform."
      />
      <div className="min-h-dvh flex w-full bg-background">
        {/* LEFT SIDE - CONTENT */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-[45%] xl:w-[40%] bg-background relative z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/signup')}
            className="absolute top-8 left-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sign Up
          </Button>

          <div className="mx-auto w-full max-w-sm">
            {/* Welcome Message */}
            <div className="mb-8">
              <FloraIQLogo size="lg" className="mb-6" />
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Welcome to FloraIQ!</p>
                    <p className="text-sm text-muted-foreground">Your account has been created successfully.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <Mail className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Check Your Email
                </h1>
              </div>
              <p className="text-muted-foreground">
                We&apos;ve sent a verification link to{' '}
                <span className="font-medium text-foreground">{email}</span>.
                Click the link to activate your account.
              </p>
            </div>

            <div className="space-y-6">
              {/* Email Reminder Alert */}
              <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4 flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Email Reminder</p>
                  <p className="text-blue-700/80">
                    Look for an email from <span className="font-medium">noreply@floraiq.com</span> with the subject &quot;Verify your FloraIQ account&quot;. The link expires in 24 hours.
                  </p>
                </div>
              </div>

              {/* Resend Button with Cooldown */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Didn&apos;t receive the email?
                </p>
                <Button
                  onClick={handleResendEmail}
                  disabled={isResending || cooldownRemaining > 0}
                  variant="outline"
                  className="w-full h-12"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : cooldownRemaining > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resend in {cooldownRemaining}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </div>

              {/* Spam Folder Tip */}
              <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">Check Your Spam Folder</p>
                  <p className="text-orange-700/80">
                    If you don&apos;t see the email within a few minutes, check your spam or junk folder.
                    You may need to mark it as &quot;not spam&quot; to receive future emails.
                  </p>
                </div>
              </div>

              {/* Login Link */}
              <div className="text-center pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Already verified?{' '}
                  <Link
                    to="/saas/login"
                    className="text-primary font-medium hover:underline"
                  >
                    Sign in to your account
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - BRANDING & NEXT STEPS */}
        <div className="hidden lg:flex w-[60%] bg-primary relative overflow-hidden items-center justify-center p-12">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1628126235206-5260b9ea6441?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay filter blur-[1px]" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary-dark/95" />
          </div>

          <div className="relative z-10 max-w-lg text-white">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm mb-6">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-3xl font-bold mb-3">Almost There!</h2>
              <p className="text-lg text-white/80">
                Just one more step to unlock your FloraIQ dashboard.
              </p>
            </div>

            {/* Next Steps Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                What&apos;s Next?
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Verify your email</p>
                    <p className="text-sm text-white/70">Click the link in the email we just sent</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Complete your profile</p>
                    <p className="text-sm text-white/70">Add your business details and preferences</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Set up your store</p>
                    <p className="text-sm text-white/70">Add products and configure your storefront</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Start selling</p>
                    <p className="text-sm text-white/70">Invite your team and process your first order</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Benefits */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3">
                <BookOpen className="h-4 w-4 text-accent" />
                <span>Getting started guides</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3">
                <Users className="h-4 w-4 text-accent" />
                <span>Team collaboration</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3">
                <Settings className="h-4 w-4 text-accent" />
                <span>Easy configuration</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>14-day free trial</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ForceLightMode>
  );
}

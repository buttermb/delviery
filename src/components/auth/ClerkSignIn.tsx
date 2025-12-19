/**
 * Clerk Sign In Component
 * Wraps Clerk's SignIn with custom styling and tenant support
 */
import { SignIn } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { useClerkConfigured } from '@/providers/ClerkProviderWrapper';
import { useAuthSafe, useUserSafe } from '@/hooks/useClerkSafe';

interface ClerkSignInProps {
  portal: 'tenant-admin' | 'super-admin' | 'customer';
  afterSignInUrl?: string;
  afterSignUpUrl?: string;
}

export function ClerkSignIn({ portal, afterSignInUrl, afterSignUpUrl }: ClerkSignInProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuthSafe();
  const { user } = useUserSafe();
  const clerkConfigured = useClerkConfigured();
  
  const [tenant, setTenant] = useState<any>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tenant for tenant-admin and customer portals
  useEffect(() => {
    const fetchTenant = async () => {
      if (portal === 'super-admin') {
        setTenantLoading(false);
        return;
      }

      if (!tenantSlug) {
        setTenantLoading(false);
        setError('Tenant slug is required');
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', tenantSlug)
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        if (data) {
          setTenant(data);
        } else {
          setError(`Tenant "${tenantSlug}" not found`);
        }
      } catch (err) {
        logger.error('[ClerkSignIn] Failed to fetch tenant', { error: err });
        setError('Failed to load tenant');
      } finally {
        setTenantLoading(false);
      }
    };

    fetchTenant();
  }, [tenantSlug, portal]);

  // Redirect after sign in
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const redirectUrl = getRedirectUrl();
      logger.info('[ClerkSignIn] User signed in, redirecting', { redirectUrl, portal });
      navigate(redirectUrl, { replace: true });
    }
  }, [isLoaded, isSignedIn, user]);

  const getRedirectUrl = () => {
    if (afterSignInUrl) return afterSignInUrl;
    
    switch (portal) {
      case 'super-admin':
        return '/super-admin/dashboard';
      case 'tenant-admin':
        return tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/login';
      case 'customer':
        return tenantSlug ? `/${tenantSlug}/shop/dashboard` : '/login';
      default:
        return '/';
    }
  };

  // If Clerk is not configured, show fallback message
  if (!clerkConfigured) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground mb-4">
          Clerk authentication is not configured.
        </p>
        <p className="text-sm text-muted-foreground">
          Please add VITE_CLERK_PUBLISHABLE_KEY to your environment variables.
        </p>
      </div>
    );
  }

  // Loading state
  if (tenantLoading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Tenant not found (for tenant-admin and customer)
  if (error && portal !== 'super-admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md bg-card rounded-xl shadow-lg border p-8">
          <div className="text-center mb-6">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Tenant Not Found</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Determine sign-in/sign-up URLs based on portal
  const signInUrl = portal === 'super-admin' 
    ? '/super-admin/login'
    : portal === 'customer'
    ? `/${tenantSlug}/customer/login`
    : `/${tenantSlug}/admin/login`;

  const signUpUrl = portal === 'customer' 
    ? `/${tenantSlug}/customer/signup`
    : portal === 'tenant-admin'
    ? '/signup'
    : undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        {portal !== 'super-admin' && tenant && (
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">{tenant.business_name}</h1>
            <p className="text-muted-foreground">
              {portal === 'customer' ? 'Customer Portal' : 'Admin Portal'}
            </p>
          </div>
        )}

        {portal === 'super-admin' && (
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Platform Administration</h1>
            <p className="text-muted-foreground">Super Admin Access</p>
          </div>
        )}

        {/* Clerk SignIn Component */}
        <SignIn
          routing="path"
          path={signInUrl}
          signUpUrl={signUpUrl}
          afterSignInUrl={getRedirectUrl()}
          afterSignUpUrl={afterSignUpUrl || getRedirectUrl()}
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-xl border-2 border-primary/10 rounded-xl bg-card',
              headerTitle: 'text-xl font-bold',
              headerSubtitle: 'text-muted-foreground',
              socialButtonsBlockButton: 'border-2 hover:bg-muted transition-colors',
              formFieldInput: 'border-2 focus:border-primary focus:ring-2 focus:ring-primary/20',
              formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
              footerActionLink: 'text-primary hover:text-primary/80',
            },
          }}
        />

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link 
            to="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Clerk Sign Up Component
 * For tenant and customer signup flows
 */
import { SignUp } from '@clerk/clerk-react';

interface ClerkSignUpProps {
  portal: 'tenant-admin' | 'customer';
  afterSignUpUrl?: string;
}

export function ClerkSignUp({ portal, afterSignUpUrl }: ClerkSignUpProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const clerkConfigured = useClerkConfigured();

  if (!clerkConfigured) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground mb-4">
          Clerk authentication is not configured.
        </p>
      </div>
    );
  }

  const signUpUrl = portal === 'customer' 
    ? `/${tenantSlug}/customer/signup`
    : '/signup';

  const signInUrl = portal === 'customer'
    ? `/${tenantSlug}/customer/login`
    : `/saas/login`;

  const redirectUrl = afterSignUpUrl || (
    portal === 'customer' 
      ? `/${tenantSlug}/shop/dashboard`
      : '/select-plan'
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-emerald-950/20" />
      <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent">
            {portal === 'customer' ? 'Create Your Account' : 'Start Your Free Trial'}
          </h1>
          <p className="text-muted-foreground">
            {portal === 'customer' 
              ? 'Join to place orders and track deliveries'
              : '14-day free trial • No credit card required'}
          </p>
        </div>

        <SignUp
          routing="path"
          path={signUpUrl}
          signInUrl={signInUrl}
          afterSignUpUrl={redirectUrl}
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-2xl border-2 border-primary/10 rounded-xl bg-card/95 backdrop-blur-sm',
              headerTitle: 'text-xl font-bold',
              headerSubtitle: 'text-muted-foreground',
              socialButtonsBlockButton: 'border-2 hover:bg-muted transition-colors h-12',
              formFieldInput: 'border-2 focus:border-primary focus:ring-2 focus:ring-primary/20 h-12',
              formButtonPrimary: 'bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold h-14',
              footerActionLink: 'text-primary hover:text-primary/80',
            },
          }}
        />

        <div className="text-center mt-6">
          <Link 
            to="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}


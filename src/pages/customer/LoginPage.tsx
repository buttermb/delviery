// @ts-nocheck
import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Link } from "react-router-dom";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useAuth } from "@/contexts/AuthContext";


export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { login } = useCustomerAuth();
  const { user } = useAuth();

  // State declarations (RAMS fix: missing state)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<any>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  useAuthRedirect(); // Redirect if already logged in

  // Redirect if already logged in with Supabase
  useEffect(() => {
    if (user && tenantSlug) {
      navigate(`/${tenantSlug}/shop/dashboard`, { replace: true });
    }
  }, [user, tenantSlug, navigate]);

  // Check for email verification success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verified = urlParams.get('verified');
    const emailParam = urlParams.get('email');

    if (verified === 'true' && emailParam) {
      setEmail(emailParam);
      toast({
        title: 'Email Verified!',
        description: 'Please enter your password to complete login.',
      });
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  useEffect(() => {
    const fetchTenant = async () => {
      if (tenantSlug) {
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .eq("slug", tenantSlug)
          .maybeSingle();

        if (data && !error) {
          setTenant(data);
        }
        setTenantLoading(false);
      } else {
        setTenantLoading(false);
      }
    };

    fetchTenant();
  }, [tenantSlug]);

  const [isMagicLinkMode, setIsMagicLinkMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantSlug) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Tenant slug is required",
      });
      return;
    }

    setLoading(true);

    try {
      if (isMagicLinkMode) {
        // Send Magic Link
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        // We use the apiFetch util effectively acting as a proxy to the secure backend function
        // Note: We are calling the function directly here as verified in the audit
        const response = await fetch(`${supabaseUrl}/functions/v1/magic-link-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email,
            redirectTo: `${window.location.origin}/${tenantSlug}/customer/auth/callback`
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to send magic link');
        }

        const result = await response.json();
        toast({
          title: "Magic Link Sent!",
          description: result.message || "Check your email for the login link.",
        });
        setIsMagicLinkMode(false); // Reset to avoid confusion
      } else {
        // Standard Password Login
        await login(email, password, tenantSlug);

        toast({
          title: "Welcome!",
          description: `Logged in successfully`,
        });

        navigate(`/${tenantSlug}/shop/dashboard`, { replace: true });
      }
    } catch (error: unknown) {
      logger.error("Customer login error", error);

      // Handle email verification error
      if (error instanceof Error && (error as any).requires_verification) {
        toast({
          variant: "destructive",
          title: "Email Not Verified",
          description: error.message || "Please verify your email address before logging in.",
        });
        navigate(`/${tenantSlug}/customer/verify-email?email=${encodeURIComponent(email)}`);
        setLoading(false);
        return;
      }

      toast({
        variant: "destructive",
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
      });
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--customer-primary))]" aria-hidden="true" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[hsl(var(--customer-bg))] p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[hsl(var(--customer-border))] p-8">
          <div className="text-center mb-6">
            <ShoppingBag className="h-12 w-12 text-[hsl(var(--customer-text-light))] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[hsl(var(--customer-text))] mb-2">Store Not Found</h1>
            <p className="text-[hsl(var(--customer-text-light))]">
              The store "{tenantSlug}" could not be found or is inactive.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const businessName = tenant.business_name || tenantSlug;
  const logo = tenant.white_label?.logo;

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Subtle animated accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(var(--customer-primary))]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(var(--customer-secondary))]/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--customer-primary))] mb-4 shadow-xl animate-scale-in">
            <ShoppingBag className="w-8 h-8 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-slate-400 text-base">{businessName}</p>
        </div>

        {/* Card with better contrast */}
        <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-200">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                className="h-12 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20 rounded-lg"
              />
            </div>

            {isMagicLinkMode ? (
              // Magic Link Mode
              <>
                <Button
                  type="submit"
                  className="w-full h-12 bg-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-primary))]/90 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-transform duration-300 hover:scale-[1.02] rounded-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Send Magic Link
                    </>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsMagicLinkMode(false)}
                    className="text-sm text-indigo-400 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 rounded-sm"
                  >
                    Use Password instead
                  </button>
                </div>
              </>
            ) : (
              // Password Mode
              <>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-200">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    enterKeyHint="done"
                    className="h-12 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-[hsl(var(--customer-primary))] focus:ring-2 focus:ring-[hsl(var(--customer-primary))]/20 rounded-lg"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-[hsl(var(--customer-primary))] hover:bg-[hsl(var(--customer-primary))]/90 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-transform duration-300 hover:scale-[1.02] rounded-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ShoppingBag className="mr-2 h-5 w-5" />
                      Sign In to Shop
                    </>
                  )}
                </Button>

                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => setIsMagicLinkMode(true)}
                    className="text-sm text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 rounded-sm"
                  >
                    Send magic link instead
                  </button>
                </div>
              </>
            )}

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-700/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800/80 px-2 text-slate-400">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <GoogleSignInButton
              redirectTo={`${window.location.origin}/${tenantSlug}/customer/auth/callback`}
              disabled={loading}
              className="h-12 bg-slate-900/50 border-slate-700 text-white hover:bg-slate-900/70 rounded-lg"
            />

            {/* Clerk Auth Option Removed */}
          </form>

          {/* Footer Links */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-center gap-3 text-sm">
              <ForgotPasswordDialog userType="customer" tenantSlug={tenantSlug}>
                <button className="text-slate-400 hover:text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 rounded-sm">
                  Forgot password?
                </button>
              </ForgotPasswordDialog>
              <span className="text-slate-600">•</span>
              <Link
                to={`/${tenantSlug}/customer/signup`}
                className="text-[hsl(var(--customer-primary))] hover:text-[hsl(var(--customer-primary))]/80 font-medium transition-colors"
              >
                Create account
              </Link>
            </div>

            <div className="pt-4 border-t border-slate-700/50 text-center">
              <Link
                to={`/${tenantSlug}/admin/login`}
                className="text-sm text-slate-400 hover:text-slate-300 transition-colors inline-flex items-center gap-1"
              >
                Business owner? Admin Login →
              </Link>
            </div>
          </div>
        </div>

        {/* Trust indicator */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-xs">
            🔒 Secure & encrypted connection
          </p>
        </div>
      </div>
    </div>
  );
}

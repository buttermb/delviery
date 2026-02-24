import { logger } from '@/lib/logger';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from 'sonner';
import { Link } from "react-router-dom";
import { useSuperAdminAuth } from "@/contexts/SuperAdminAuthContext";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthOfflineIndicator } from "@/components/auth/AuthOfflineIndicator";
import { useAuthOffline } from "@/hooks/useAuthOffline";
import { useCsrfToken } from "@/hooks/useCsrfToken";
import { AuthErrorAlert, getAuthErrorType, getAuthErrorMessage } from "@/components/auth/AuthErrorAlert";
import { intendedDestinationUtils } from "@/hooks/useIntendedDestination";


export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const { login } = useSuperAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { validateToken } = useCsrfToken();

  const { isOnline, hasQueuedAttempt, queueLoginAttempt } = useAuthOffline(
    async (qEmail, qPassword) => {
      await login(qEmail, qPassword);
      toast.success("Welcome, Super Admin!");
      const intendedDestination = intendedDestinationUtils.consume();
      const redirectTo = intendedDestination || "/super-admin/dashboard";
      logger.debug('[SuperAdminLogin] Redirecting after queued login', { intendedDestination, redirectTo });
      navigate(redirectTo, { replace: true });
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!validateToken()) {
      setLoginError("Invalid security token. Please refresh the page and try again.");
      return;
    }

    if (!isOnline) {
      queueLoginAttempt(email, password);
      return;
    }

    setLoading(true);

    try {
      await login(email, password);

      toast.success('Logged in successfully');

      const intendedDestination = intendedDestinationUtils.consume();
      const redirectTo = intendedDestination || "/super-admin/dashboard";
      logger.debug('[SuperAdminLogin] Redirecting after successful login', { intendedDestination, redirectTo });
      navigate(redirectTo, { replace: true });
    } catch (error: unknown) {
      logger.error("Super admin login error", error, { component: 'SuperAdminLoginPage' });
      const errorMessage = getAuthErrorMessage(error, "Invalid email or password. Please try again.");
      setLoginError(errorMessage);
      setLoading(false);
    }
  };



  return (
    <div className="min-h-dvh flex items-center justify-center relative overflow-hidden bg-[hsl(var(--super-admin-bg))] p-4">
      {/* Back to Home Button */}
      <Link
        to="/"
        className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-sm border border-white/10 text-[hsl(var(--super-admin-text))]/70 hover:text-[hsl(var(--super-admin-text))] hover:bg-[hsl(var(--super-admin-surface))] transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Home</span>
      </Link>

      {/* Animated Grid Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
          animation: "grid-move 20s linear infinite",
        }} />
      </div>

      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--super-admin-primary))]/20 via-[hsl(var(--super-admin-secondary))]/20 to-[hsl(var(--super-admin-bg))]" />

      {/* Animated Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[hsl(var(--super-admin-primary))]/10 blur-sm"
            style={{
              width: `${Math.random() * 100 + 20}px`,
              height: `${Math.random() * 100 + 20}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${10 + Math.random() * 20}s infinite ease-in-out`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Frosted Glass Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-gradient-to-br from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] p-4 shadow-lg">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-[hsl(var(--super-admin-text))] mb-2">
              Platform Admin
            </h1>
            <p className="text-[hsl(var(--super-admin-text))]/70 text-sm">
              Sign in to manage all tenant accounts
            </p>
          </div>

          {/* Offline Indicator */}
          <AuthOfflineIndicator isOnline={isOnline} hasQueuedAttempt={hasQueuedAttempt} className="mb-6" />

          {/* Error Alert */}
          <AuthErrorAlert
            message={loginError || ''}
            type={loginError ? getAuthErrorType(loginError) : 'error'}
            variant="light"
            className="mb-4"
          />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[hsl(var(--super-admin-text))]/90">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@platform.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
                className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[hsl(var(--super-admin-primary))] focus:ring-[hsl(var(--super-admin-primary))]/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[hsl(var(--super-admin-text))]/90">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[hsl(var(--super-admin-primary))] focus:ring-[hsl(var(--super-admin-primary))]/20 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !isOnline}
              className="w-full bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:from-[hsl(var(--super-admin-primary))]/90 hover:to-[hsl(var(--super-admin-secondary))]/90 text-white h-12 font-semibold shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[hsl(var(--super-admin-surface))]/80 px-2 text-[hsl(var(--super-admin-text))]/50">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <GoogleSignInButton
              redirectTo={`${window.location.origin}/super-admin/auth/callback`}
              disabled={loading || !isOnline}
              className="bg-[hsl(var(--super-admin-bg))]/50 border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-[hsl(var(--super-admin-bg))]/70"
            />


          </form>

          {/* Forgot Password */}
          <div className="mt-6 text-center">
            <ForgotPasswordDialog userType="super_admin" />
          </div>

          {/* 2FA Message */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--super-admin-text))]/60">
              <Lock className="h-3 w-3" />
              <span>Protected by 2FA</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(20px, -20px) rotate(90deg);
          }
          50% {
            transform: translate(-20px, 20px) rotate(180deg);
          }
          75% {
            transform: translate(20px, 20px) rotate(270deg);
          }
        }
        @keyframes grid-move {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 50px 50px;
          }
        }
      `}</style>
    </div>
  );
}

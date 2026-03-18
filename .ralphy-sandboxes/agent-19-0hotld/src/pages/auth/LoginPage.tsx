import { useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { logger } from '@/lib/logger';
import { Loader2, AlertCircle, Eye, EyeOff, Info } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginError {
  message: string;
  type: 'credentials' | 'locked' | 'general';
}

export function LoginPage() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const { login } = useTenantAdminAuth();
  useAuthRedirect();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<LoginError | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = searchParams.get('redirect') || null;
  const sessionExpired = searchParams.get('expired') === '1';

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const getErrorMessage = (error: unknown): LoginError => {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('locked') || lowerMessage.includes('suspended') || lowerMessage.includes('disabled')) {
      return {
        message: 'Your account has been locked. Please contact your administrator for assistance.',
        type: 'locked',
      };
    }

    if (
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('credentials') ||
      lowerMessage.includes('incorrect') ||
      lowerMessage.includes('not found') ||
      lowerMessage.includes('wrong password')
    ) {
      return {
        message: 'Invalid email or password. Please check your credentials and try again.',
        type: 'credentials',
      };
    }

    return {
      message: message || 'Login failed. Please try again.',
      type: 'general',
    };
  };

  const onSubmit = async (data: LoginFormData) => {
    if (!tenantSlug) {
      setLoginError({
        message: 'Unable to determine tenant. Please check the URL and try again.',
        type: 'general',
      });
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);

    try {
      const email = data.email.toLowerCase().trim();

      // Pass rememberMe to extend session duration (30 days vs 7 days)
      await login(email, data.password, tenantSlug, data.rememberMe);

      const destination = redirectTo || `/${tenantSlug}/admin/dashboard`;
      navigate(destination, { replace: true });
    } catch (error: unknown) {
      logger.error('Login failed', error, { component: 'LoginPage', tenantSlug });
      const parsedError = getErrorMessage(error);
      setLoginError(parsedError);
      form.setValue('password', '');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the dashboard
          </p>
        </div>

        {/* Session Expired Alert */}
        {sessionExpired && !loginError && (
          <Alert className="animate-in fade-in-0 slide-in-from-top-1 border-amber-500/50 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-200">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription>Your session has expired. Please sign in again.</AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {loginError && (
          <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-1">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{loginError.message}</AlertDescription>
          </Alert>
        )}

        {/* Login Form */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="you@company.com"
                        autoComplete="email"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          disabled={isSubmitting}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          id="remember-me"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormLabel
                        htmlFor="remember-me"
                        className="text-sm font-normal cursor-pointer"
                        title="Stay signed in for 30 days instead of 7 days"
                      >
                        Remember me
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <Link
                  to={tenantSlug ? `/${tenantSlug}/admin/forgot-password` : '/auth/forgot-password'}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Signup Link */}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            to={tenantSlug ? `/${tenantSlug}/admin/signup` : '/auth/signup'}
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

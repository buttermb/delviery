/**
 * SAAS Login Page
 * Login for existing tenants
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logger } from '@/utils/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, CheckCircle2, Sparkles, Lock, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';

// Bound fetch to prevent "Illegal invocation" error
const safeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const signupSuccess = searchParams.get('signup') === 'success';
  const tenantSlug = searchParams.get('tenant');

  useEffect(() => {
    if (signupSuccess) {
      toast({
        title: 'Account created successfully!',
        description: 'Please sign in with your new credentials.',
      });
    }
  }, [signupSuccess, toast]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    
    // Clear any stale tenant data before login
    localStorage.removeItem('lastTenantSlug');
    localStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_USER);
    localStorage.removeItem(STORAGE_KEYS.TENANT_DATA);
    
    try {
      // Sign in with Supabase Auth first to validate credentials
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to login');

      // Get tenant for this user
      const { data: tenantUser, error: tenantUserError } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', authData.user.id)
        .eq('status', 'active')
        .single();

      if (tenantUserError || !tenantUser) {
        throw new Error('No tenant found for this account');
      }

      // Get tenant slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', tenantUser.tenant_id)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Invalid tenant configuration');
      }

      // Call tenant-admin-auth to set up complete authentication
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          tenantSlug: tenant.slug,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const authResponse = await response.json();

      // Store authentication data
      localStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN, authResponse.access_token);
      localStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN, authResponse.refresh_token);
      localStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_USER, JSON.stringify(authResponse.admin));
      localStorage.setItem(STORAGE_KEYS.TENANT_DATA, JSON.stringify(authResponse.tenant));
      localStorage.setItem('lastTenantSlug', tenant.slug);

      toast({
        title: 'Welcome back!',
        description: `Redirecting to ${authResponse.tenant.business_name}...`,
      });

      // Small delay to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 200));

      // Redirect to tenant admin dashboard
      window.location.href = `/${tenant.slug}/admin/dashboard`;
    } catch (error: any) {
      logger.error('Login error', error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Dynamic gradient background with animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-emerald-950/20 transition-colors duration-700" />
      
      {/* Large floating orbs with complex movement - theme aware */}
      <div 
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl transition-all duration-700"
        style={{ 
          background: theme === 'dark' 
            ? 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(59, 130, 246, 0) 70%)'
            : 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0) 70%)',
          opacity: theme === 'dark' ? 0.5 : 0.7,
          animation: 'float-complex 20s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full blur-3xl transition-all duration-700"
        style={{ 
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(168, 85, 247, 0) 70%)'
            : 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, rgba(168, 85, 247, 0) 70%)',
          opacity: theme === 'dark' ? 0.5 : 0.7,
          animation: 'float-complex-reverse 25s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute top-1/3 left-1/2 w-[500px] h-[500px] rounded-full blur-3xl transition-all duration-700"
        style={{ 
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0) 70%)'
            : 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0) 70%)',
          opacity: theme === 'dark' ? 0.4 : 0.6,
          animation: 'float-diagonal-complex 30s ease-in-out infinite'
        }} 
      />
      
      {/* Medium accent orbs - theme aware */}
      <div 
        className="absolute top-20 right-1/4 w-64 h-64 rounded-full blur-3xl transition-all duration-700"
        style={{ 
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, rgba(236, 72, 153, 0) 70%)'
            : 'radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0) 70%)',
          opacity: theme === 'dark' ? 0.35 : 0.5,
          animation: 'float-small 12s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute bottom-32 left-1/4 w-56 h-56 rounded-full blur-3xl transition-all duration-700"
        style={{ 
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, rgba(251, 191, 36, 0) 70%)'
            : 'radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, rgba(251, 191, 36, 0) 70%)',
          opacity: theme === 'dark' ? 0.35 : 0.5,
          animation: 'float-small-reverse 14s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute top-1/2 right-1/3 w-72 h-72 rounded-full blur-3xl transition-all duration-700"
        style={{ 
          background: theme === 'dark'
            ? 'radial-gradient(circle, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0) 70%)'
            : 'radial-gradient(circle, rgba(34, 211, 238, 0.35) 0%, rgba(34, 211, 238, 0) 70%)',
          opacity: theme === 'dark' ? 0.3 : 0.4,
          animation: 'float-medium 16s ease-in-out infinite'
        }} 
      />
      
      {/* Animated gradient waves - theme aware */}
      <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: theme === 'dark' ? 0.3 : 0.5 }}>
        <div 
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: theme === 'dark'
              ? 'radial-gradient(ellipse at 30% 50%, rgba(59, 130, 246, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(168, 85, 247, 0.12) 0%, transparent 50%)'
              : 'radial-gradient(ellipse at 30% 50%, rgba(59, 130, 246, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(168, 85, 247, 0.18) 0%, transparent 50%)',
            animation: 'wave-movement 20s ease-in-out infinite'
          }}
        />
        <div 
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: theme === 'dark'
              ? 'radial-gradient(ellipse at 50% 30%, rgba(16, 185, 129, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 70%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)'
              : 'radial-gradient(ellipse at 50% 30%, rgba(16, 185, 129, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 70%, rgba(236, 72, 153, 0.15) 0%, transparent 50%)',
            animation: 'wave-movement-reverse 25s ease-in-out infinite'
          }}
        />
      </div>
      
      {/* Floating sparkle particles - theme aware */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => {
          const colors = theme === 'dark'
            ? ['rgba(59, 130, 246, 0.5)', 'rgba(168, 85, 247, 0.5)', 'rgba(16, 185, 129, 0.5)', 'rgba(236, 72, 153, 0.5)']
            : ['rgba(59, 130, 246, 0.7)', 'rgba(168, 85, 247, 0.7)', 'rgba(16, 185, 129, 0.7)', 'rgba(236, 72, 153, 0.7)'];
          
          return (
            <div
              key={`particle-${i}`}
              className="absolute rounded-full transition-all duration-700"
              style={{
                width: `${Math.random() * 6 + 2}px`,
                height: `${Math.random() * 6 + 2}px`,
                background: `radial-gradient(circle, ${colors[i % 4]} 0%, transparent 70%)`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `sparkle-float ${Math.random() * 15 + 20}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 10}s`,
                filter: 'blur(1px)'
              }}
            />
          );
        })}
      </div>
      
      {/* Subtle grid overlay with shimmer - theme aware */}
      <div 
        className="absolute inset-0 transition-opacity duration-700" 
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
          backgroundSize: '50px 50px',
          opacity: theme === 'dark' ? 0.04 : 0.015,
          animation: 'shimmer 10s ease-in-out infinite'
        }} 
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float-complex {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          25% { 
            transform: translate(100px, -50px) scale(1.1) rotate(5deg);
          }
          50% { 
            transform: translate(50px, 100px) scale(0.9) rotate(-5deg);
          }
          75% { 
            transform: translate(-50px, 50px) scale(1.05) rotate(3deg);
          }
        }
        
        @keyframes float-complex-reverse {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          25% { 
            transform: translate(-120px, 60px) scale(0.95) rotate(-5deg);
          }
          50% { 
            transform: translate(-60px, -80px) scale(1.1) rotate(5deg);
          }
          75% { 
            transform: translate(60px, -40px) scale(1.05) rotate(-3deg);
          }
        }
        
        @keyframes float-diagonal-complex {
          0%, 100% { 
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 0.5;
          }
          33% { 
            transform: translate(80px, -80px) scale(1.15) rotate(10deg);
            opacity: 0.7;
          }
          66% { 
            transform: translate(-70px, 70px) scale(0.85) rotate(-10deg);
            opacity: 0.4;
          }
        }
        
        @keyframes float-small {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg);
          }
          50% { 
            transform: translate(50px, -60px) rotate(180deg);
          }
        }
        
        @keyframes float-small-reverse {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg);
          }
          50% { 
            transform: translate(-60px, 50px) rotate(-180deg);
          }
        }
        
        @keyframes float-medium {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          33% { 
            transform: translate(40px, 40px) scale(1.2);
          }
          66% { 
            transform: translate(-40px, -40px) scale(0.8);
          }
        }
        
        @keyframes wave-movement {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(50px, -30px) scale(1.1);
          }
        }
        
        @keyframes wave-movement-reverse {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-40px, 40px) scale(1.15);
          }
        }
        
        @keyframes sparkle-float {
          0%, 100% { 
            transform: translate(0, 0) scale(0);
            opacity: 0;
          }
          10%, 90% {
            opacity: 1;
          }
          50% { 
            transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(1);
          }
        }
        
        @keyframes shimmer {
          0%, 100% {
            opacity: 0.015;
          }
          50% {
            opacity: 0.03;
          }
        }
      `}} />

      <Card className="w-full max-w-md p-8 sm:p-10 relative z-10 backdrop-blur-xl bg-card/90 shadow-2xl border-2 animate-fade-in transition-colors duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl mb-6 animate-scale-in">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-purple-600 to-primary bg-clip-text text-transparent animate-fade-in">
            Welcome Back
          </h1>
          <p className="text-muted-foreground animate-fade-in">Sign in to your business dashboard</p>
        </div>

        {signupSuccess && (
          <Alert className="mb-6 border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Your account has been created successfully! Please sign in to continue.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="you@business.com" 
                      className="h-11 bg-background/50 border-2 focus:border-primary transition-colors"
                      {...field} 
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
                  <FormLabel className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    Password
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      className="h-11 bg-background/50 border-2 focus:border-primary transition-colors"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all hover-scale mt-8" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Form>

        <div className="mt-8 text-center text-sm space-y-3">
          <p className="text-muted-foreground">
            Don't have an account?{' '}
            <a href="/signup" className="text-primary font-semibold hover:underline transition-all story-link">
              Start free trial
            </a>
          </p>
          <p className="text-xs text-muted-foreground/70 flex items-center justify-center gap-2">
            <Lock className="h-3 w-3" />
            Secure authentication powered by DevPanel
          </p>
        </div>
      </Card>
    </div>
  );
}

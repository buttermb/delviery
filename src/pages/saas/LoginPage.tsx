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

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
      const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`, {
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
        description: 'Redirecting to your dashboard...',
      });

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
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-emerald-950/20" />
      
      {/* Floating orbs with movement */}
      <div 
        className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse" 
        style={{ 
          animationDuration: '4s',
          animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite, float 8s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute bottom-20 -right-20 w-[500px] h-[500px] bg-purple-500/20 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse" 
        style={{ 
          animationDuration: '6s',
          animationDelay: '1s',
          animation: 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite 1s, float-reverse 10s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute top-1/2 left-1/3 w-80 h-80 bg-emerald-500/15 dark:bg-emerald-500/10 rounded-full blur-3xl animate-pulse" 
        style={{ 
          animationDuration: '5s',
          animationDelay: '2s',
          animation: 'pulse 5s cubic-bezier(0.4, 0, 0.6, 1) infinite 2s, float-diagonal 12s ease-in-out infinite'
        }} 
      />
      
      {/* Animated gradient shapes */}
      <div 
        className="absolute top-1/4 right-1/4 w-64 h-64 bg-gradient-to-br from-pink-500/10 to-orange-500/10 rounded-full blur-2xl"
        style={{ animation: 'float 7s ease-in-out infinite' }}
      />
      <div 
        className="absolute bottom-1/3 left-1/4 w-48 h-48 bg-gradient-to-tr from-cyan-500/10 to-blue-500/10 rounded-full blur-2xl"
        style={{ animation: 'float-reverse 9s ease-in-out infinite' }}
      />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />
      
      {/* Animated lines */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent top-1/4"
          style={{ animation: 'slide-horizontal 15s linear infinite' }}
        />
        <div 
          className="absolute h-px w-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent top-2/3"
          style={{ animation: 'slide-horizontal-reverse 20s linear infinite' }}
        />
        <div 
          className="absolute w-px h-full bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent left-1/4"
          style={{ animation: 'slide-vertical 18s linear infinite' }}
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(30px, -30px) rotate(5deg); }
          50% { transform: translate(-20px, 20px) rotate(-5deg); }
          75% { transform: translate(20px, 10px) rotate(3deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-30px, 30px) rotate(-5deg); }
          50% { transform: translate(20px, -20px) rotate(5deg); }
          75% { transform: translate(-20px, -10px) rotate(-3deg); }
        }
        @keyframes float-diagonal {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -40px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
        }
        @keyframes slide-horizontal {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes slide-horizontal-reverse {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes slide-vertical {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}} />

      <Card className="w-full max-w-md p-8 sm:p-10 relative z-10 backdrop-blur-sm bg-card/95 shadow-2xl border-2 animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl mb-4 animate-scale-in">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <Badge className="mb-4 animate-fade-in" variant="outline">Business Admin Portal</Badge>
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

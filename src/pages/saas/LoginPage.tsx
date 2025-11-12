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
      {/* Dynamic gradient background with animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-emerald-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-emerald-950/20 animate-gradient" />
      
      {/* Large floating orbs with complex movement */}
      <div 
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-3xl opacity-60"
        style={{ 
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0) 70%)',
          animation: 'float-complex 20s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full blur-3xl opacity-60"
        style={{ 
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0) 70%)',
          animation: 'float-complex-reverse 25s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute top-1/3 left-1/2 w-[500px] h-[500px] rounded-full blur-3xl opacity-50"
        style={{ 
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0) 70%)',
          animation: 'float-diagonal-complex 30s ease-in-out infinite'
        }} 
      />
      
      {/* Smaller accent orbs */}
      <div 
        className="absolute top-20 right-1/4 w-40 h-40 rounded-full blur-2xl opacity-40"
        style={{ 
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.4) 0%, rgba(236, 72, 153, 0) 70%)',
          animation: 'float-small 8s ease-in-out infinite'
        }} 
      />
      <div 
        className="absolute bottom-32 left-1/4 w-32 h-32 rounded-full blur-2xl opacity-40"
        style={{ 
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, rgba(251, 191, 36, 0) 70%)',
          animation: 'float-small-reverse 10s ease-in-out infinite'
        }} 
      />
      
      {/* Animated gradient mesh */}
      <div className="absolute inset-0 opacity-30">
        <div 
          className="absolute top-0 left-0 w-full h-full"
          style={{
            background: 'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.15) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)',
            animation: 'mesh-movement 15s ease-in-out infinite'
          }}
        />
      </div>
      
      {/* Particle effect lines */}
      <div className="absolute inset-0">
        {[...Array(5)].map((_, i) => (
          <div
            key={`line-${i}`}
            className="absolute h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            style={{
              top: `${20 + i * 15}%`,
              width: '100%',
              animation: `slide-horizontal ${12 + i * 3}s linear infinite`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
        {[...Array(3)].map((_, i) => (
          <div
            key={`vline-${i}`}
            className="absolute w-px h-full bg-gradient-to-b from-transparent via-purple-500/30 to-transparent"
            style={{
              left: `${25 + i * 25}%`,
              animation: `slide-vertical ${15 + i * 4}s linear infinite`,
              animationDelay: `${i * 0.7}s`
            }}
          />
        ))}
      </div>
      
      {/* Floating dots/particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={`particle-${i}`}
            className="absolute rounded-full bg-primary/20"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `particle-float ${Math.random() * 10 + 15}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>
      
      {/* Grid pattern overlay with shimmer */}
      <div 
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]" 
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          animation: 'shimmer 8s linear infinite'
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
            transform: translate(0, 0) scale(1);
            opacity: 0.5;
          }
          33% { 
            transform: translate(80px, -80px) scale(1.15);
            opacity: 0.7;
          }
          66% { 
            transform: translate(-70px, 70px) scale(0.85);
            opacity: 0.4;
          }
        }
        
        @keyframes float-small {
          0%, 100% { 
            transform: translate(0, 0);
          }
          50% { 
            transform: translate(30px, -50px);
          }
        }
        
        @keyframes float-small-reverse {
          0%, 100% { 
            transform: translate(0, 0);
          }
          50% { 
            transform: translate(-40px, 40px);
          }
        }
        
        @keyframes mesh-movement {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(5deg);
          }
          66% {
            transform: translate(-30px, 30px) rotate(-5deg);
          }
        }
        
        @keyframes particle-float {
          0%, 100% { 
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          50% { 
            transform: translateY(-100px) translateX(50px);
          }
        }
        
        @keyframes slide-horizontal {
          0% { 
            transform: translateX(-100%);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% { 
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        @keyframes slide-vertical {
          0% { 
            transform: translateY(-100%);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% { 
            transform: translateY(100%);
            opacity: 0;
          }
        }
        
        @keyframes shimmer {
          0% {
            opacity: 0.02;
          }
          50% {
            opacity: 0.05;
          }
          100% {
            opacity: 0.02;
          }
        }
        
        @keyframes animate-gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}} />

      <Card className="w-full max-w-md p-8 sm:p-10 relative z-10 backdrop-blur-xl bg-card/90 shadow-2xl border-2 animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl mb-4 animate-scale-in">
            <Sparkles className="h-8 w-8 text-primary" />
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

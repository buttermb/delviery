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
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@business.com" {...field} />
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                'Signing in...'
              ) : (
                <>
                  Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </Form>

        <div className="mt-6 text-center text-sm">
          <p className="text-muted-foreground">
            Don't have an account?{' '}
            <a href="/signup" className="text-primary underline">
              Start free trial
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}

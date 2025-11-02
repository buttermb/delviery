/**
 * SAAS Sign Up Page
 * Registration for new tenants
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, ArrowRight } from 'lucide-react';

const signupSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_name: z.string().min(2, 'Your name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  state: z.string().min(1, 'Please select a state'),
  industry: z.string().min(1, 'Please select an industry'),
  company_size: z.string().min(1, 'Please select company size'),
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Terms of Service',
  }),
});

type SignupFormData = z.infer<typeof signupSchema>;

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const INDUSTRIES = [
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'retail', label: 'Retail' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'other', label: 'Other' },
];

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '200+', label: '200+ employees' },
];

export default function SignUpPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      business_name: '',
      owner_name: '',
      email: '',
      password: '',
      phone: '',
      state: '',
      industry: '',
      company_size: '',
      terms_accepted: false,
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      // Call tenant-signup Edge Function
      const { data: result, error } = await supabase.functions.invoke('tenant-signup', {
        body: {
          email: data.email,
          password: data.password,
          business_name: data.business_name,
          owner_name: data.owner_name,
          phone: data.phone,
          state: data.state,
          industry: data.industry,
          company_size: data.company_size,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create account');
      }

      if (!result || !result.success) {
        throw new Error(result?.error || 'Failed to create account. Please try again.');
      }

      const tenant = result.tenant;

      toast({
        title: 'Account Created!',
        description: 'Your account has been created successfully. Please sign in to continue.',
      });

      // Redirect to login page with success message
      navigate(`/saas/login?signup=success&tenant=${tenant.slug}`);
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create account. Please try again.';
      if (error.message) {
        if (error.message.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('slug')) {
          errorMessage = 'This business name is already taken. Please try a different name.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: 'Sign Up Failed',
        description: errorMessage,
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
          <h1 className="text-3xl font-bold mb-2">Start Your 14-Day Free Trial</h1>
          <p className="text-muted-foreground">No credit card required</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Big Mike's Wholesale" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="owner_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
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
                  <FormLabel>Password *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone *</FormLabel>
                  <FormControl>
                    <Input placeholder="555-123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INDUSTRIES.map((industry) => (
                        <SelectItem key={industry.value} value={industry.value}>
                          {industry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Size *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMPANY_SIZES.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terms_accepted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="mt-1"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal">
                      I agree to the{' '}
                      <a href="/terms" className="text-primary underline" target="_blank">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" className="text-primary underline" target="_blank">
                        Privacy Policy
                      </a>
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                'Creating Account...'
              ) : (
                <>
                  Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              14 days free, then $99/month<br />
              Cancel anytime
            </p>
          </form>
        </Form>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-muted-foreground mb-3">What's included:</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>Up to 50 customers</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>3 disposable menus</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>100 products</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>Mobile app access</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <a href="/saas/login" className="text-primary underline">
              Sign in
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}


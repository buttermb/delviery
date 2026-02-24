import { logger } from '@/lib/logger';
/**
 * Create Tenant Dialog
 * Allows super admin to create new tenants manually
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sanitizeFormInput, sanitizeEmail, sanitizePhoneInput } from '@/lib/utils/sanitize';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';

type TenantLimits = {
  customers: number;
  menus: number;
  products: number;
  locations: number;
  users: number;
};

type TenantFeatures = {
  api_access: boolean;
  custom_branding: boolean;
  white_label: boolean;
  advanced_analytics: boolean;
  sms_enabled: boolean;
};

type TenantUsage = {
  customers: number;
  menus: number;
  products: number;
  locations: number;
  users: number;
};

const createTenantSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_email: z.string().email('Invalid email address'),
  owner_name: z.string().min(2, 'Owner name must be at least 2 characters'),
  phone: z.string().regex(/^[\d\s\-+()]+$/, "Invalid phone number").min(7, "Phone number must be at least 7 characters").max(20, "Phone number must be 20 characters or less").optional().or(z.literal('')),
  subscription_plan: z.enum(['starter', 'professional', 'enterprise']),
  subscription_status: z.enum(['trial', 'active', 'suspended']),
  state: z.string().optional(),
});

type CreateTenantForm = z.infer<typeof createTenantSchema>;

interface CreateTenantDialogProps {
  trigger?: React.ReactNode;
}

export function CreateTenantDialog({ trigger }: CreateTenantDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<CreateTenantForm>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      business_name: '',
      owner_email: '',
      owner_name: '',
      phone: '',
      subscription_plan: 'starter',
      subscription_status: 'trial',
      state: '',
    },
  });

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: CreateTenantForm) => {
    setIsSaving(true);
    try {
      // Generate slug from business name
      const slug = data.business_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Get plan limits
      const planLimits: Record<string, TenantLimits> = {
        starter: {
          customers: 50,
          menus: 3,
          products: 100,
          locations: 2,
          users: 3,
        },
        professional: {
          customers: 500,
          menus: -1, // Unlimited
          products: -1,
          locations: 10,
          users: 10,
        },
        enterprise: {
          customers: -1,
          menus: -1,
          products: -1,
          locations: -1,
          users: -1,
        },
      };

      const planFeatures: Record<string, TenantFeatures> = {
        starter: {
          api_access: false,
          custom_branding: false,
          white_label: false,
          advanced_analytics: false,
          sms_enabled: false,
        },
        professional: {
          api_access: true,
          custom_branding: true,
          white_label: false,
          advanced_analytics: true,
          sms_enabled: true,
        },
        enterprise: {
          api_access: true,
          custom_branding: true,
          white_label: true,
          advanced_analytics: true,
          sms_enabled: true,
        },
      };

      const limits = planLimits[data.subscription_plan];
      const features = planFeatures[data.subscription_plan];

      // Set trial end date if trial status
      const trialEndsAt =
        data.subscription_status === 'trial'
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          : null;

      // Create tenant
      const sanitizedBusinessName = sanitizeFormInput(data.business_name, 200);
      const sanitizedOwnerEmail = sanitizeEmail(data.owner_email);
      const sanitizedOwnerName = sanitizeFormInput(data.owner_name, 200);
      const sanitizedPhone = data.phone ? sanitizePhoneInput(data.phone) : null;

      const { data: tenant, error } = await supabase
        .from('tenants')
        .insert({
          business_name: sanitizedBusinessName,
          slug,
          owner_email: sanitizedOwnerEmail,
          owner_name: sanitizedOwnerName,
          phone: sanitizedPhone,
          subscription_plan: data.subscription_plan,
          subscription_status: data.subscription_status,
          trial_ends_at: trialEndsAt,
          limits,
          features,
          usage: {
            customers: 0,
            menus: 0,
            products: 0,
            locations: 0,
            users: 0,
          } as TenantUsage,
          compliance_verified: false,
          onboarded: false,
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      // Create owner user
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: sanitizedOwnerEmail,
        email_confirm: true,
        user_metadata: {
          name: sanitizedOwnerName,
        },
      });

      if (userError) {
        logger.warn('Failed to create user:', userError);
      } else if (userData.user && tenant) {
        // Add user to tenant_users table
        await supabase.from('tenant_users').insert({
          tenant_id: tenant.id,
          email: sanitizedOwnerEmail,
          name: sanitizedOwnerName,
          role: 'owner',
          status: 'active',
          email_verified: true,
          accepted_at: new Date().toISOString(),
        });
      }

      toast.success("${data.business_name} has been created successfully");

      queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      setOpen(false);
      form.reset();
    } catch (error: unknown) {
      toast.error("Failed to create tenant");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tenant</DialogTitle>
          <DialogDescription>
            Manually create a new tenant account for your platform
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Business Name</FormLabel>
                  <FormControl>
                    <Input placeholder="BigMike Wholesale" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="owner_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Owner Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Mike Johnson" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="owner_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Owner Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="mike@bigmike.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" type="tel" {...field} />
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
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="CA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="subscription_plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Subscription Plan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="starter">Starter ($79/mo)</SelectItem>
                        <SelectItem value="professional">Professional ($150/mo)</SelectItem>
                        <SelectItem value="enterprise">Enterprise ($499/mo)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subscription_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="trial">Trial (14 days)</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Tenant
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


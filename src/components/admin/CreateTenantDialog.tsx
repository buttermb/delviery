/**
 * Create Tenant Dialog
 * Allows super admin to create new tenants manually
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

const createTenantSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_email: z.string().email('Invalid email address'),
  owner_name: z.string().min(2, 'Owner name must be at least 2 characters'),
  phone: z.string().optional(),
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
  const { toast } = useToast();
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

  const onSubmit = async (data: CreateTenantForm) => {
    try {
      // Generate slug from business name
      const slug = data.business_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Get plan limits
      const planLimits: Record<string, any> = {
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

      const planFeatures: Record<string, any> = {
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
      const { data: tenant, error } = await supabase
        .from('tenants')
        .insert({
          business_name: data.business_name,
          slug,
          owner_email: data.owner_email,
          owner_name: data.owner_name,
          phone: data.phone || null,
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
          },
          compliance_verified: false,
          onboarded: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Create owner user
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: data.owner_email,
        email_confirm: true,
        user_metadata: {
          name: data.owner_name,
        },
      });

      if (userError) {
        console.warn('Failed to create user:', userError);
      } else if (userData.user && tenant) {
        // Add user to tenant_users table
        await supabase.from('tenant_users').insert({
          tenant_id: tenant.id,
          email: data.owner_email,
          name: data.owner_name,
          role: 'owner',
          status: 'active',
          email_verified: true,
          accepted_at: new Date().toISOString(),
        });
      }

      toast({
        title: 'Tenant created',
        description: `${data.business_name} has been created successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ['super-admin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      setOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: 'Failed to create tenant',
        description: error.message,
        variant: 'destructive',
      });
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
                  <FormLabel>Business Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="BigMike Wholesale" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="owner_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner Name *</FormLabel>
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
                    <FormLabel>Owner Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="mike@bigmike.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} />
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="subscription_plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subscription Plan *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="starter">Starter ($99/mo)</SelectItem>
                        <SelectItem value="professional">Professional ($299/mo)</SelectItem>
                        <SelectItem value="enterprise">Enterprise ($799/mo)</SelectItem>
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
                    <FormLabel>Status *</FormLabel>
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create Tenant</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


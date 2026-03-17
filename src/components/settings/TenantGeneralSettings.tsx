import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import type { Database } from '@/integrations/supabase/types';

type TenantRow = Database['public']['Tables']['tenants']['Row'];

const tenantGeneralSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  owner_name: z.string().min(2, 'Owner name must be at least 2 characters'),
  owner_email: z.string().email('Invalid email address'),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type TenantGeneralFormValues = z.infer<typeof tenantGeneralSchema>;

export function TenantGeneralSettings() {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<TenantGeneralFormValues>({
    resolver: zodResolver(tenantGeneralSchema),
    defaultValues: {
      business_name: '',
      owner_name: '',
      owner_email: '',
      phone: '',
      address: '',
      description: '',
      website: '',
    },
  });

  useEffect(() => {
    if (tenant) {
      const tenantRow = tenant as unknown as TenantRow;
      form.reset({
        business_name: tenant.business_name || '',
        owner_name: tenantRow.owner_name || '',
        owner_email: tenantRow.owner_email || '',
        phone: tenantRow.phone || '',
        address: '',
        description: '',
        website: '',
      });
    }
  }, [tenant, form]);

  const onSubmit = async (data: TenantGeneralFormValues) => {
    if (!tenant?.id) {
      toast.error('Tenant not found');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          business_name: data.business_name,
          owner_name: data.owner_name,
          owner_email: data.owner_email,
          phone: data.phone || null,
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('General settings saved successfully');
      logger.info('Tenant general settings updated', { tenantId: tenant.id });
    } catch (error) {
      logger.error('Error saving general settings:', error);
      toast.error('Failed to save general settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Building className="h-5 w-5" />
        General Settings
      </h3>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="business_name">Business Name *</Label>
          <Input
            id="business_name"
            {...form.register('business_name')}
            placeholder="Enter business name"
          />
          {form.formState.errors.business_name && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.business_name.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="owner_name">Owner Name *</Label>
          <Input
            id="owner_name"
            {...form.register('owner_name')}
            placeholder="Enter owner name"
          />
          {form.formState.errors.owner_name && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.owner_name.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="owner_email">Owner Email *</Label>
          <Input
            id="owner_email"
            type="email"
            {...form.register('owner_email')}
            placeholder="owner@example.com"
          />
          {form.formState.errors.owner_email && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.owner_email.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            {...form.register('phone')}
            placeholder="+1 (555) 123-4567"
          />
          {form.formState.errors.phone && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            {...form.register('address')}
            placeholder="Enter business address"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...form.register('description')}
            placeholder="Brief description of your business"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            {...form.register('website')}
            placeholder="https://example.com"
          />
          {form.formState.errors.website && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.website.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save General Settings
        </Button>
      </form>
    </Card>
  );
}

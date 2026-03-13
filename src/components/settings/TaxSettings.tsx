import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Receipt, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';

const taxSchema = z.object({
  enabled: z.boolean(),
  rate: z.number().min(0).max(100),
  tax_id_number: z.string().optional().or(z.literal('')),
  apply_to_delivery: z.boolean(),
  inclusive: z.boolean(),
});

type TaxFormValues = z.infer<typeof taxSchema>;

export function TaxSettings() {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<TaxFormValues>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      enabled: false,
      rate: 0,
      tax_id_number: '',
      apply_to_delivery: false,
      inclusive: false,
    },
  });

  useEffect(() => {
    const loadTaxSettings = async () => {
      if (!tenant?.id) return;

      // Load from tenant metadata
      const { data } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (data?.metadata) {
        const tax = (data.metadata as Record<string, unknown>).tax as Record<
          string,
          unknown
        > | undefined;
        if (tax) {
          form.reset({
            enabled: tax.enabled as boolean,
            rate: tax.rate as number,
            tax_id_number: tax.tax_id_number as string,
            apply_to_delivery: tax.apply_to_delivery as boolean,
            inclusive: tax.inclusive as boolean,
          });
        }
      }
    };

    loadTaxSettings();
  }, [tenant, form]);

  const onSubmit = async (data: TaxFormValues) => {
    if (!tenant?.id) {
      toast.error('Tenant not found');
      return;
    }

    setLoading(true);
    try {
      // Get current metadata
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      const currentMetadata = (tenantData?.metadata as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('tenants')
        .update({
          metadata: {
            ...currentMetadata,
            tax: data,
          },
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('Tax settings saved successfully');
      logger.info('Tax settings updated', { tenantId: tenant.id });
    } catch (error) {
      logger.error('Error saving tax settings:', error);
      toast.error('Failed to save tax settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Receipt className="h-5 w-5" />
        Tax Configuration
      </h3>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Tax Collection</Label>
            <p className="text-sm text-muted-foreground">Collect sales tax on orders</p>
          </div>
          <Switch
            checked={form.watch('enabled')}
            onCheckedChange={(checked) => form.setValue('enabled', checked)}
          />
        </div>

        <div>
          <Label htmlFor="rate">Tax Rate (%)</Label>
          <Input
            id="rate"
            type="number"
            step="0.01"
            {...form.register('rate', { valueAsNumber: true })}
            placeholder="8.50"
            disabled={!form.watch('enabled')}
          />
          {form.formState.errors.rate && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.rate.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="tax_id_number">Tax ID Number</Label>
          <Input
            id="tax_id_number"
            {...form.register('tax_id_number')}
            placeholder="XX-XXXXXXX"
            disabled={!form.watch('enabled')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Apply Tax to Delivery Fees</Label>
            <p className="text-sm text-muted-foreground">Include delivery fees in tax calculation</p>
          </div>
          <Switch
            checked={form.watch('apply_to_delivery')}
            onCheckedChange={(checked) => form.setValue('apply_to_delivery', checked)}
            disabled={!form.watch('enabled')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Tax Inclusive Pricing</Label>
            <p className="text-sm text-muted-foreground">Prices already include tax</p>
          </div>
          <Switch
            checked={form.watch('inclusive')}
            onCheckedChange={(checked) => form.setValue('inclusive', checked)}
            disabled={!form.watch('enabled')}
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Tax Settings
        </Button>
      </form>
    </Card>
  );
}

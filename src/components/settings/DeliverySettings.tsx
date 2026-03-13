import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Truck, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';

const deliverySettingsSchema = z.object({
  enabled: z.boolean(),
  default_fee: z.number().min(0),
  free_delivery_threshold: z.number().min(0),
  max_delivery_distance_km: z.number().min(1),
  estimated_delivery_time_min: z.number().min(15),
});

type DeliverySettingsFormValues = z.infer<typeof deliverySettingsSchema>;

export function DeliverySettings() {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<DeliverySettingsFormValues>({
    resolver: zodResolver(deliverySettingsSchema),
    defaultValues: {
      enabled: true,
      default_fee: 5.0,
      free_delivery_threshold: 50.0,
      max_delivery_distance_km: 10,
      estimated_delivery_time_min: 45,
    },
  });

  useEffect(() => {
    const loadSettings = async () => {
      if (!tenant?.id) return;

      const { data } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (data?.metadata) {
        const settings = (data.metadata as Record<string, unknown>)
          .delivery_settings as DeliverySettingsFormValues | undefined;
        if (settings) {
          form.reset(settings);
        }
      }
    };

    loadSettings();
  }, [tenant, form]);

  const onSubmit = async (data: DeliverySettingsFormValues) => {
    if (!tenant?.id) {
      toast.error('Tenant not found');
      return;
    }

    setLoading(true);
    try {
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
            delivery_settings: data,
          },
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('Delivery settings saved successfully');
      logger.info('Delivery settings updated', { tenantId: tenant.id });
    } catch (error) {
      logger.error('Error saving delivery settings:', error);
      toast.error('Failed to save delivery settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Truck className="h-5 w-5" />
        Delivery Settings
      </h3>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Delivery</Label>
            <p className="text-sm text-muted-foreground">Offer delivery to customers</p>
          </div>
          <Switch
            checked={form.watch('enabled')}
            onCheckedChange={(checked) => form.setValue('enabled', checked)}
          />
        </div>

        <div>
          <Label htmlFor="default_fee">Default Delivery Fee ($)</Label>
          <Input
            id="default_fee"
            type="number"
            step="0.01"
            {...form.register('default_fee', { valueAsNumber: true })}
            disabled={!form.watch('enabled')}
          />
        </div>

        <div>
          <Label htmlFor="free_delivery_threshold">Free Delivery Threshold ($)</Label>
          <Input
            id="free_delivery_threshold"
            type="number"
            step="0.01"
            {...form.register('free_delivery_threshold', { valueAsNumber: true })}
            disabled={!form.watch('enabled')}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Orders above this amount get free delivery
          </p>
        </div>

        <div>
          <Label htmlFor="max_delivery_distance_km">Max Delivery Distance (km)</Label>
          <Input
            id="max_delivery_distance_km"
            type="number"
            {...form.register('max_delivery_distance_km', { valueAsNumber: true })}
            disabled={!form.watch('enabled')}
          />
        </div>

        <div>
          <Label htmlFor="estimated_delivery_time_min">
            Estimated Delivery Time (minutes)
          </Label>
          <Input
            id="estimated_delivery_time_min"
            type="number"
            {...form.register('estimated_delivery_time_min', { valueAsNumber: true })}
            disabled={!form.watch('enabled')}
          />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </form>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Clock, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';

const daySchema = z.object({
  enabled: z.boolean(),
  open: z.string(),
  close: z.string(),
});

const businessHoursSchema = z.object({
  monday: daySchema,
  tuesday: daySchema,
  wednesday: daySchema,
  thursday: daySchema,
  friday: daySchema,
  saturday: daySchema,
  sunday: daySchema,
});

type BusinessHoursFormValues = z.infer<typeof businessHoursSchema>;

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function BusinessHoursSettings() {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<BusinessHoursFormValues>({
    resolver: zodResolver(businessHoursSchema),
    defaultValues: {
      monday: { enabled: true, open: '09:00', close: '17:00' },
      tuesday: { enabled: true, open: '09:00', close: '17:00' },
      wednesday: { enabled: true, open: '09:00', close: '17:00' },
      thursday: { enabled: true, open: '09:00', close: '17:00' },
      friday: { enabled: true, open: '09:00', close: '17:00' },
      saturday: { enabled: false, open: '10:00', close: '16:00' },
      sunday: { enabled: false, open: '10:00', close: '16:00' },
    },
  });

  useEffect(() => {
    const loadBusinessHours = async () => {
      if (!tenant?.id) return;

      const { data } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (data?.metadata) {
        const hours = (data.metadata as Record<string, unknown>).business_hours;
        if (hours) {
          form.reset(hours as BusinessHoursFormValues);
        }
      }
    };

    loadBusinessHours();
  }, [tenant, form]);

  const onSubmit = async (data: BusinessHoursFormValues) => {
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
            business_hours: data,
          },
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('Business hours saved successfully');
      logger.info('Business hours updated', { tenantId: tenant.id });
    } catch (error) {
      logger.error('Error saving business hours:', error);
      toast.error('Failed to save business hours');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5" />
        Business Hours
      </h3>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {DAYS.map((day) => (
          <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
            <div className="w-24">
              <Label className="capitalize">{day}</Label>
            </div>

            <div className="flex-1 flex items-center gap-4">
              <Switch
                checked={form.watch(`${day}.enabled`)}
                onCheckedChange={(checked) => form.setValue(`${day}.enabled`, checked)}
              />

              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  {...form.register(`${day}.open`)}
                  disabled={!form.watch(`${day}.enabled`)}
                  className="w-32"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  {...form.register(`${day}.close`)}
                  disabled={!form.watch(`${day}.enabled`)}
                  className="w-32"
                />
              </div>
            </div>
          </div>
        ))}

        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Business Hours
        </Button>
      </form>
    </Card>
  );
}

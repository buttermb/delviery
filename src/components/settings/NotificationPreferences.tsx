import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';

const notificationPrefsSchema = z.object({
  email_new_orders: z.boolean(),
  email_low_stock: z.boolean(),
  email_deliveries: z.boolean(),
  email_payments: z.boolean(),
  sms_new_orders: z.boolean(),
  sms_low_stock: z.boolean(),
  sms_deliveries: z.boolean(),
  sms_payments: z.boolean(),
});

type NotificationPrefsFormValues = z.infer<typeof notificationPrefsSchema>;

export function NotificationPreferences() {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const form = useForm<NotificationPrefsFormValues>({
    resolver: zodResolver(notificationPrefsSchema),
    defaultValues: {
      email_new_orders: true,
      email_low_stock: true,
      email_deliveries: false,
      email_payments: true,
      sms_new_orders: false,
      sms_low_stock: false,
      sms_deliveries: false,
      sms_payments: false,
    },
  });

  useEffect(() => {
    const loadPreferences = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !tenant?.id) return;

      setUserId(user.id);

      // Load from profiles metadata
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.metadata) {
        const prefs = (profile.metadata as Record<string, unknown>)
          .notification_preferences as Record<string, boolean> | undefined;
        if (prefs) {
          form.reset(prefs as NotificationPrefsFormValues);
        }
      }
    };

    loadPreferences();
  }, [tenant, form]);

  const onSubmit = async (data: NotificationPrefsFormValues) => {
    if (!userId || !tenant?.id) {
      toast.error('User not found');
      return;
    }

    setLoading(true);
    try {
      // Get current metadata
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('user_id', userId)
        .maybeSingle();

      const currentMetadata = (profile?.metadata as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('profiles')
        .update({
          metadata: {
            ...currentMetadata,
            notification_preferences: data,
          },
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Notification preferences saved successfully');
      logger.info('Notification preferences updated', { userId, tenantId: tenant.id });
    } catch (error) {
      logger.error('Error saving notification preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5" />
        Notification Preferences
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Configure when you want to receive email and SMS notifications.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium">Email Notifications</h4>

          <div className="flex items-center justify-between">
            <div>
              <Label>New Orders</Label>
              <p className="text-sm text-muted-foreground">Get notified when new orders are placed</p>
            </div>
            <Switch
              checked={form.watch('email_new_orders')}
              onCheckedChange={(checked) => form.setValue('email_new_orders', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Low Stock Alerts</Label>
              <p className="text-sm text-muted-foreground">Receive alerts when products are low on stock</p>
            </div>
            <Switch
              checked={form.watch('email_low_stock')}
              onCheckedChange={(checked) => form.setValue('email_low_stock', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Deliveries</Label>
              <p className="text-sm text-muted-foreground">Updates on delivery status changes</p>
            </div>
            <Switch
              checked={form.watch('email_deliveries')}
              onCheckedChange={(checked) => form.setValue('email_deliveries', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Payments</Label>
              <p className="text-sm text-muted-foreground">Payment received and failed notifications</p>
            </div>
            <Switch
              checked={form.watch('email_payments')}
              onCheckedChange={(checked) => form.setValue('email_payments', checked)}
            />
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <h4 className="font-medium">SMS Notifications</h4>

          <div className="flex items-center justify-between">
            <div>
              <Label>New Orders</Label>
              <p className="text-sm text-muted-foreground">Get SMS when new orders are placed</p>
            </div>
            <Switch
              checked={form.watch('sms_new_orders')}
              onCheckedChange={(checked) => form.setValue('sms_new_orders', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Low Stock Alerts</Label>
              <p className="text-sm text-muted-foreground">SMS alerts for low stock</p>
            </div>
            <Switch
              checked={form.watch('sms_low_stock')}
              onCheckedChange={(checked) => form.setValue('sms_low_stock', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Deliveries</Label>
              <p className="text-sm text-muted-foreground">SMS updates on delivery status</p>
            </div>
            <Switch
              checked={form.watch('sms_deliveries')}
              onCheckedChange={(checked) => form.setValue('sms_deliveries', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Payments</Label>
              <p className="text-sm text-muted-foreground">SMS for payment notifications</p>
            </div>
            <Switch
              checked={form.watch('sms_payments')}
              onCheckedChange={(checked) => form.setValue('sms_payments', checked)}
            />
          </div>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Preferences
        </Button>
      </form>
    </Card>
  );
}

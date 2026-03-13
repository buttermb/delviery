import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Clock, Loader2, Save } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useTenantContext } from '@/hooks/useTenantContext';

type DigestFrequency = 'daily' | 'weekly' | 'never';

interface DigestCategory {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface DigestConfig {
  frequency: DigestFrequency;
  deliveryTime: string;
  categories: DigestCategory[];
}

const DEFAULT_CATEGORIES: DigestCategory[] = [
  { id: 'orders', label: 'Orders', description: 'New and updated order summaries', enabled: true },
  { id: 'inventory', label: 'Inventory', description: 'Low stock alerts and inventory changes', enabled: true },
  { id: 'payments', label: 'Payments', description: 'Payment received and failed transactions', enabled: false },
  { id: 'delivery', label: 'Delivery', description: 'Delivery status updates and driver activity', enabled: false },
];

const DELIVERY_TIMES = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
];

function formatTime(time: string): string {
  const [hours] = time.split(':');
  const hour = parseInt(hours, 10);
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  return hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
}

export function NotificationDigestEmail() {
  const { tenantId, userId, isReady } = useTenantContext();

  const [config, setConfig] = useState<DigestConfig>({
    frequency: 'daily',
    deliveryTime: '09:00',
    categories: DEFAULT_CATEGORIES,
  });

  useEffect(() => {
    if (!isReady || !tenantId || !userId) return;

    const loadConfig = async () => {
      const { data, error } = await (supabase as any)
        .from('notification_digest_preferences')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to load digest preferences', error);
        return;
      }

      if (data) {
        setConfig({
          frequency: data.frequency ?? 'daily',
          deliveryTime: data.delivery_time ?? '09:00',
          categories: data.categories ?? DEFAULT_CATEGORIES,
        });
      }
    };

    loadConfig();
  }, [isReady, tenantId, userId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !userId) throw new Error('Missing tenant or user');

      const { error } = await (supabase as any)
        .from('notification_digest_preferences')
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            frequency: config.frequency,
            delivery_time: config.deliveryTime,
            categories: config.categories,
          },
          { onConflict: 'tenant_id,user_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Digest preferences saved');
      logger.info('Digest preferences updated', { tenantId, userId });
    },
    onError: (error) => {
      logger.error('Failed to save digest preferences', error);
      toast.error('Failed to save digest preferences');
    },
  });

  const handleCategoryToggle = (categoryId: string, enabled: boolean) => {
    setConfig((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === categoryId ? { ...cat, enabled } : cat
      ),
    }));
  };

  if (!isReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Digest
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Digest
        </CardTitle>
        <CardDescription>
          Receive a summary of activity via email on a schedule
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Frequency */}
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select
            value={config.frequency}
            onValueChange={(value: DigestFrequency) =>
              setConfig((prev) => ({ ...prev, frequency: value }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Delivery Time */}
        {config.frequency !== 'never' && (
          <>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Delivery Time
              </Label>
              <Select
                value={config.deliveryTime}
                onValueChange={(value) =>
                  setConfig((prev) => ({ ...prev, deliveryTime: value }))
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_TIMES.map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatTime(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Category Toggles */}
            <div className="space-y-4">
              <Label className="text-base">Include in Digest</Label>
              {config.categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor={`digest-${category.id}`} className="text-sm font-normal">
                      {category.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <Switch
                    id={`digest-${category.id}`}
                    checked={category.enabled}
                    onCheckedChange={(checked) => handleCategoryToggle(category.id, checked)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}

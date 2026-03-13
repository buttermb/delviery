import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Truck, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface DeliveryZone {
  id: string;
  name: string;
  min_order: number;
  delivery_fee: number;
  enabled: boolean;
}

interface DeliverySettings {
  delivery_enabled: boolean;
  min_delivery_order: number;
  default_delivery_fee: number;
  free_delivery_threshold: number;
  estimated_delivery_time: string;
  delivery_zones: DeliveryZone[];
}

const DEFAULT_SETTINGS: DeliverySettings = {
  delivery_enabled: true,
  min_delivery_order: 0,
  default_delivery_fee: 5.00,
  free_delivery_threshold: 50.00,
  estimated_delivery_time: '30-45 min',
  delivery_zones: [],
};

export default function DeliverySettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<DeliverySettings>(DEFAULT_SETTINGS);

  const { isLoading } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'delivery'),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (error) throw error;

      const record = data as Record<string, unknown> | null;
      if (record?.metadata) {
        const metadata = record.metadata as Record<string, unknown>;
        const deliverySettings = metadata.delivery_settings as DeliverySettings | undefined;
        if (deliverySettings) {
          setSettings(deliverySettings);
        }
      }

      return data;
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (newSettings: DeliverySettings) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data: currentData, error: fetchError } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentMetadata = (currentData?.metadata as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('tenants')
        .update({
          metadata: {
            ...currentMetadata,
            delivery_settings: newSettings,
          } as Record<string, unknown>,
        })
        .eq('id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'delivery') });
      toast.success('Delivery settings saved');
    },
    onError: (error) => {
      logger.error('Failed to save delivery settings', { error });
      toast.error(humanizeError(error));
    },
  });

  const handleSettingChange = (key: keyof DeliverySettings, value: unknown) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const handleAddZone = () => {
    const newZone: DeliveryZone = {
      id: `zone-${Date.now()}`,
      name: 'New Zone',
      min_order: 0,
      delivery_fee: 5.00,
      enabled: true,
    };
    const newSettings = {
      ...settings,
      delivery_zones: [...settings.delivery_zones, newZone],
    };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const handleRemoveZone = (id: string) => {
    const newSettings = {
      ...settings,
      delivery_zones: settings.delivery_zones.filter(z => z.id !== id),
    };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const handleZoneChange = (id: string, field: keyof DeliveryZone, value: unknown) => {
    const newSettings = {
      ...settings,
      delivery_zones: settings.delivery_zones.map(z =>
        z.id === id ? { ...z, [field]: value } : z
      ),
    };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Delivery Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure delivery options and zones
        </p>
      </div>

      <SettingsSection
        title="General Delivery Settings"
        description="Global delivery configuration"
        icon={Truck}
      >
        <SettingsCard>
          <SettingsRow
            label="Enable Delivery"
            description="Allow customers to request delivery"
            action={
              <Switch
                checked={settings.delivery_enabled}
                onCheckedChange={(checked) => handleSettingChange('delivery_enabled', checked)}
              />
            }
          />
          <SettingsRow
            label="Minimum Order for Delivery"
            description="Minimum order amount to qualify for delivery"
            action={
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.min_delivery_order}
                  onChange={(e) => handleSettingChange('min_delivery_order', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>
            }
          />
          <SettingsRow
            label="Default Delivery Fee"
            description="Standard delivery charge"
            action={
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.default_delivery_fee}
                  onChange={(e) => handleSettingChange('default_delivery_fee', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>
            }
          />
          <SettingsRow
            label="Free Delivery Threshold"
            description="Order amount for free delivery (0 to disable)"
            action={
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.free_delivery_threshold}
                  onChange={(e) => handleSettingChange('free_delivery_threshold', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>
            }
          />
          <SettingsRow
            label="Estimated Delivery Time"
            description="Default time estimate shown to customers"
            action={
              <Input
                value={settings.estimated_delivery_time}
                onChange={(e) => handleSettingChange('estimated_delivery_time', e.target.value)}
                placeholder="e.g., 30-45 min"
                className="w-40"
              />
            }
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Delivery Zones"
        description="Configure different zones with custom fees"
        icon={Truck}
        action={
          <Button onClick={handleAddZone} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Zone
          </Button>
        }
      >
        <SettingsCard>
          {settings.delivery_zones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No delivery zones configured. Click "Add Zone" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {settings.delivery_zones.map((zone) => (
                <div key={zone.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Zone Name</Label>
                      <Input
                        value={zone.name}
                        onChange={(e) => handleZoneChange(zone.id, 'name', e.target.value)}
                        placeholder="e.g., Downtown"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Min Order ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={zone.min_order}
                        onChange={(e) => handleZoneChange(zone.id, 'min_order', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Delivery Fee ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={zone.delivery_fee}
                        onChange={(e) => handleZoneChange(zone.id, 'delivery_fee', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={zone.enabled}
                      onCheckedChange={(checked) => handleZoneChange(zone.id, 'enabled', checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveZone(zone.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      <SaveStatusIndicator
        status={saveMutation.isPending ? 'saving' : 'saved'}
      />
    </div>
  );
}

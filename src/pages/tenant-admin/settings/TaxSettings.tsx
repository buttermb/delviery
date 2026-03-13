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
import { Receipt, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  region: string;
  enabled: boolean;
}

interface TaxSettings {
  tax_enabled: boolean;
  tax_inclusive: boolean;
  default_tax_rate: number;
  tax_rates: TaxRate[];
}

const DEFAULT_TAX_SETTINGS: TaxSettings = {
  tax_enabled: true,
  tax_inclusive: false,
  default_tax_rate: 8.5,
  tax_rates: [],
};

export default function TaxSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);

  const { isLoading } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'tax'),
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
        const taxSettings = metadata.tax_settings as TaxSettings | undefined;
        if (taxSettings) {
          setSettings(taxSettings);
        }
      }

      return data;
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (newSettings: TaxSettings) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Get current metadata
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
            tax_settings: newSettings,
          } as Record<string, unknown>,
        })
        .eq('id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'tax') });
      toast.success('Tax settings saved');
    },
    onError: (error) => {
      logger.error('Failed to save tax settings', { error });
      toast.error(humanizeError(error));
    },
  });

  const handleSettingChange = (key: keyof TaxSettings, value: unknown) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const handleAddTaxRate = () => {
    const newRate: TaxRate = {
      id: `tax-${Date.now()}`,
      name: 'New Tax Rate',
      rate: 0,
      region: '',
      enabled: true,
    };
    const newSettings = {
      ...settings,
      tax_rates: [...settings.tax_rates, newRate],
    };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const handleRemoveTaxRate = (id: string) => {
    const newSettings = {
      ...settings,
      tax_rates: settings.tax_rates.filter(r => r.id !== id),
    };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const handleTaxRateChange = (id: string, field: keyof TaxRate, value: unknown) => {
    const newSettings = {
      ...settings,
      tax_rates: settings.tax_rates.map(r =>
        r.id === id ? { ...r, [field]: value } : r
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
        <h2 className="text-2xl font-bold tracking-tight">Tax Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure tax rates and tax calculation settings
        </p>
      </div>

      <SettingsSection
        title="General Tax Settings"
        description="Global tax configuration"
        icon={Receipt}
      >
        <SettingsCard>
          <SettingsRow
            label="Enable Tax"
            description="Apply tax to orders"
            action={
              <Switch
                checked={settings.tax_enabled}
                onCheckedChange={(checked) => handleSettingChange('tax_enabled', checked)}
              />
            }
          />
          <SettingsRow
            label="Tax Inclusive Pricing"
            description="Prices include tax (vs. tax added at checkout)"
            action={
              <Switch
                checked={settings.tax_inclusive}
                onCheckedChange={(checked) => handleSettingChange('tax_inclusive', checked)}
              />
            }
          />
          <SettingsRow
            label="Default Tax Rate (%)"
            description="Fallback rate when no specific rate applies"
            action={
              <Input
                type="number"
                step="0.01"
                value={settings.default_tax_rate}
                onChange={(e) => handleSettingChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                className="w-32"
              />
            }
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Tax Rates by Region"
        description="Configure different rates for different locations"
        icon={Receipt}
        action={
          <Button onClick={handleAddTaxRate} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Rate
          </Button>
        }
      >
        <SettingsCard>
          {settings.tax_rates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No custom tax rates configured. Click "Add Rate" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {settings.tax_rates.map((rate) => (
                <div key={rate.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={rate.name}
                        onChange={(e) => handleTaxRateChange(rate.id, 'name', e.target.value)}
                        placeholder="e.g., State Sales Tax"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Region</Label>
                      <Input
                        value={rate.region}
                        onChange={(e) => handleTaxRateChange(rate.id, 'region', e.target.value)}
                        placeholder="e.g., CA, NY"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={rate.rate}
                        onChange={(e) => handleTaxRateChange(rate.id, 'rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rate.enabled}
                      onCheckedChange={(checked) => handleTaxRateChange(rate.id, 'enabled', checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveTaxRate(rate.id)}
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

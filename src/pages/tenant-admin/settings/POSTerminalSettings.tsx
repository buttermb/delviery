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
import { Monitor, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface POSTerminal {
  id: string;
  name: string;
  receipt_printer: string;
  cash_drawer: boolean;
  barcode_scanner: boolean;
  tax_display_mode: 'inclusive' | 'exclusive' | 'both';
  enabled: boolean;
}

interface POSSettings {
  terminals: POSTerminal[];
}

const DEFAULT_SETTINGS: POSSettings = {
  terminals: [],
};

export default function POSTerminalSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<POSSettings>(DEFAULT_SETTINGS);

  const { isLoading } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'pos_terminals'),
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
        const posSettings = metadata.pos_terminals as POSSettings | undefined;
        if (posSettings) {
          setSettings(posSettings);
        }
      }

      return data;
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (newSettings: POSSettings) => {
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
            pos_terminals: newSettings,
          } as Record<string, unknown>,
        })
        .eq('id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'pos_terminals') });
      toast.success('POS terminal settings saved');
    },
    onError: (error) => {
      logger.error('Failed to save POS terminal settings', { error });
      toast.error(humanizeError(error));
    },
  });

  const handleAddTerminal = () => {
    const newTerminal: POSTerminal = {
      id: `terminal-${Date.now()}`,
      name: 'New Terminal',
      receipt_printer: 'none',
      cash_drawer: false,
      barcode_scanner: false,
      tax_display_mode: 'exclusive',
      enabled: true,
    };
    const newSettings = {
      ...settings,
      terminals: [...settings.terminals, newTerminal],
    };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const handleRemoveTerminal = (id: string) => {
    const newSettings = {
      ...settings,
      terminals: settings.terminals.filter(t => t.id !== id),
    };
    setSettings(newSettings);
    saveMutation.mutate(newSettings);
  };

  const handleTerminalChange = (id: string, field: keyof POSTerminal, value: unknown) => {
    const newSettings = {
      ...settings,
      terminals: settings.terminals.map(t =>
        t.id === id ? { ...t, [field]: value } : t
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
        <h2 className="text-2xl font-bold tracking-tight">POS Terminal Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure receipt printer, cash drawer, and peripherals per terminal
        </p>
      </div>

      <SettingsSection
        title="POS Terminals"
        description="Configure each terminal's hardware and behavior"
        icon={Monitor}
        action={
          <Button onClick={handleAddTerminal} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Terminal
          </Button>
        }
      >
        <SettingsCard>
          {settings.terminals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No POS terminals configured. Click "Add Terminal" to create one.
            </div>
          ) : (
            <div className="space-y-6">
              {settings.terminals.map((terminal) => (
                <div key={terminal.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label className="text-xs">Terminal Name</Label>
                      <Input
                        value={terminal.name}
                        onChange={(e) => handleTerminalChange(terminal.id, 'name', e.target.value)}
                        placeholder="e.g., Front Counter"
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={terminal.enabled}
                        onCheckedChange={(checked) => handleTerminalChange(terminal.id, 'enabled', checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTerminal(terminal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Receipt Printer</Label>
                      <Select
                        value={terminal.receipt_printer}
                        onValueChange={(value) => handleTerminalChange(terminal.id, 'receipt_printer', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="epson-tm-t88">Epson TM-T88</SelectItem>
                          <SelectItem value="star-tsp100">Star TSP100</SelectItem>
                          <SelectItem value="browser-print">Browser Print</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Tax Display Mode</Label>
                      <Select
                        value={terminal.tax_display_mode}
                        onValueChange={(value) => handleTerminalChange(terminal.id, 'tax_display_mode', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exclusive">Tax Exclusive</SelectItem>
                          <SelectItem value="inclusive">Tax Inclusive</SelectItem>
                          <SelectItem value="both">Show Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={terminal.cash_drawer}
                        onCheckedChange={(checked) => handleTerminalChange(terminal.id, 'cash_drawer', checked)}
                      />
                      <span className="text-sm">Cash Drawer</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        checked={terminal.barcode_scanner}
                        onCheckedChange={(checked) => handleTerminalChange(terminal.id, 'barcode_scanner', checked)}
                      />
                      <span className="text-sm">Barcode Scanner</span>
                    </label>
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

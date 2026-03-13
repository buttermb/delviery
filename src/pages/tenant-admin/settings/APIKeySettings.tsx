import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Key, Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { formatSmartDate } from '@/lib/formatters';

interface APIKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used: string | null;
  enabled: boolean;
}

export default function APIKeySettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const { isLoading } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'api_keys'),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (error) throw error;

      const record = data as Record<string, unknown> | null;
      if (record?.metadata) {
        const metadata = record.metadata as Record<string, unknown>;
        const keys = metadata.api_keys as APIKey[] | undefined;
        if (keys) {
          setApiKeys(keys);
          return keys;
        }
      }

      return [];
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (newKeys: APIKey[]) => {
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
            api_keys: newKeys,
          } as Record<string, unknown>,
        })
        .eq('id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'api_keys') });
      toast.success('API keys updated');
    },
    onError: (error) => {
      logger.error('Failed to save API keys', { error });
      toast.error(humanizeError(error));
    },
  });

  const generateAPIKey = (): string => {
    const prefix = 'fiq';
    const random = crypto.randomUUID().replace(/-/g, '');
    return `${prefix}_${random}`;
  };

  const handleCreateKey = () => {
    const newKey: APIKey = {
      id: crypto.randomUUID(),
      name: 'New API Key',
      key: generateAPIKey(),
      created_at: new Date().toISOString(),
      last_used: null,
      enabled: true,
    };
    const updatedKeys = [...apiKeys, newKey];
    setApiKeys(updatedKeys);
    saveMutation.mutate(updatedKeys);
    setVisibleKeys(new Set([...visibleKeys, newKey.id]));
  };

  const handleDeleteKey = (id: string) => {
    const updatedKeys = apiKeys.filter(k => k.id !== id);
    setApiKeys(updatedKeys);
    saveMutation.mutate(updatedKeys);
  };

  const handleRenameKey = (id: string, name: string) => {
    const updatedKeys = apiKeys.map(k =>
      k.id === id ? { ...k, name } : k
    );
    setApiKeys(updatedKeys);
    saveMutation.mutate(updatedKeys);
  };

  const handleToggleKey = (id: string) => {
    const updatedKeys = apiKeys.map(k =>
      k.id === id ? { ...k, enabled: !k.enabled } : k
    );
    setApiKeys(updatedKeys);
    saveMutation.mutate(updatedKeys);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('API key copied to clipboard');
  };

  const maskKey = (key: string): string => {
    if (key.length < 12) return key;
    return `${key.slice(0, 8)}${'*'.repeat(24)}${key.slice(-4)}`;
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">API Key Management</h2>
        <p className="text-muted-foreground mt-1">
          Create and manage API keys for programmatic access
        </p>
      </div>

      <SettingsSection
        title="API Keys"
        description="Use these keys to authenticate API requests"
        icon={Key}
        action={
          <Button onClick={handleCreateKey} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Key
          </Button>
        }
      >
        <SettingsCard>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No API keys created. Click "Create Key" to generate one.
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={apiKey.name}
                          onChange={(e) => handleRenameKey(apiKey.id, e.target.value)}
                          className="max-w-xs"
                        />
                        <Badge variant={apiKey.enabled ? 'default' : 'secondary'}>
                          {apiKey.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                          readOnly
                          className="font-mono text-xs flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                        >
                          {visibleKeys.has(apiKey.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(apiKey.key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created {formatSmartDate(apiKey.created_at)}
                        {apiKey.last_used && ` • Last used ${formatSmartDate(apiKey.last_used)}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleKey(apiKey.id)}
                      >
                        {apiKey.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKey(apiKey.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      <div className="p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">Security Best Practices</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Never share your API keys publicly or commit them to version control</li>
          <li>• Rotate keys periodically and after any security incident</li>
          <li>• Use separate keys for development and production environments</li>
          <li>• Disable unused keys immediately</li>
        </ul>
      </div>

      <SaveStatusIndicator
        status={saveMutation.isPending ? 'saving' : 'saved'}
      />
    </div>
  );
}

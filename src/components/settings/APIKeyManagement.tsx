import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Key, Loader2, Plus, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { format } from 'date-fns';

interface APIKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function APIKeyManagement() {
  const { tenant } = useTenantAdminAuth();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAPIKeys();
  }, [tenant]);

  const loadAPIKeys = async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as unknown as Record<string, {from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { order: (col: string, opts: {ascending: boolean}) => Promise<{data: APIKey[] | null; error: unknown}> } } } }>).from('api_keys').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      logger.error('Error loading API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!tenant?.id || !newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }

    setCreating(true);
    try {
      // Generate a random API key
      const key = `sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      const { data, error } = await (supabase as unknown as Record<string, {from: (table: string) => { insert: (data: unknown) => { select: () => { single: () => Promise<{data: APIKey | null; error: unknown}> } } } }>).from('api_keys').insert({
        tenant_id: tenant.id,
        name: newKeyName,
        key,
        permissions: ['read', 'write'],
        is_active: true,
      }).select().single();

      if (error) throw error;

      setNewKey(key);
      toast.success('API key created successfully');
      setNewKeyName('');
      loadAPIKeys();
      logger.info('API key created', { tenantId: tenant.id, keyId: data?.id });
    } catch (error) {
      logger.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!tenant?.id) return;

    try {
      const { error } = await (supabase as unknown as Record<string, {from: (table: string) => { delete: () => { eq: (col: string, val: string) => Promise<{error: unknown}> } } }>).from('api_keys').delete().eq('id', keyId);

      if (error) throw error;

      toast.success('API key deleted successfully');
      loadAPIKeys();
      logger.info('API key deleted', { tenantId: tenant.id, keyId });
    } catch (error) {
      logger.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  };

  const maskKey = (key: string) => {
    return `${key.substring(0, 8)}${'*'.repeat(24)}${key.substring(key.length - 4)}`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key Management
        </h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {newKey ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your API key has been created. Copy it now as you won't be able to see it
                    again.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input value={newKey} readOnly className="font-mono text-sm" />
                    <Button onClick={() => handleCopyKey(newKey)} size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={() => setNewKey(null)} className="w-full">
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Production API Key"
                    />
                  </div>
                  <Button onClick={handleCreateKey} disabled={creating} className="w-full">
                    {creating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Key
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Key className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No API keys yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{apiKey.name}</h4>
                    <Badge variant={apiKey.is_active ? 'default' : 'secondary'}>
                      {apiKey.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Created {format(new Date(apiKey.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
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
                    size="sm"
                    onClick={() => handleCopyKey(apiKey.key)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteKey(apiKey.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <p className="text-sm font-mono bg-muted p-2 rounded">
                  {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                </p>
              </div>

              {apiKey.last_used_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last used {format(new Date(apiKey.last_used_at), 'MMM dd, yyyy HH:mm')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

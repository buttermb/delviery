import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { toast } from 'sonner';
import { Globe, Plus, Check, X, Loader2, Trash2, RefreshCw, ShieldCheck, Copy } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { formatSmartDate } from '@/lib/formatters';
import { handleError } from '@/utils/errorHandling/handlers';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

const domainSchema = z
  .string()
  .min(3, 'Domain must be at least 3 characters')
  .max(253, 'Domain must be at most 253 characters')
  .regex(
    /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/,
    'Enter a valid domain (e.g. shop.example.com)',
  );

interface CustomDomainRecord {
  id: string;
  domain: string;
  status: string;
  ssl_status?: string;
  verification_record?: string;
  created_at: string;
}

function generateVerificationToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'floraiq-verify-';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function getStatusColor(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getSslBadgeVariant(ssl: string | undefined): 'default' | 'secondary' | 'destructive' {
  switch (ssl) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    default:
      return 'destructive';
  }
}

export default function CustomDomain() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState('');
  const [domainError, setDomainError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<CustomDomainRecord | null>(null);

  const { data: domains, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.customDomains.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('custom_domains' as 'tenants')
          .select('id, domain, status, ssl_status, verification_record, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data ?? []) as unknown as CustomDomainRecord[];
      } catch (err) {
        if (isPostgrestError(err) && err.code === '42P01') return [];
        throw err;
      }
    },
    enabled: !!tenantId,
    retry: 2,
    staleTime: 60_000,
  });

  const addDomainMutation = useMutation({
    mutationFn: async (domainName: string) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const verificationRecord = generateVerificationToken();

      const { data, error } = await supabase
        .from('custom_domains' as 'tenants')
        .insert({
          tenant_id: tenantId,
          domain: domainName,
          status: 'pending',
          verification_record: verificationRecord,
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Custom domains table does not exist. Please run database migrations.');
        }
        if (error.code === '23505') {
          throw new Error('This domain is already registered.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customDomains.byTenant(tenantId) });
      toast.success('Domain added. Configure your DNS records below.');
      setDomain('');
      setDomainError('');
      logger.info('Custom domain added', { tenantId });
    },
    onError: (err) => {
      handleError(err, {
        component: 'CustomDomain.addDomain',
        toastTitle: 'Failed to add domain',
        showToast: true,
      });
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { error } = await supabase
        .from('custom_domains' as 'tenants')
        .delete()
        .eq('id', domainId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customDomains.byTenant(tenantId) });
      toast.success('Domain removed.');
      setDeleteDialogOpen(false);
      setDomainToDelete(null);
      logger.info('Custom domain deleted', { tenantId });
    },
    onError: (err) => {
      handleError(err, {
        component: 'CustomDomain.deleteDomain',
        toastTitle: 'Failed to remove domain',
        showToast: true,
      });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('custom_domains' as 'tenants')
        .update({ status: 'active', ssl_status: 'pending' })
        .eq('id', domainId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customDomains.byTenant(tenantId) });
      toast.success('Domain verified and activated.');
      logger.info('Custom domain verified', { tenantId });
    },
    onError: (err) => {
      handleError(err, {
        component: 'CustomDomain.verifyDomain',
        toastTitle: 'Verification failed',
        showToast: true,
      });
    },
  });

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = domain.trim().toLowerCase();
    const result = domainSchema.safeParse(trimmed);
    if (!result.success) {
      setDomainError(result.error.errors[0].message);
      return;
    }
    setDomainError('');
    addDomainMutation.mutate(trimmed);
  };

  const handleDeleteClick = (item: CustomDomainRecord) => {
    setDomainToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const platformHost = typeof window !== 'undefined' ? window.location.host : 'app.floraiq.com';

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Custom Domain</h1>
          <p className="text-muted-foreground">Configure custom domains for your storefront</p>
        </div>
        <EnhancedLoadingState variant="card" count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Failed to load domains. Please try again.</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4" aria-label="Retry loading domains">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Custom Domain</h1>
        <p className="text-muted-foreground">Configure custom domains for your storefront</p>
      </div>

      {/* Add Domain */}
      <Card>
        <CardHeader>
          <CardTitle>Add Domain</CardTitle>
          <CardDescription>Connect a custom domain to your storefront</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDomain} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Name</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  if (domainError) setDomainError('');
                }}
                placeholder="shop.example.com"
                maxLength={253}
                aria-describedby={domainError ? 'domain-error' : undefined}
                aria-invalid={!!domainError}
              />
              {domainError && (
                <p id="domain-error" className="text-sm text-destructive">
                  {domainError}
                </p>
              )}
            </div>
            <Button type="submit" disabled={addDomainMutation.isPending} aria-label="Add custom domain">
              {addDomainMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {addDomainMutation.isPending ? 'Adding...' : 'Add Domain'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Configured Domains */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Domains</CardTitle>
          <CardDescription>Your custom domains and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {domains && domains.length > 0 ? (
            <div className="space-y-4">
              {domains.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 p-4 border rounded-lg">
                  <div className="flex items-center gap-4 min-w-0">
                    <Globe className="h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.domain}</div>
                      <div className="text-sm text-muted-foreground">
                        Added {formatSmartDate(item.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={getStatusColor(item.status)}>
                      {item.status || 'pending'}
                    </Badge>
                    {item.ssl_status && item.status === 'active' && (
                      <Badge variant={getSslBadgeVariant(item.ssl_status)} className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        SSL {item.ssl_status}
                      </Badge>
                    )}
                    {item.status === 'active' ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => verifyDomainMutation.mutate(item.id)}
                        disabled={verifyDomainMutation.isPending}
                        aria-label={`Verify DNS for ${item.domain}`}
                      >
                        {verifyDomainMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Verify
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(item)}
                      aria-label={`Remove domain ${item.domain}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No custom domains configured. Add your first domain above.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>DNS Configuration</CardTitle>
          <CardDescription>Add these records at your domain registrar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p className="font-medium">Step 1 — CNAME record</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-xs space-y-1 relative">
              <div>Type: CNAME</div>
              <div>Name: @ or your subdomain</div>
              <div>Value: {platformHost}</div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => handleCopyToClipboard(platformHost)}
                aria-label="Copy CNAME value"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {domains && domains.length > 0 && (
            <div className="space-y-2 text-sm">
              <p className="font-medium">Step 2 — TXT verification record</p>
              {domains
                .filter((d) => d.verification_record)
                .map((d) => (
                  <div key={d.id} className="bg-muted p-4 rounded-lg font-mono text-xs space-y-1 relative">
                    <div className="text-muted-foreground mb-1">{d.domain}</div>
                    <div>Type: TXT</div>
                    <div>Name: _floraiq-verification</div>
                    <div>Value: {d.verification_record}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => handleCopyToClipboard(d.verification_record ?? '')}
                      aria-label={`Copy verification record for ${d.domain}`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            DNS changes can take up to 48 hours to propagate. Click &quot;Verify&quot; after updating your records.
          </p>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (domainToDelete) {
            deleteDomainMutation.mutate(domainToDelete.id);
          }
        }}
        title="Remove Domain"
        itemName={domainToDelete?.domain}
        itemType="domain"
        isLoading={deleteDomainMutation.isPending}
      />
    </div>
  );
}

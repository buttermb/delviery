import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Globe, Plus, Check, X, Loader2 } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { formatSmartDate } from '@/lib/formatters';
import { handleError } from "@/utils/errorHandling/handlers";
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { queryKeys } from '@/lib/queryKeys';

export default function CustomDomain() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState('');

  const { data: domains, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.customDomains.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('custom_domains' as 'tenants') // Supabase type limitation
          .select('id, domain, status, ssl_status, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const addDomainMutation = useMutation({
    mutationFn: async (domainName: string) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('custom_domains' as 'tenants') // Supabase type limitation
        .insert({
          tenant_id: tenantId,
          domain: domainName,
          status: 'pending',
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Custom domains table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customDomains.byTenant(tenantId) });
      toast.success("Domain has been added. Please configure DNS settings.");
      setDomain('');
    },
    onError: (error) => {
      handleError(error, {
        component: 'CustomDomain.addDomain',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) {
      toast.error("Please enter a valid domain name");
      return;
    }
    addDomainMutation.mutate(domain.trim());
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Custom Domain</h1>
          <p className="text-muted-foreground">Configure custom domains for your platform</p>
        </div>
        <EnhancedLoadingState variant="card" count={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Failed to load data. Please try again.</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Custom Domain</h1>
        <p className="text-muted-foreground">Configure custom domains for your platform</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Domain</CardTitle>
          <CardDescription>Connect your custom domain to your platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDomain} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Name</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                required
              />
            </div>
            <Button type="submit" disabled={addDomainMutation.isPending}>
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

      <Card>
        <CardHeader>
          <CardTitle>Configured Domains</CardTitle>
          <CardDescription>Your custom domains and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {domains && domains.length > 0 ? (
            <div className="space-y-4">
              {(domains as unknown as Array<{ id: string; domain: string; status: string; ssl_status?: string; created_at: string }>).map((domainItem) => (
                <div key={domainItem.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Globe className="h-5 w-5" />
                    <div>
                      <div className="font-medium">{domainItem.domain}</div>
                      <div className="text-sm text-muted-foreground">
                        Added {formatSmartDate(domainItem.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={domainItem.status === 'active' ? 'default' : 'secondary'}>
                      {domainItem.status || 'pending'}
                    </Badge>
                    {domainItem.status === 'active' ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No custom domains configured. Add your first domain to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DNS Configuration</CardTitle>
          <CardDescription>Instructions for configuring your domain</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>To use a custom domain, add the following DNS records:</p>
            <div className="bg-muted p-4 rounded-lg font-mono text-xs space-y-1">
              <div>Type: CNAME</div>
              <div>Name: @ or your subdomain</div>
              <div>Value: your-platform.com</div>
              <div className="mt-2">Type: TXT</div>
              <div>Name: @</div>
              <div>Value: [Verification code will be provided]</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


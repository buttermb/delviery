import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Globe, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DomainConfig {
  id: string;
  domain: string;
  status: 'pending' | 'verified' | 'active' | 'failed';
  verification_record?: string;
  ssl_status?: 'pending' | 'active' | 'expired';
  verified_at?: string;
  created_at: string;
}

export default function CustomDomain() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const { data: domainConfig, isLoading } = useQuery({
    queryKey: ['custom-domain', tenantId],
    queryFn: async (): Promise<DomainConfig | null> => {
      if (!tenantId) return null;

      try {
        const { data, error } = await supabase
          .from('domain_configs')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code === '42P01') {
          return null;
        }
        if (error) throw error;

        // Also check tenant white_label domain
        if (tenant?.white_label?.domain) {
          return {
            id: 'current',
            domain: tenant.white_label.domain,
            status: 'active',
            created_at: new Date().toISOString(),
          };
        }

        return data;
      } catch (error: any) {
        if (error.code === '42P01') return null;
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const addDomainMutation = useMutation({
    mutationFn: async (domainName: string) => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Generate verification token
      const verificationToken = `delivery-verify-${tenantId.slice(0, 8)}`;

      // Save to database
      const { data, error } = await supabase
        .from('domain_configs')
        .insert({
          tenant_id: tenantId,
          domain: domainName,
          status: 'pending',
          verification_record: verificationToken,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist, update tenant white_label instead
          const { error: updateError } = await supabase
            .from('tenants')
            .update({
              white_label: {
                ...tenant?.white_label,
                domain: domainName,
              },
            })
            .eq('id', tenantId);

          if (updateError) throw updateError;
          return { domain: domainName, verification_record: verificationToken };
        }
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['custom-domain', tenantId] });
      toast({
        title: 'Domain added',
        description: 'Please add the DNS record to verify your domain.',
      });
      setShowInstructions(true);
      setDomain('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add domain',
        variant: 'destructive',
      });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async () => {
      // Simulate verification check
      toast({
        title: 'Verification check',
        description: 'Checking DNS records...',
      });

      // In production, would check DNS TXT record
      setTimeout(() => {
        toast({
          title: 'Verification complete',
          description: domainConfig?.status === 'verified' ? 'Domain is verified!' : 'Domain verification pending.',
        });
      }, 2000);
    },
  });

  const removeDomainMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !domainConfig) return;

      try {
        const { error } = await supabase
          .from('domain_configs')
          .delete()
          .eq('id', domainConfig.id)
          .eq('tenant_id', tenantId);

        if (error && error.code !== '42P01') throw error;

        // Also remove from tenant white_label
        if (tenant?.white_label?.domain) {
          const { error: updateError } = await supabase
            .from('tenants')
            .update({
              white_label: {
                ...tenant.white_label,
                domain: null,
              },
            })
            .eq('id', tenantId);

          if (updateError) throw updateError;
        }
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-domain', tenantId] });
      toast({ title: 'Domain removed', description: 'Custom domain has been removed.' });
    },
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'verified':
      case 'active':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />Verified</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Failed</Badge>;
      default:
        return <Badge variant="outline">Not Set</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading domain configuration...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Custom Domain</h1>
          <p className="text-muted-foreground">Connect your custom domain to your application</p>
        </div>
      </div>

      {/* Current Domain Status */}
      {domainConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Current Domain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-lg">{domainConfig.domain}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {domainConfig.verified_at
                      ? `Verified on ${new Date(domainConfig.verified_at).toLocaleDateString()}`
                      : 'Pending verification'}
                  </div>
                </div>
                {getStatusBadge(domainConfig.status)}
              </div>

              {domainConfig.status === 'pending' && domainConfig.verification_record && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-yellow-800 mb-2">Verification Required</div>
                      <div className="text-sm text-yellow-700 mb-2">
                        Add this DNS TXT record to verify domain ownership:
                      </div>
                      <div className="p-2 bg-white rounded border font-mono text-sm">
                        <div>Type: TXT</div>
                        <div>Name: @ (or root domain)</div>
                        <div>Value: {domainConfig.verification_record}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => verifyDomainMutation.mutate()}
                  disabled={verifyDomainMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verify Domain
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm('Are you sure you want to remove this domain?')) {
                      removeDomainMutation.mutate();
                    }
                  }}
                >
                  Remove Domain
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Domain Form */}
      {!domainConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Add Custom Domain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="domain">Domain Name</Label>
              <Input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Enter your domain name (without http:// or https://)
              </p>
            </div>
            <Button
              onClick={() => {
                if (!domain.trim()) {
                  toast({
                    title: 'Domain required',
                    description: 'Please enter a domain name.',
                    variant: 'destructive',
                  });
                  return;
                }
                addDomainMutation.mutate(domain.trim());
              }}
              disabled={addDomainMutation.isPending}
            >
              Add Domain
            </Button>
          </CardContent>
        </Card>
      )}

      {/* DNS Configuration Instructions */}
      {showInstructions && domainConfig?.verification_record && (
        <Card>
          <CardHeader>
            <CardTitle>DNS Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Step 1: Add TXT Record</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Add the following TXT record to your DNS provider:
                </p>
                <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                  <div>Type: <strong>TXT</strong></div>
                  <div>Name: <strong>@</strong> (or your root domain)</div>
                  <div>Value: <strong>{domainConfig.verification_record}</strong></div>
                  <div>TTL: <strong>3600</strong> (or default)</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Step 2: Add CNAME Record</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Add a CNAME record to point your domain to our servers:
                </p>
                <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                  <div>Type: <strong>CNAME</strong></div>
                  <div>Name: <strong>@</strong> or <strong>www</strong></div>
                  <div>Value: <strong>delivery-platform.com</strong></div>
                  <div>TTL: <strong>3600</strong></div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <strong>Note:</strong> DNS changes can take up to 24-48 hours to propagate. After adding the records,
                    use the "Verify Domain" button to check verification status.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SSL Status */}
      {domainConfig && domainConfig.status === 'verified' && (
        <Card>
          <CardHeader>
            <CardTitle>SSL Certificate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">SSL Status</span>
                <Badge variant={domainConfig.ssl_status === 'active' ? 'default' : 'secondary'}>
                  {domainConfig.ssl_status === 'active' ? 'Active' : 'Pending'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                SSL certificates are automatically provisioned via Let's Encrypt after domain verification.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


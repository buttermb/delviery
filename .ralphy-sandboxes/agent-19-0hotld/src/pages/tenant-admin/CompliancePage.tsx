import { useQuery } from '@tanstack/react-query';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import { handleError } from '@/utils/errorHandling/handlers';
import { queryKeys } from '@/lib/queryKeys';

export default function CompliancePage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: compliance, isLoading } = useQuery({
    queryKey: queryKeys.compliancePage.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      try {
        const { data, error } = await supabase
          .from('compliance_settings' as 'tenants')
          .select('id, tenant_id, data_encryption, gdpr_compliant, pci_compliant, access_controls_enabled, audit_logging_enabled')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error && error.code === '42P01') return null;
        if (error && error.code === 'PGRST116') return null;
        if (error) throw error;
        return data as Record<string, unknown> | null;
      } catch (error) {
        const pgError = error as { code?: string };
        if (pgError?.code === '42P01' || pgError?.code === 'PGRST116') return null;
        handleError(error, { component: 'Compliance', toastTitle: 'Failed to load compliance status' });
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const complianceChecks = [
    {
      name: 'Data Encryption',
      status: compliance?.data_encryption === true ? 'compliant' : 'pending',
      description: 'Ensure all data is encrypted at rest and in transit',
    },
    {
      name: 'GDPR Compliance',
      status: compliance?.gdpr_compliant === true ? 'compliant' : 'pending',
      description: 'Meet GDPR data protection requirements',
    },
    {
      name: 'PCI DSS',
      status: compliance?.pci_compliant === true ? 'compliant' : 'pending',
      description: 'Payment Card Industry Data Security Standards',
    },
    {
      name: 'Access Controls',
      status: compliance?.access_controls_enabled === true ? 'compliant' : 'pending',
      description: 'Role-based access control implemented',
    },
    {
      name: 'Audit Logging',
      status: compliance?.audit_logging_enabled === true ? 'compliant' : 'pending',
      description: 'Comprehensive audit trail maintained',
    },
  ];

  if (isLoading) {
    return <EnhancedLoadingState variant="card" message="Loading compliance status..." />;
  }

  const compliantCount = complianceChecks.filter((c) => c.status === 'compliant').length;
  const totalChecks = complianceChecks.length;
  const compliancePercentage = (compliantCount / totalChecks) * 100;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Compliance</h1>
        <p className="text-muted-foreground">Regulatory compliance and security standards</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Overview</CardTitle>
          <CardDescription>Current compliance status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Compliance</span>
                <span className="text-sm font-medium">{compliantCount}/{totalChecks}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${compliancePercentage === 100 ? 'bg-primary' : compliancePercentage >= 80 ? 'bg-orange-500 dark:bg-orange-600' : 'bg-destructive'
                    }`}
                  style={{ width: `${compliancePercentage}%` }}
                />
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {compliancePercentage.toFixed(0)}% compliant
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Checks</CardTitle>
          <CardDescription>Status of compliance requirements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceChecks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  {check.status === 'compliant' ? (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium">{check.name}</div>
                    <div className="text-sm text-muted-foreground">{check.description}</div>
                  </div>
                </div>
                <Badge variant={check.status === 'compliant' ? 'default' : 'secondary'}>
                  {check.status === 'compliant' ? 'Compliant' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

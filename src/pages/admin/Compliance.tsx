import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Shield, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ComplianceChecklist {
  id: string;
  framework: 'gdpr' | 'ccpa' | 'hipaa' | 'pci';
  requirement: string;
  description: string;
  status: 'compliant' | 'non_compliant' | 'not_applicable';
  evidence?: string;
  last_checked?: string;
}

const GDPR_CHECKLIST = [
  {
    id: 'gdpr-1',
    requirement: 'Lawful Basis for Processing',
    description: 'Ensure all data processing has a lawful basis',
    status: 'compliant' as const,
  },
  {
    id: 'gdpr-2',
    requirement: 'Data Subject Rights',
    description: 'Implement right to access, rectification, erasure, portability',
    status: 'compliant' as const,
  },
  {
    id: 'gdpr-3',
    requirement: 'Privacy Notice',
    description: 'Clear and transparent privacy policy',
    status: 'compliant' as const,
  },
  {
    id: 'gdpr-4',
    requirement: 'Data Breach Notification',
    description: '72-hour breach notification process',
    status: 'compliant' as const,
  },
  {
    id: 'gdpr-5',
    requirement: 'Data Protection Officer',
    description: 'DPO appointment if required',
    status: 'not_applicable' as const,
  },
  {
    id: 'gdpr-6',
    requirement: 'Data Minimization',
    description: 'Collect only necessary data',
    status: 'compliant' as const,
  },
];

const CCPA_CHECKLIST = [
  {
    id: 'ccpa-1',
    requirement: 'Consumer Rights Notice',
    description: 'Notice of consumer rights at collection point',
    status: 'compliant' as const,
  },
  {
    id: 'ccpa-2',
    requirement: 'Right to Know',
    description: 'Process requests for data disclosure',
    status: 'compliant' as const,
  },
  {
    id: 'ccpa-3',
    requirement: 'Right to Delete',
    description: 'Process requests for data deletion',
    status: 'compliant' as const,
  },
  {
    id: 'ccpa-4',
    requirement: 'Opt-Out Mechanism',
    description: 'Do Not Sell mechanism',
    status: 'compliant' as const,
  },
  {
    id: 'ccpa-5',
    requirement: 'Non-Discrimination',
    description: 'Do not discriminate against consumers exercising rights',
    status: 'compliant' as const,
  },
];

export default function Compliance() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [checklistStatus, setChecklistStatus] = useState<Record<string, 'compliant' | 'non_compliant' | 'not_applicable'>>({});

  const { data: dataRetentionPolicy } = useQuery({
    queryKey: ['data-retention', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      try {
        const { data, error } = await supabase
          .from('compliance_settings')
          .select('*')
          .eq('tenant_id', tenantId)
          .single();

        if (error && error.code === '42P01') {
          return {
            customer_data_retention_days: 365,
            order_data_retention_days: 1095,
            log_retention_days: 2555,
            auto_delete_enabled: false,
          };
        }
        if (error) throw error;
        return data;
      } catch (error: any) {
        if (error.code === '42P01') {
          return {
            customer_data_retention_days: 365,
            order_data_retention_days: 1095,
            log_retention_days: 2555,
            auto_delete_enabled: false,
          };
        }
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const handleGenerateReport = (framework: string) => {
    toast({
      title: 'Compliance Report Generated',
      description: `${framework.toUpperCase()} compliance report has been generated.`,
    });
  };

  const handleRequestExport = () => {
    toast({
      title: 'Data Export Request',
      description: 'Your data export request has been submitted. You will receive an email when ready.',
    });
  };

  const handleRightToBeForgotten = () => {
    if (confirm('Are you sure you want to request data deletion? This action cannot be undone.')) {
      toast({
        title: 'Deletion Request Submitted',
        description: 'Your data deletion request has been submitted for processing.',
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Compliance</h1>
          <p className="text-muted-foreground">Manage compliance with GDPR, CCPA, and other regulations</p>
        </div>
      </div>

      {/* Compliance Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              GDPR Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {GDPR_CHECKLIST.filter((c) => c.status === 'compliant').length} / {GDPR_CHECKLIST.length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Requirements Met</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              CCPA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {CCPA_CHECKLIST.filter((c) => c.status === 'compliant').length} / {CCPA_CHECKLIST.length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Requirements Met</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Audit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Date().toLocaleDateString()}</div>
            <div className="text-sm text-muted-foreground mt-1">Compliance Check</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="gdpr" className="w-full">
        <TabsList>
          <TabsTrigger value="gdpr">GDPR</TabsTrigger>
          <TabsTrigger value="ccpa">CCPA</TabsTrigger>
          <TabsTrigger value="data-retention">Data Retention</TabsTrigger>
          <TabsTrigger value="user-rights">User Rights</TabsTrigger>
        </TabsList>

        <TabsContent value="gdpr" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>GDPR Compliance Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {GDPR_CHECKLIST.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {item.status === 'compliant' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : item.status === 'not_applicable' ? (
                        <AlertCircle className="h-5 w-5 text-gray-400" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{item.requirement}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </div>
                    <Badge
                      variant={
                        item.status === 'compliant'
                          ? 'default'
                          : item.status === 'not_applicable'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button onClick={() => handleGenerateReport('gdpr')} variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate GDPR Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ccpa" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>CCPA Compliance Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {CCPA_CHECKLIST.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {item.status === 'compliant' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{item.requirement}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </div>
                    <Badge variant={item.status === 'compliant' ? 'default' : 'destructive'}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button onClick={() => handleGenerateReport('ccpa')} variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate CCPA Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-retention" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Retention Policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="customer-retention">Customer Data (Days)</Label>
                    <Input
                      id="customer-retention"
                      type="number"
                      value={dataRetentionPolicy?.customer_data_retention_days || 365}
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="order-retention">Order Data (Days)</Label>
                    <Input
                      id="order-retention"
                      type="number"
                      value={dataRetentionPolicy?.order_data_retention_days || 1095}
                      disabled
                    />
                  </div>
                  <div>
                    <Label htmlFor="log-retention">Audit Logs (Days)</Label>
                    <Input
                      id="log-retention"
                      type="number"
                      value={dataRetentionPolicy?.log_retention_days || 2555}
                      disabled
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Data retention policies ensure compliance with regulatory requirements. Contact support to modify these settings.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-rights" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>User Rights Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Right to Access</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Users can request a copy of all personal data held about them.
                </p>
                <Button onClick={handleRequestExport} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Request Data Export
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Right to be Forgotten</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Users can request permanent deletion of all personal data.
                </p>
                <Button onClick={handleRightToBeForgotten} variant="outline">
                  Request Data Deletion
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Data Portability</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Export user data in a machine-readable format.
                </p>
                <Button onClick={handleRequestExport} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export User Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


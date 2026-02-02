import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Shield from "lucide-react/dist/esm/icons/shield";
import Lock from "lucide-react/dist/esm/icons/lock";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const ComplianceDashboard = () => {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["compliance-report"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!tenantUser) throw new Error("No tenant found");

      const { data, error } = await supabase.functions.invoke("compliance-report", {
        body: { tenantId: tenantUser.tenant_id, reportType: "full" }
      });

      if (error) throw error;
      return data.report;
    }
  });

  const handleEncryptAll = async (dataType: string) => {
    setIsEncrypting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke("encrypt-all-data", {
        body: { dataType, tenantId: tenantUser?.tenant_id }
      });

      if (error) throw error;

      toast.success(data.message);
      refetch();
    } catch (error: unknown) {
      toast.error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleDownloadReport = async () => {
    setIsGeneratingReport(true);
    try {
      const reportText = JSON.stringify(report, null, 2);
      const blob = new Blob([reportText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch (error: unknown) {
      toast.error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getComplianceStatus = (percentage: number) => {
    if (percentage === 100) return { label: "COMPLIANT", color: "bg-success text-success-foreground", icon: CheckCircle2 };
    if (percentage >= 90) return { label: "ACTION REQUIRED", color: "bg-warning text-warning-foreground", icon: AlertTriangle };
    return { label: "CRITICAL", color: "bg-destructive text-destructive-foreground", icon: AlertTriangle };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Compliance Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            HIPAA, GDPR, and PCI-DSS compliance monitoring
          </p>
        </div>
        <Button onClick={handleDownloadReport} disabled={isGeneratingReport}>
          Download Full Report
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medical">Medical (HIPAA)</TabsTrigger>
          <TabsTrigger value="pii">PII (GDPR)</TabsTrigger>
          <TabsTrigger value="financial">Financial (PCI-DSS)</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Compliance Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  HIPAA (Medical)
                </CardTitle>
                <CardDescription>Protected Health Information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">
                      {report?.encryption_status?.medical?.percentage?.toFixed(0)}%
                    </span>
                    <Badge className={getComplianceStatus(report?.encryption_status?.medical?.percentage || 0).color}>
                      {getComplianceStatus(report?.encryption_status?.medical?.percentage || 0).label}
                    </Badge>
                  </div>
                  <Progress value={report?.encryption_status?.medical?.percentage || 0} />
                  <div className="text-sm text-muted-foreground">
                    {report?.encryption_status?.medical?.encrypted} / {report?.encryption_status?.medical?.total_records} encrypted
                  </div>
                  {report?.encryption_status?.medical?.percentage < 100 && (
                    <Button 
                      onClick={() => handleEncryptAll('medical')} 
                      disabled={isEncrypting}
                      size="sm"
                      className="w-full"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Encrypt All Medical Data
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-500" />
                  GDPR (PII)
                </CardTitle>
                <CardDescription>Personal Identifiable Information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">
                      {report?.encryption_status?.pii?.percentage?.toFixed(0)}%
                    </span>
                    <Badge className={getComplianceStatus(report?.encryption_status?.pii?.percentage || 0).color}>
                      {getComplianceStatus(report?.encryption_status?.pii?.percentage || 0).label}
                    </Badge>
                  </div>
                  <Progress value={report?.encryption_status?.pii?.percentage || 0} />
                  <div className="text-sm text-muted-foreground">
                    {report?.encryption_status?.pii?.encrypted} / {report?.encryption_status?.pii?.total_records} encrypted
                  </div>
                  {report?.encryption_status?.pii?.percentage < 100 && (
                    <Button 
                      onClick={() => handleEncryptAll('pii')} 
                      disabled={isEncrypting}
                      size="sm"
                      className="w-full"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Encrypt All PII Data
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  PCI-DSS (Financial)
                </CardTitle>
                <CardDescription>Payment & Financial Data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">
                      {report?.encryption_status?.financial?.percentage?.toFixed(0)}%
                    </span>
                    <Badge className={getComplianceStatus(report?.encryption_status?.financial?.percentage || 0).color}>
                      {getComplianceStatus(report?.encryption_status?.financial?.percentage || 0).label}
                    </Badge>
                  </div>
                  <Progress value={report?.encryption_status?.financial?.percentage || 0} />
                  <div className="text-sm text-muted-foreground">
                    {report?.encryption_status?.financial?.encrypted} / {report?.encryption_status?.financial?.total_records} encrypted
                  </div>
                  {report?.encryption_status?.financial?.percentage < 100 && (
                    <Button 
                      onClick={() => handleEncryptAll('financial')} 
                      disabled={isEncrypting}
                      size="sm"
                      className="w-full"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Encrypt All Financial Data
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {report?.recommendations && report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Action Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.recommendations.map((rec: { priority?: string; title?: string; description?: string; category?: string; action?: string; records_affected?: number }, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Badge variant={rec.priority === 'CRITICAL' ? 'destructive' : 'default'}>
                        {rec.priority}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-semibold">{rec.category}</div>
                        <div className="text-sm text-muted-foreground">{rec.action}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Affects {rec.records_affected} records
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="medical" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>HIPAA Compliance - Medical Data</CardTitle>
              <CardDescription>Protected Health Information encryption and audit status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                  <div className="text-2xl font-bold">{report?.encryption_status?.medical?.total_records}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Encrypted</div>
                  <div className="text-2xl font-bold text-success">{report?.encryption_status?.medical?.encrypted}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Unencrypted</div>
                  <div className="text-2xl font-bold text-destructive">{report?.encryption_status?.medical?.unencrypted}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">30-Day Accesses</div>
                  <div className="text-2xl font-bold">{report?.audit_summary?.medical?.total_accesses_30d}</div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2">Compliance Status</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Encryption</span>
                    <Badge className={report?.compliance_metrics?.hipaa?.status === 'COMPLIANT' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}>
                      {report?.compliance_metrics?.hipaa?.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Audit Logging</span>
                    <Badge className="bg-success text-success-foreground">ENABLED</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pii" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>GDPR Compliance - Personal Data</CardTitle>
              <CardDescription>Personal Identifiable Information protection status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                  <div className="text-2xl font-bold">{report?.encryption_status?.pii?.total_records}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Encrypted</div>
                  <div className="text-2xl font-bold text-success">{report?.encryption_status?.pii?.encrypted}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Unencrypted</div>
                  <div className="text-2xl font-bold text-destructive">{report?.encryption_status?.pii?.unencrypted}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">30-Day Accesses</div>
                  <div className="text-2xl font-bold">{report?.audit_summary?.pii?.total_accesses_30d}</div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2">GDPR Rights</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Right to Erasure</span>
                    <Badge className="bg-success text-success-foreground">IMPLEMENTED</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Data Portability</span>
                    <Badge className="bg-success text-success-foreground">ENABLED</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Audit Logging</span>
                    <Badge className="bg-success text-success-foreground">ENABLED</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>PCI-DSS - Financial Data Security</CardTitle>
              <CardDescription>Payment and financial data protection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                  <div className="text-2xl font-bold">{report?.encryption_status?.financial?.total_records}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Encrypted</div>
                  <div className="text-2xl font-bold text-green-600">{report?.encryption_status?.financial?.encrypted}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Unencrypted</div>
                  <div className="text-2xl font-bold text-red-600">{report?.encryption_status?.financial?.unencrypted}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">30-Day Accesses</div>
                  <div className="text-2xl font-bold">{report?.audit_summary?.financial?.total_accesses_30d}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail Summary</CardTitle>
              <CardDescription>Last 30 days of data access activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Medical Data Access (HIPAA)</h4>
                <div className="text-sm space-y-1">
                  {Object.entries(report?.audit_summary?.medical?.by_type || {}).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="capitalize">{type}</span>
                      <span className="font-mono">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2">PII Access (GDPR)</h4>
                <div className="text-sm space-y-1">
                  {Object.entries(report?.audit_summary?.pii?.by_type || {}).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="capitalize">{type}</span>
                      <span className="font-mono">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
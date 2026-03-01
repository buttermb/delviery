import { useState } from 'react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ReportBuilder } from '@/components/reports/ReportBuilder';
import { Plus, Play, Calendar, Mail, Trash2, FileText } from 'lucide-react';
import { REPORT_TYPES } from '@/lib/constants/reportFields';
import { humanizeError } from '@/lib/humanizeError';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { queryKeys } from '@/lib/queryKeys';

export default function CustomReportsPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;
  const [showBuilder, setShowBuilder] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: queryKeys.customReports.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('custom_reports')
        .select('id, name, report_type, description, is_active, selected_fields, schedule, email_recipients, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from('custom_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customReports.byTenant(tenantId) });
      toast.success('Report deleted');
    },
    onError: (error: Error) => {
      toast.error('Error', { description: humanizeError(error) });
    },
  });

  const runReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      if (!tenantId) throw new Error('Tenant ID required');
      const user = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('report_executions')
        .insert({
          report_id: reportId,
          tenant_id: tenantId,
          executed_by: user.data.user?.id,
          execution_type: 'manual',
          status: 'completed',
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Report generated', { description: 'Your report is ready to view.' });
    },
    onError: (error: Error) => {
      toast.error('Error', { description: humanizeError(error) });
    },
  });

  if (isLoading) {
    return <EnhancedLoadingState variant="table" message="Loading reports..." />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Reports</h1>
          <p className="text-muted-foreground">Create and manage custom reports with scheduling and email delivery</p>
        </div>
        <Button onClick={() => setShowBuilder(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Button>
      </div>

      {reports && reports.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{report.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {REPORT_TYPES[report.report_type as keyof typeof REPORT_TYPES] || report.report_type}
                    </CardDescription>
                  </div>
                  {report.is_active && (
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.description && (
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                )}
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{report.selected_fields?.length ?? 0} fields</span>
                  </div>
                  
                  {report.schedule && report.schedule !== 'none' && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="capitalize">{report.schedule}</span>
                    </div>
                  )}
                  
                  {report.email_recipients && report.email_recipients.length > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{report.email_recipients.length} recipients</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => runReportMutation.mutate(report.id)}
                    disabled={runReportMutation.isPending}
                  >
                    <Play className="mr-2 h-3 w-3" />
                    Run
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteReportMutation.mutate(report.id)}
                    disabled={deleteReportMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">No Custom Reports Yet</p>
            <p className="text-muted-foreground mb-4">
              Create your first custom report to get started
            </p>
            <Button onClick={() => setShowBuilder(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Report
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Builder</DialogTitle>
          </DialogHeader>
          <ReportBuilder onClose={() => setShowBuilder(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

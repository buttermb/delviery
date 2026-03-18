import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Plus, Edit, Download, Trash2, Loader2 } from 'lucide-react';
import { humanizeError } from '@/lib/humanizeError';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { queryKeys } from '@/lib/queryKeys';

interface CustomReport {
  id: string;
  name: string;
  description: string | null;
  sql_query: string | null;
  query: string | null;
  format: string;
  schedule: string | null;
  created_at: string;
}

export default function CustomReports() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReport | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<CustomReport | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sql_query: '',
    query: '',
    format: 'csv',
    schedule: '',
  });

  const { data: reports, isLoading } = useQuery({
    queryKey: queryKeys.customReports.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('custom_reports' as 'tenants')
          .select('id, name, description, sql_query, query, format, schedule, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        logger.error('Failed to fetch reports', error, { component: 'CustomReports' });
        const pgError = error as { code?: string };
        if (error instanceof Error && pgError.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createReportMutation = useMutation({
    mutationFn: async (report: Partial<CustomReport>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('custom_reports' as 'tenants')
        .insert({
          tenant_id: tenantId,
          name: report.name,
          description: report.description || null,
          sql_query: report.sql_query || null,
          query: report.query || null,
          format: report.format || 'csv',
          schedule: report.schedule || null,
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Custom reports table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customReports.byTenant(tenantId) });
      toast.success('Custom report has been created.');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to create report'));
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, ...report }: CustomReport) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('custom_reports' as 'tenants')
        .update({
          name: report.name,
          description: report.description || null,
          sql_query: report.sql_query || null,
          query: report.query || null,
          format: report.format,
          schedule: report.schedule || null,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Custom reports table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customReports.byTenant(tenantId) });
      toast.success('Custom report has been updated.');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to update report'));
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      if (!tenantId) throw new Error('Tenant ID required');
      const { error } = await supabase
        .from('custom_reports' as 'tenants')
        .delete()
        .eq('id', reportId)
        .eq('tenant_id', tenantId);
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Custom reports table does not exist.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customReports.byTenant(tenantId) });
      toast.success('Custom report has been removed.');
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to delete report'));
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sql_query: '',
      query: '',
      format: 'csv',
      schedule: '',
    });
    setEditingReport(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (report: CustomReport) => {
    setEditingReport(report);
    setFormData({
      name: report.name,
      description: report.description ?? '',
      sql_query: report.sql_query ?? '',
      query: report.query ?? '',
      format: report.format || 'csv',
      schedule: report.schedule ?? '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingReport) {
      updateReportMutation.mutate({
        ...editingReport,
        ...formData,
      });
    } else {
      createReportMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <EnhancedLoadingState variant="card" message="Loading reports..." />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Custom Reports</h1>
          <p className="text-muted-foreground">Create and manage custom SQL reports</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      {reports && reports.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(reports as unknown as CustomReport[]).filter((r): r is CustomReport => !!r.id).map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <CardTitle>{report.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(report)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      try {
                        toast.loading('Generating report, please wait...');

                        const { data, error } = await supabase.functions.invoke('generate-custom-report', {
                          body: { reportId: report.id }
                        });

                        if (error) throw error;

                        // Check for error in response body (edge functions can return 200 with error)
                        if (data && typeof data === 'object' && 'error' in data && data.error) {
                          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate report');
                        }

                        if (data) {
                          // Convert to CSV
                          const items = data.data?.wholesale_orders || (data.data?.wholesale_clients ?? []);
                          if (items.length > 0) {
                            const headers = Object.keys(items[0]);
                            const csvContent = [
                              headers.join(','),
                              ...items.map((item: Record<string, unknown>) => headers.map(header =>
                                JSON.stringify(item[header] || '')
                              ).join(','))
                            ].join('\n');

                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${report.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);

                            toast.success('Report downloaded successfully');
                          } else {
                            toast.info('No data found for this report configuration');
                          }
                        }
                      } catch (error) {
                        logger.error('Download failed:', error instanceof Error ? error : new Error(String(error)), { component: 'CustomReports' });
                        toast.error('Failed to generate report', { description: humanizeError(error) });
                      }
                    }}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => {
                      setReportToDelete(report);
                      setDeleteDialogOpen(true);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{report.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Format</span>
                    <Badge>{report.format || 'csv'}</Badge>
                  </div>
                  {report.schedule && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Schedule</span>
                      <Badge variant="outline">{report.schedule}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No custom reports found. Create your first report to get started.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReport ? 'Edit Report' : 'Create Report'}</DialogTitle>
            <DialogDescription>
              Configure custom report settings and SQL query
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Report Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sql_query">SQL Query</Label>
                <Textarea
                  id="sql_query"
                  value={formData.sql_query}
                  onChange={(e) => setFormData({ ...formData, sql_query: e.target.value })}
                  placeholder="SELECT * FROM orders WHERE..."
                  className="font-mono text-sm"
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Export Format</Label>
                <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v })}>
                  <SelectTrigger id="format">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createReportMutation.isPending || updateReportMutation.isPending}
              >
                {(createReportMutation.isPending || updateReportMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingReport ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async () => {
          if (reportToDelete) {
            await deleteReportMutation.mutateAsync(reportToDelete.id);
          }
        }}
        itemType="report"
        itemName={reportToDelete?.name}
        isLoading={deleteReportMutation.isPending}
      />
    </div>
  );
}


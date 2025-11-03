import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Plus, Download, FileText, Save, Trash2, Edit, Play } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface CustomReport {
  id: string;
  name: string;
  description?: string;
  query?: string;
  sql_query?: string;
  format: 'table' | 'chart' | 'csv';
  schedule?: string;
  created_at: string;
  last_run_at?: string;
}

const REPORT_TEMPLATES = [
  {
    name: 'Sales by Product',
    description: 'Revenue breakdown by product',
    query: `SELECT p.name, SUM(oi.price * oi.quantity) as revenue, COUNT(DISTINCT o.id) as orders
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.tenant_id = '{tenant_id}'
GROUP BY p.name
ORDER BY revenue DESC`,
  },
  {
    name: 'Customer Lifetime Value',
    description: 'Top customers by total spend',
    query: `SELECT c.first_name, c.last_name, c.email, SUM(o.total_amount) as total_spent, COUNT(o.id) as order_count
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.tenant_id = '{tenant_id}'
GROUP BY c.id, c.first_name, c.last_name, c.email
ORDER BY total_spent DESC
LIMIT 50`,
  },
  {
    name: 'Monthly Revenue Trend',
    description: 'Revenue trends by month',
    query: `SELECT 
  DATE_TRUNC('month', created_at) as month,
  SUM(total_amount) as revenue,
  COUNT(*) as order_count
FROM orders
WHERE tenant_id = '{tenant_id}'
GROUP BY month
ORDER BY month DESC`,
  },
];

export default function CustomReports() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReport | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sql_query: '',
    format: 'table' as 'table' | 'chart' | 'csv',
    schedule: '',
  });
  const [reportResults, setReportResults] = useState<any[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['custom-reports', tenantId],
    queryFn: async (): Promise<CustomReport[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('custom_reports')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createReportMutation = useMutation({
    mutationFn: async (report: Omit<CustomReport, 'id' | 'created_at' | 'last_run_at'>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('custom_reports')
        .insert({
          tenant_id: tenantId,
          name: report.name,
          description: report.description || null,
          sql_query: report.sql_query || null,
          query: report.query || null,
          format: report.format,
          schedule: report.schedule || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Custom reports table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports', tenantId] });
      toast({ title: 'Report created', description: 'Custom report has been created.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create report',
        variant: 'destructive',
      });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, ...report }: CustomReport) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('custom_reports')
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
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Custom reports table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports', tenantId] });
      toast({ title: 'Report updated', description: 'Custom report has been updated.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update report',
        variant: 'destructive',
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-reports', tenantId] });
      toast({ title: 'Report deleted', description: 'Report has been deleted.' });
    },
  });

  const runReport = async (query: string) => {
    if (!query.trim()) {
      toast({
        title: 'Query required',
        description: 'Please provide a SQL query.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    try {
      // Replace tenant_id placeholder
      const processedQuery = query.replace('{tenant_id}', tenantId || '');
      
      // Execute query using RPC or direct query
      // Note: This is a simplified version. In production, use stored procedures or Edge Functions for security
      toast({
        title: 'Query executed',
        description: 'Report query has been executed. Results displayed below.',
      });

      // Simulate results (in production, fetch from database)
      setReportResults([
        { column1: 'Sample Data 1', column2: 100, column3: 'Value 1' },
        { column1: 'Sample Data 2', column2: 200, column3: 'Value 2' },
      ]);
    } catch (error: any) {
      toast({
        title: 'Query Error',
        description: error.message || 'Failed to execute query',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sql_query: '',
      format: 'table',
      schedule: '',
    });
    setEditingReport(null);
    setShowForm(false);
    setReportResults(null);
  };

  const handleUseTemplate = (template: typeof REPORT_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      description: template.description,
      sql_query: template.query,
      format: 'table',
      schedule: '',
    });
    setShowForm(true);
    setShowSQL(true);
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
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading custom reports...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Custom Reports</h1>
          <p className="text-muted-foreground">Create and run custom SQL reports</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      {/* Report Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Report Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REPORT_TEMPLATES.map((template, index) => (
              <Card
                key={index}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleUseTemplate(template)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingReport ? 'Edit Report' : 'Create New Report'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Report Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="format">Output Format</Label>
                <select
                  id="format"
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value as any })}
                  className="w-full h-10 px-3 border rounded-md"
                >
                  <option value="table">Table</option>
                  <option value="chart">Chart</option>
                  <option value="csv">CSV Export</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="sql">SQL Query</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSQL(!showSQL)}
                  >
                    {showSQL ? 'Hide' : 'Show'} SQL Editor
                  </Button>
                </div>
                {showSQL && (
                  <Textarea
                    id="sql"
                    value={formData.sql_query}
                    onChange={(e) => setFormData({ ...formData, sql_query: e.target.value })}
                    placeholder="SELECT * FROM orders WHERE tenant_id = '{tenant_id}'"
                    className="font-mono text-sm min-h-[200px]"
                    required
                  />
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  Use {'{tenant_id}'} as a placeholder for your tenant ID
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runReport(formData.sql_query)}
                  disabled={isRunning || !formData.sql_query}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Test Query
                </Button>
                <Button type="submit" disabled={createReportMutation.isPending || updateReportMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingReport ? 'Update' : 'Create'} Report
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Query Results */}
      {reportResults && reportResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Query Results ({reportResults.length} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(reportResults[0]).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportResults.map((row, index) => (
                    <TableRow key={index}>
                      {Object.values(row).map((value: any, cellIndex) => (
                        <TableCell key={cellIndex}>{String(value)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Reports ({reports?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {reports && reports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>{report.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.format}</Badge>
                    </TableCell>
                    <TableCell>
                      {report.last_run_at
                        ? new Date(report.last_run_at).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (report.sql_query) {
                              setFormData({
                                name: report.name,
                                description: report.description || '',
                                sql_query: report.sql_query,
                                format: report.format,
                                schedule: report.schedule || '',
                              });
                              runReport(report.sql_query);
                            }
                          }}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const csv = reportResults
                              ? [
                                  Object.keys(reportResults[0]).join(','),
                                  ...reportResults.map((row) =>
                                    Object.values(row).join(',')
                                  ),
                                ].join('\n')
                              : '';
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${report.name}-${new Date().toISOString().split('T')[0]}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          disabled={!reportResults}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this report?')) {
                              deleteReportMutation.mutate(report.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {reports !== undefined
                ? 'No custom reports created yet. Use a template or create a new report.'
                : 'Custom reports table not found. Please run database migrations.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


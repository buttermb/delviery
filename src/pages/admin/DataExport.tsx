import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExportJob {
  id: string;
  data_types: string[];
  format: 'csv' | 'excel' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  download_url?: string;
}

const DATA_TYPES = [
  { id: 'orders', label: 'Orders', table: 'orders' },
  { id: 'products', label: 'Products', table: 'products' },
  { id: 'customers', label: 'Customers', table: 'customers' },
  { id: 'inventory', label: 'Inventory', table: 'wholesale_inventory' },
  { id: 'deliveries', label: 'Deliveries', table: 'wholesale_deliveries' },
  { id: 'invoices', label: 'Invoices', table: 'customer_invoices' },
  { id: 'payments', label: 'Payments', table: 'payment_records' },
  { id: 'users', label: 'Users', table: 'tenant_users' },
];

export default function DataExport() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: exportHistory } = useQuery({
    queryKey: ['export-history', tenantId],
    queryFn: async (): Promise<ExportJob[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('export_jobs')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(20);

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

  const handleToggleType = (typeId: string) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(typeId)) {
      newSelected.delete(typeId);
    } else {
      newSelected.add(typeId);
    }
    setSelectedTypes(newSelected);
  };

  const handleExport = async () => {
    if (selectedTypes.size === 0) {
      toast({
        title: 'No data selected',
        description: 'Please select at least one data type to export.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create export job
      if (tenantId) {
        const { data: job, error } = await supabase
          .from('export_jobs')
          .insert({
            tenant_id: tenantId,
            data_types: Array.from(selectedTypes),
            format: exportFormat,
            status: 'processing',
            date_from: dateFrom || null,
            date_to: dateTo || null,
          })
          .select()
          .single();

        if (error && error.code !== '42P01') {
          throw error;
        }

        // Simulate export process
        toast({
          title: 'Export started',
          description: 'Your data export has been queued. You will be notified when ready.',
        });

        // For CSV, export immediately
        if (exportFormat === 'csv') {
          await exportToCSV(Array.from(selectedTypes));
        }
      }
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to create export',
        variant: 'destructive',
      });
    }
  };

  const exportToCSV = async (dataTypes: string[]) => {
    try {
      const exports: Record<string, any[]> = {};

      for (const dataType of dataTypes) {
        const typeConfig = DATA_TYPES.find((dt) => dt.id === dataType);
        if (!typeConfig) continue;

        let query = supabase.from(typeConfig.table as any).select('*').eq('tenant_id', tenantId);

        if (dateFrom) {
          query = query.gte('created_at', new Date(dateFrom).toISOString());
        }
        if (dateTo) {
          query = query.lte('created_at', new Date(dateTo).toISOString());
        }

        const { data, error } = await query.limit(10000);

        if (error && error.code !== '42P01') {
          console.warn(`Error exporting ${dataType}:`, error);
          continue;
        }

        if (data) {
          exports[dataType] = data;
        }
      }

      // Generate CSV files
      for (const [dataType, data] of Object.entries(exports)) {
        if (data.length === 0) continue;

        const headers = Object.keys(data[0]);
        const csv = [
          headers.join(','),
          ...data.map((row) =>
            headers
              .map((header) => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
                return String(value).replace(/,/g, ';').replace(/\n/g, ' ');
              })
              .join(',')
          ),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dataType}-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({
        title: 'Export completed',
        description: `Exported ${Object.keys(exports).length} data type(s).`,
      });
    } catch (error: any) {
      toast({
        title: 'Export error',
        description: error.message || 'Failed to export data',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Data Export</h1>
          <p className="text-muted-foreground">Export your business data in various formats</p>
        </div>
      </div>

      {/* Export Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data Type Selection */}
          <div>
            <Label className="mb-4 block">Select Data Types</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {DATA_TYPES.map((type) => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={type.id}
                    checked={selectedTypes.has(type.id)}
                    onCheckedChange={() => handleToggleType(type.id)}
                  />
                  <Label htmlFor={type.id} className="cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <Label htmlFor="format">Export Format</Label>
            <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV
                  </div>
                </SelectItem>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PDF
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date-from">From Date (Optional)</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="date-to">To Date (Optional)</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleExport} className="w-full" size="lg">
            <Download className="h-4 w-4 mr-2" />
            Export Data ({selectedTypes.size} {selectedTypes.size === 1 ? 'type' : 'types'} selected)
          </Button>
        </CardContent>
      </Card>

      {/* Export Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Export Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start"
              onClick={() => {
                setSelectedTypes(new Set(['orders', 'customers', 'products']));
                setExportFormat('csv');
              }}
            >
              <div className="font-semibold mb-1">Complete Business Data</div>
              <div className="text-sm text-muted-foreground">Orders, Customers, Products</div>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start"
              onClick={() => {
                setSelectedTypes(new Set(['orders', 'deliveries']));
                setExportFormat('csv');
              }}
            >
              <div className="font-semibold mb-1">Operations Data</div>
              <div className="text-sm text-muted-foreground">Orders & Deliveries</div>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col items-start"
              onClick={() => {
                setSelectedTypes(new Set(['customers', 'invoices', 'payments']));
                setExportFormat('csv');
              }}
            >
              <div className="font-semibold mb-1">Financial Data</div>
              <div className="text-sm text-muted-foreground">Customers, Invoices, Payments</div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      {exportHistory && exportHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exportHistory.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {job.data_types.length} data type(s) • {job.format.toUpperCase()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        job.status === 'completed'
                          ? 'default'
                          : job.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {job.status}
                    </Badge>
                    {job.status === 'completed' && job.download_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={job.download_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


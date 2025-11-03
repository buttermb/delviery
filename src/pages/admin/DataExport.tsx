import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Database, FileSpreadsheet } from 'lucide-react';

export default function DataExport() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const [exportType, setExportType] = useState<string>('');
  const [format, setFormat] = useState<string>('csv');

  const { data: exportHistory } = useQuery({
    queryKey: ['data-export-history', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('data_exports' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const handleExport = async () => {
    if (!exportType) {
      toast({
        title: 'Missing Information',
        description: 'Please select a data type to export',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Export Started',
      description: `Exporting ${exportType} as ${format}...`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Export</h1>
        <p className="text-muted-foreground">Export your data in various formats</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Select data type and format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Type</label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="deliveries">Deliveries</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Export Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>Recent export operations</CardDescription>
          </CardHeader>
          <CardContent>
            {exportHistory && exportHistory.length > 0 ? (
              <div className="space-y-2">
                {exportHistory.map((exportItem: any) => (
                  <div key={exportItem.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{exportItem.data_type || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(exportItem.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Badge>{exportItem.format || 'csv'}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No export history. Exports will appear here once you start exporting data.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


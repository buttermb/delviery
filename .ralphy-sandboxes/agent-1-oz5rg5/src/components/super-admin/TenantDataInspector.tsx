/**
 * Tenant Data Inspector
 * View all data for a specific tenant with filtering and search
 * Inspired by DBeaver's data browser
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, Eye, Database } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface TenantDataInspectorProps {
  tenantId: string;
}

const tenantTables = [
  'wholesale_orders',
  'customers',
  'products',
  'inventory_batches',
  'customer_activities',
  'customer_communications',
];

export function TenantDataInspector({ tenantId }: TenantDataInspectorProps) {
  const { toast } = useToast();
  const [selectedTable, setSelectedTable] = useState<string>('wholesale_orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(100);

  const { data: tableData, isLoading } = useQuery({
    queryKey: ['tenant-data', tenantId, selectedTable, searchTerm, limit],
    queryFn: async () => {
      // Mock data since these tables don't exist yet
      return {
        data: [],
        count: 0,
        columns: [],
      };
    },
    enabled: !!tenantId && !!selectedTable,
  });

  const handleExport = (format: 'csv' | 'json') => {
    if (!tableData?.data) return;

    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'csv') {
      const headers = tableData.columns.join(',');
      const rows = tableData.data.map((row: Record<string, unknown>) =>
        tableData.columns.map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      );
      content = [headers, ...rows].join('\n');
      filename = `${selectedTable}-${tenantId}.csv`;
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(tableData.data, null, 2);
      filename = `${selectedTable}-${tenantId}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: `Exported ${tableData.data.length} rows to ${filename}`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Tenant Data Inspector
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Table</Label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tenantTables.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Limit</Label>
            <Select
              value={limit.toString()}
              onValueChange={(val) => setLimit(parseInt(val))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
                <SelectItem value="500">500 rows</SelectItem>
                <SelectItem value="1000">1000 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex items-center justify-between">
          <Badge variant="outline">
            {tableData?.count || 0} rows found
          </Badge>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={!tableData?.data || tableData.data.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
              disabled={!tableData?.data || tableData.data.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Data Table */}
        {isLoading ? (
          <div className="h-64 bg-muted animate-pulse rounded" />
        ) : tableData?.data && tableData.data.length > 0 ? (
          <div className="border rounded-lg overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {tableData.columns.map((column) => (
                    <th key={column} scope="col" className="px-4 py-2 text-left font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.data.map((row: Record<string, unknown>, idx: number) => (
                  <tr key={idx} className="border-t hover:bg-muted/50">
                    {tableData.columns.map((column) => (
                      <td key={column} className="px-4 py-2 max-w-xs truncate">
                        {row[column] !== null && row[column] !== undefined
                          ? String(row[column])
                          : (
                              <span className="text-muted-foreground italic">NULL</span>
                            )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No data found</p>
            <p className="text-xs mt-1">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'This table appears to be empty for this tenant'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


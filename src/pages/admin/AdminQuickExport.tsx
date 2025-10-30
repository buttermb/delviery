/**
 * Quick Data Export Panel
 * Export orders, users, products with filters
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QuickExportProps {
  onExportComplete?: () => void;
}

export default function AdminQuickExport({ onExportComplete }: QuickExportProps) {
  const [exportType, setExportType] = useState<'orders' | 'users' | 'products'>('orders');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const { toast } = useToast();

  const { data: exportData, isLoading } = useQuery({
    queryKey: ['quick-export', exportType, dateRange],
    queryFn: async () => {
      let startDate: Date | null = null;
      let endDate = new Date();

      switch (dateRange) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'all':
          startDate = null;
          break;
      }

      if (customStartDate) startDate = customStartDate;
      if (customEndDate) endDate = customEndDate;

      const baseQuery = supabase
        .from(exportType as any)
        .select('*')
        .order('created_at', { ascending: false }) as any;

      if (startDate) {
        baseQuery.gte('created_at', startDate.toISOString());
      }
      baseQuery.lte('created_at', endDate.toISOString());

      const { data, error } = await baseQuery.limit(10000);
      if (error) throw error;
      return data;
    },
    enabled: false, // Don't auto-fetch
  });

  const handleExport = async () => {
    try {
      const data = exportData || [];

      let csvContent = '';
      let filename = '';

      if (exportType === 'orders') {
        filename = `orders-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
        csvContent = [
          'Order ID,User,Status,Total,Created At',
          ...data.map((order: any) => [
            order.id,
            order.user_id || 'N/A',
            order.status,
            order.total_amount || 0,
            order.created_at
          ].join(','))
        ].join('\n');
      } else if (exportType === 'users') {
        filename = `users-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
        csvContent = [
          'Email,Full Name,Phone,Age Verified,Order Count,Total Spent',
          ...data.map((user: any) => [
            user.email || 'N/A',
            user.full_name || 'N/A',
            user.phone || 'N/A',
            user.age_verified ? 'Yes' : 'No',
            user.order_count || 0,
            user.total_spent || 0
          ].join(','))
        ].join('\n');
      } else {
        filename = `products-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
        csvContent = [
          'Name,Category,Price,Stock,Created At',
          ...data.map((product: any) => [
            product.name || 'N/A',
            product.category || 'N/A',
            product.price || 0,
            product.in_stock ? 'Yes' : 'No',
            product.created_at
          ].join(','))
        ].join('\n');
      }

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: '✓ Export successful',
        description: `Exported ${data.length} records`,
      });

      onExportComplete?.();
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Quick Data Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export Type */}
        <div className="grid grid-cols-3 gap-2">
          {(['orders', 'users', 'products'] as const).map((type) => (
            <Button
              key={type}
              variant={exportType === type ? 'default' : 'outline'}
              onClick={() => setExportType(type)}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Date Range</label>
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Export Button */}
        <Button onClick={handleExport} className="w-full" disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          {isLoading ? 'Preparing...' : `Export ${exportType}`}
        </Button>
      </CardContent>
    </Card>
  );
}


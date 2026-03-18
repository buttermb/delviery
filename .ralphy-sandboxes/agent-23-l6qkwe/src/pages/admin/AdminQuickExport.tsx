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
import { toast } from 'sonner';
import { AlertCircle, Download } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { handleError } from '@/utils/errorHandling/handlers';
import { queryKeys } from '@/lib/queryKeys';

interface QuickExportProps {
  onExportComplete?: () => void;
}

export default function AdminQuickExport({ onExportComplete }: QuickExportProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [exportType, setExportType] = useState<'orders' | 'users' | 'products'>('orders');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [customStartDate, _setCustomStartDate] = useState<Date>();
  const [customEndDate, _setCustomEndDate] = useState<Date>();
  const { data: exportData, isLoading, error } = useQuery({
    queryKey: queryKeys.quickExport.byParams(exportType, dateRange, tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
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

      if (exportType === 'orders') {
        let query = supabase
          .from('orders')
          .select('*, order_items(quantity, unit_price, product:products(name))') // Attempt deep join
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (startDate) query = query.gte('created_at', startDate.toISOString());
        query = query.lte('created_at', endDate.toISOString());

        const { data: orders, error } = await query.limit(5000); // Cap at 5000 for client-safety
        if (error) throw error;

        // Fetch profiles manually for accuracy
        const userIds = [...new Set(orders.map((o: { user_id?: string }) => o.user_id).filter(Boolean))] as string[];
        const profilesMap: Record<string, { full_name?: string; email?: string }> = {};

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);

          profiles?.forEach(p => { profilesMap[p.user_id] = p; });
        }

        return orders.map((o: Record<string, unknown>) => ({
          ...o,
          user_profile: profilesMap[(o.user_id as string) ?? '']
        }));
      }

      // Default fallback for other types
      // Dynamic table - 'users' may refer to profiles table; cast needed for dynamic name
      let baseQuery = supabase
        .from(exportType as 'products')
        .select('id, name, category, price, in_stock, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (startDate) {
        baseQuery = baseQuery.gte('created_at', startDate.toISOString());
      }
      baseQuery = baseQuery.lte('created_at', endDate.toISOString());

      const { data, error } = await baseQuery.limit(10000);
      if (error) throw error;
      return data;
    },
    enabled: false, // Don't auto-fetch
  });

  const handleExport = async () => {
    try {
      const data = exportData ?? [];
      if (data.length === 0) {
        toast.error("No data to export");
        return;
      }

      let csvContent = '';
      let filename = '';

      if (exportType === 'orders') {
        filename = `orders-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
        // Prepare CSV with new fields
        const header = 'Order ID,Order Number,Status,Total,Customer Name,Customer Email,Items Summary,Created At';
        const rows = data.map((order: Record<string, unknown>) => {
          const profile = order.user_profile as { full_name?: string; email?: string } | undefined;
          const customerName = profile?.full_name || 'N/A';
          const customerEmail = profile?.email || 'N/A';

          // Format Items Summary: "2x Burger, 1x Coke"
          const items = order.order_items as Array<{ quantity: number; product?: { name?: string }; product_name?: string }> | undefined;
          const itemsSummary = items?.map((item) => {
            const productName = item.product?.name || item.product_name || 'Unknown Item';
            return `${item.quantity}x ${productName}`;
          }).join('; ') ?? '';

          return [
            order.id,
            order.order_number || (order.id as string).slice(0, 8),
            order.status,
            order.total_amount ?? 0,
            `"${customerName}"`,
            `"${customerEmail}"`,
            `"${itemsSummary.replace(/"/g, '""')}"`, // Escape quotes in items
            order.created_at
          ].join(',');
        });
        csvContent = [header, ...rows].join('\n');
      } else if (exportType === 'users') {
        filename = `users-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
        csvContent = [
          'Email,Full Name,Phone,Age Verified,Order Count,Total Spent',
          ...data.map((user: Record<string, unknown>) => [
            user.email || 'N/A',
            user.full_name || 'N/A',
            user.phone || 'N/A',
            user.age_verified ? 'Yes' : 'No',
            user.order_count ?? 0,
            user.total_spent ?? 0
          ].join(','))
        ].join('\n');
      } else {
        filename = `products-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
        csvContent = [
          'Name,Category,Price,Stock,Created At',
          ...data.map((product: Record<string, unknown>) => [
            product.name || 'N/A',
            product.category || 'N/A',
            product.price ?? 0,
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

      toast.success("Exported ${data.length} records");

      onExportComplete?.();
    } catch (error) {
      handleError(error, { component: 'AdminQuickExport', toastTitle: 'Export failed' });
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
        {isLoading && (
          <EnhancedLoadingState variant="card" message="Loading export data..." />
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Failed to load export data. Please try again.</span>
          </div>
        )}

        {/* Export Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
          <Select value={dateRange} onValueChange={(v: string) => setDateRange(v as typeof dateRange)}>
            <SelectTrigger>
              <SelectValue placeholder="Select date range" />
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


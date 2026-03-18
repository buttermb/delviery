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
import { logger } from '@/lib/logger';

interface QuickExportProps {
  onExportComplete?: () => void;
}

type ExportType = 'orders' | 'users' | 'products';
type DateRange = 'today' | 'week' | 'month' | 'all';

function getDateRange(dateRange: DateRange): { startDate: Date | null; endDate: Date } {
  const endDate = new Date();
  let startDate: Date | null = null;

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

  return { startDate, endDate };
}

function escapeCsvField(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function fetchOrders(tenantId: string, startDate: Date | null, endDate: Date) {
  let query = supabase
    .from('orders')
    .select('*, order_items(quantity, unit_price, product:products(name))')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('created_at', startDate.toISOString());
  query = query.lte('created_at', endDate.toISOString());

  const { data: orders, error } = await query.limit(5000);
  if (error) throw error;

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
    user_profile: profilesMap[(o.user_id as string) ?? ''],
  }));
}

async function fetchUsers(tenantId: string, startDate: Date | null, endDate: Date) {
  let query = supabase
    .from('tenant_users')
    .select('id, email, name, role, status, user_id, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('created_at', startDate.toISOString());
  query = query.lte('created_at', endDate.toISOString());

  const { data: tenantUsers, error } = await query.limit(10000);
  if (error) throw error;

  const userIds = tenantUsers
    .map((u) => u.user_id)
    .filter((id): id is string => id != null);

  const profilesMap: Record<string, { full_name?: string; phone?: string; age_verified?: boolean; total_orders?: number; total_spent?: number }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, age_verified, total_orders, total_spent')
      .in('user_id', userIds);

    profiles?.forEach(p => { profilesMap[p.user_id] = p; });
  }

  return tenantUsers.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    full_name: u.user_id ? profilesMap[u.user_id]?.full_name : null,
    phone: u.user_id ? profilesMap[u.user_id]?.phone : null,
    age_verified: u.user_id ? profilesMap[u.user_id]?.age_verified : null,
    total_orders: u.user_id ? profilesMap[u.user_id]?.total_orders : null,
    total_spent: u.user_id ? profilesMap[u.user_id]?.total_spent : null,
    created_at: u.created_at,
  }));
}

async function fetchProducts(tenantId: string, startDate: Date | null, endDate: Date) {
  let query = supabase
    .from('products')
    .select('id, name, category, price, in_stock, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('created_at', startDate.toISOString());
  query = query.lte('created_at', endDate.toISOString());

  const { data, error } = await query.limit(10000);
  if (error) throw error;
  return data;
}

function buildOrdersCsv(data: Record<string, unknown>[]): string {
  const header = 'Order ID,Order Number,Status,Total,Customer Name,Customer Email,Items Summary,Created At';
  const rows = data.map((order) => {
    const profile = order.user_profile as { full_name?: string; email?: string } | undefined;
    const customerName = profile?.full_name || 'N/A';
    const customerEmail = profile?.email || 'N/A';

    const items = order.order_items as Array<{ quantity: number; product?: { name?: string }; product_name?: string }> | undefined;
    const itemsSummary = items?.map((item) => {
      const productName = item.product?.name || item.product_name || 'Unknown Item';
      return `${item.quantity}x ${productName}`;
    }).join('; ') ?? '';

    return [
      escapeCsvField(order.id),
      escapeCsvField(order.order_number || (order.id as string).slice(0, 8)),
      escapeCsvField(order.status),
      order.total_amount ?? 0,
      escapeCsvField(customerName),
      escapeCsvField(customerEmail),
      escapeCsvField(itemsSummary),
      escapeCsvField(order.created_at),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

function buildUsersCsv(data: Record<string, unknown>[]): string {
  const header = 'Email,Name,Role,Status,Full Name,Phone,Age Verified,Order Count,Total Spent,Created At';
  const rows = data.map((user) => [
    escapeCsvField(user.email),
    escapeCsvField(user.name),
    escapeCsvField(user.role),
    escapeCsvField(user.status),
    escapeCsvField(user.full_name || 'N/A'),
    escapeCsvField(user.phone || 'N/A'),
    user.age_verified ? 'Yes' : 'No',
    user.total_orders ?? 0,
    user.total_spent ?? 0,
    escapeCsvField(user.created_at),
  ].join(','));
  return [header, ...rows].join('\n');
}

function buildProductsCsv(data: Record<string, unknown>[]): string {
  const header = 'Name,Category,Price,In Stock,Created At';
  const rows = data.map((product) => [
    escapeCsvField(product.name),
    escapeCsvField(product.category || 'N/A'),
    product.price ?? 0,
    product.in_stock ? 'Yes' : 'No',
    escapeCsvField(product.created_at),
  ].join(','));
  return [header, ...rows].join('\n');
}

function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function AdminQuickExport({ onExportComplete }: QuickExportProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [exportType, setExportType] = useState<ExportType>('orders');
  const [dateRange, setDateRange] = useState<DateRange>('month');

  const { data: exportData, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.quickExport.byParams(exportType, dateRange, tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { startDate, endDate } = getDateRange(dateRange);

      switch (exportType) {
        case 'orders':
          return fetchOrders(tenantId, startDate, endDate);
        case 'users':
          return fetchUsers(tenantId, startDate, endDate);
        case 'products':
          return fetchProducts(tenantId, startDate, endDate);
      }
    },
    enabled: false,
    retry: 2,
  });

  const handleExport = async () => {
    try {
      const { data: freshData } = await refetch();
      const data = freshData ?? exportData ?? [];

      if (data.length === 0) {
        toast.error('No data to export');
        return;
      }

      const dateSuffix = `${dateRange}-${new Date().toISOString().split('T')[0]}`;
      let csvContent: string;
      let filename: string;

      switch (exportType) {
        case 'orders':
          filename = `orders-${dateSuffix}.csv`;
          csvContent = buildOrdersCsv(data as Record<string, unknown>[]);
          break;
        case 'users':
          filename = `users-${dateSuffix}.csv`;
          csvContent = buildUsersCsv(data as Record<string, unknown>[]);
          break;
        case 'products':
          filename = `products-${dateSuffix}.csv`;
          csvContent = buildProductsCsv(data as Record<string, unknown>[]);
          break;
      }

      downloadCsv(csvContent, filename);
      toast.success(`Exported ${data.length} records`);
      logger.info('Quick export completed', { exportType, dateRange, recordCount: data.length });
      onExportComplete?.();
    } catch (err) {
      handleError(err, { component: 'AdminQuickExport', toastTitle: 'Export failed' });
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
          <Select value={dateRange} onValueChange={(v: string) => setDateRange(v as DateRange)}>
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

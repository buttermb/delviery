/**
 * Reports Page - Comprehensive reporting and analytics
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, FileText, Package, DollarSign, Download,
  TrendingUp, Loader2, ArrowLeft
} from 'lucide-react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { format, startOfMonth, endOfMonth, subMonths, subWeeks } from 'date-fns';
import { useWholesaleClients, useWholesaleOrders, useWholesalePayments, useWholesaleInventory } from '@/hooks/useWholesaleData';
import { useExport } from '@/hooks/useExport';
import { TakeTourButton } from '@/components/tutorial/TakeTourButton';
import { reportsTutorial } from '@/lib/tutorials/tutorialConfig';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export default function ReportsPage() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [reportType, setReportType] = useState<string>('business');
  const [searchQuery, setSearchQuery] = useState('');
  const { exportCSV } = useExport();

  const { data: clients = [], isLoading: clientsLoading } = useWholesaleClients();
  const { data: orders = [], isLoading: ordersLoading } = useWholesaleOrders();
  const { data: payments = [], isLoading: paymentsLoading } = useWholesalePayments();
  const { data: inventory = [], isLoading: inventoryLoading } = useWholesaleInventory(tenant?.id);

  const loading = clientsLoading || ordersLoading || paymentsLoading || inventoryLoading;

  // Calculate date range based on selection
  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        return { start: subWeeks(now, 1), end: now };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: subMonths(now, 3), end: now };
      case 'year':
        return { start: subMonths(now, 12), end: now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Filter data by date range
  const filteredOrders = useMemo(() => orders.filter(o => {
    const orderDate = new Date(o.created_at);
    const matchesDate = orderDate >= startDate && orderDate <= endDate;
    const matchesSearch = !searchQuery ||
      o.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.client?.business_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDate && matchesSearch;
  }), [orders, startDate, endDate, searchQuery]);

  const filteredPayments = useMemo(() => payments.filter(p => {
    const paymentDate = new Date(p.created_at);
    const matchesDate = paymentDate >= startDate && paymentDate <= endDate;
    const matchesSearch = !searchQuery ||
      p.client?.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.payment_method?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDate && matchesSearch;
  }), [payments, startDate, endDate, searchQuery]);

  // Calculate metrics
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalCollected = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Compare with previous period
  const prevStart = new Date(startDate);
  prevStart.setDate(prevStart.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at);
    return orderDate >= prevStart && orderDate < startDate;
  });
  const prevRevenue = prevOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const handleExport = () => {
    if (reportType === 'business') {
      exportCSV(
        filteredOrders.map(o => ({
          order_number: o.order_number,
          date: format(new Date(o.created_at), 'yyyy-MM-dd'),
          client: o.client?.business_name || 'N/A',
          amount: Number(o.total_amount),
          status: o.status
        })),
        [],
        `business-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
      );
    } else if (reportType === 'financial') {
      exportCSV(
        filteredPayments.map(p => ({
          date: format(new Date(p.created_at), 'yyyy-MM-dd'),
          client: p.client?.business_name || 'N/A',
          amount: Number(p.amount),
          method: p.payment_method
        })),
        [],
        `financial-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
      );
    } else if (reportType === 'inventory') {
      const inventoryRecord = inventory as unknown as Array<Record<string, unknown>>;
      exportCSV(
        inventoryRecord.map(i => ({
          product: (i.product_name as string) ?? '',
          quantity_lbs: Number(i.quantity_lbs ?? 0),
          quantity_units: (i.quantity_units as number) ?? 0,
          category: (i.category as string) || 'N/A',
          warehouse: (i.warehouse_location as string) || 'N/A',
          updated: i.updated_at ? format(new Date(i.updated_at as string), 'yyyy-MM-dd') : 'N/A'
        })),
        [],
        `inventory-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
      );
    }
  };

  // Define Columns
  const businessColumns = useMemo<ResponsiveColumn<Record<string, unknown>>[]>(() => [
    { header: 'Order #', accessorKey: 'order_number', className: 'font-mono' },
    { header: 'Date', cell: (item: Record<string, unknown>) => format(new Date(item.created_at as string), 'MMM d, yyyy') },
    { header: 'Client', cell: (item: Record<string, unknown>) => (item.client as Record<string, unknown>)?.business_name as string || 'N/A' },
    { header: 'Amount', cell: (item: Record<string, unknown>) => formatCurrency(item.total_amount as number), className: 'text-right' },
    { header: 'Status', cell: (item: Record<string, unknown>) => <Badge variant="outline">{item.status as string}</Badge> }
  ], []);

  const inventoryColumns = useMemo<ResponsiveColumn<Record<string, unknown>>[]>(() => [
    { header: 'Product', accessorKey: 'product_name', className: 'font-medium' },
    { header: 'Quantity (lbs)', accessorKey: 'quantity_lbs' },
    { header: 'Warehouse', cell: (item: Record<string, unknown>) => (item.warehouse_location as string) || 'Unassigned' },
    { header: 'Category', accessorKey: 'category' }
  ], []);

  const financialColumns = useMemo<ResponsiveColumn<Record<string, unknown>>[]>(() => [
    { header: 'Date', cell: (item: Record<string, unknown>) => format(new Date(item.created_at as string), 'MMM d, yyyy') },
    { header: 'Client', cell: (item: Record<string, unknown>) => (item.client as Record<string, unknown>)?.business_name as string || 'N/A' },
    { header: 'Amount', cell: (item: Record<string, unknown>) => formatCurrency(item.amount as number), className: 'text-right' },
    { header: 'Method', cell: (item: Record<string, unknown>) => <Badge variant="secondary">{item.payment_method as string}</Badge> }
  ], []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-4 space-y-4 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToAdmin('analytics-hub')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold mb-1 sm:mb-2">Reports</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Business intelligence and analytics</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <div className="w-full sm:w-[200px]">
            <SearchInput
              placeholder="Search..."
              onSearch={setSearchQuery}
              defaultValue={searchQuery}
            />
          </div>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)} data-tutorial="date-range">
            <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] touch-manipulation text-sm sm:text-base">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} data-tutorial="export-options" className="min-h-[44px] touch-manipulation text-sm sm:text-base flex-1 sm:flex-initial min-w-[100px]">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <TakeTourButton
            tutorialId={reportsTutorial.id}
            steps={reportsTutorial.steps}
            variant="outline"
            size="sm"
            className="min-h-[44px]"
          />
        </div>
      </div>

      <Tabs value={reportType} onValueChange={setReportType} className="space-y-4 sm:space-y-6">
        <TabsList data-tutorial="report-types" className="grid grid-cols-2 sm:grid-cols-4 h-auto w-full">
          <TabsTrigger value="business" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Business Intelligence</span>
            <span className="sm:hidden">Business</span>
          </TabsTrigger>
          <TabsTrigger value="custody" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Chain of Custody</span>
            <span className="sm:hidden">Custody</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <Package className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Inventory</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Financial</span>
            <span className="sm:hidden">Finance</span>
          </TabsTrigger>
        </TabsList>

        {/* Business Intelligence */}
        <TabsContent value="business" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <Card className="p-3 sm:p-4 md:p-6">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Revenue</div>
              <div className="text-xl sm:text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <div className={`text-xs sm:text-sm flex items-center gap-1 mt-1 ${revenueGrowth >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                <TrendingUp className="h-3 w-3" />
                {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}% vs last period
              </div>
            </Card>
            <Card className="p-3 sm:p-4 md:p-6">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">Orders</div>
              <div className="text-xl sm:text-2xl font-bold">{totalOrders}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                In selected period
              </div>
            </Card>
            <Card className="p-3 sm:p-4 md:p-6 sm:col-span-2 md:col-span-1">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">Avg Order Value</div>
              <div className="text-xl sm:text-2xl font-bold">{formatCurrency(avgOrderValue)}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                Per order
              </div>
            </Card>
          </div>

          <Card className="p-6" data-tutorial="analytics-dashboard">
            <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-2">Revenue Collected</div>
                <div className="text-3xl font-bold text-emerald-500">
                  {formatCurrency(totalCollected)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {totalRevenue > 0 ? ((totalCollected / totalRevenue) * 100).toFixed(1) : 0}% collection rate
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Active Clients</div>
                <div className="text-3xl font-bold">{clients.filter(c => c.status === 'active').length}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total clients: {clients.length}
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Recent Orders</h3>
            </div>
            <ResponsiveTable
              columns={businessColumns}
              data={filteredOrders}
              keyExtractor={(item: Record<string, unknown>) => item.id as string}
              emptyState={{ title: "No orders", description: "No orders found for this period.", icon: FileText }}
              className="border-0 rounded-none"
            />
          </Card>
        </TabsContent>

        {/* Chain of Custody */}
        <TabsContent value="custody">
          <Card className="p-6" data-tutorial="custom-reports">
            <h3 className="text-lg font-semibold mb-4">Chain of Custody Reports</h3>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Batch Tracking Report</h4>
                    <p className="text-sm text-muted-foreground">
                      Complete audit trail for all batches
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Transfer History</h4>
                    <p className="text-sm text-muted-foreground">
                      All inventory transfers and movements
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Package Scans</h4>
                    <p className="text-sm text-muted-foreground">
                      All barcode/QR code scans and verifications
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Inventory Reports */}
        <TabsContent value="inventory" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Inventory Reports</h3>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Stock Levels by Warehouse</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Current inventory levels across all locations
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Current Inventory</h3>
            </div>
            <ResponsiveTable
              columns={inventoryColumns}
              data={inventory}
              keyExtractor={(item: Record<string, unknown>) => (item.id as string) || `inventory-${item.product_name}` as string}
              emptyState={{ title: "No inventory", description: "No inventory found.", icon: Package }}
              className="border-0 rounded-none"
            />
          </Card>
        </TabsContent>

        {/* Financial Reports */}
        <TabsContent value="financial" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Financial Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">P&L Statement</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Profit and loss statement for selected period
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Cash Flow Report</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Incoming and outgoing cash flow
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Recent Payments</h3>
            </div>
            <ResponsiveTable
              columns={financialColumns}
              data={filteredPayments as unknown as Record<string, unknown>[]}
              keyExtractor={(item: Record<string, unknown>) => item.id as string}
              emptyState={{ title: "No payments", description: "No payments found for this period.", icon: DollarSign }}
              className="border-0 rounded-none"
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

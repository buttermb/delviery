/**
 * Payouts Page
 * Shows payout schedules and history for tenant admins
 * Connected to the Finance Hub
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Wallet,
  History,
  CalendarDays,
  ArrowUpRight,
  Loader2,
  Download,
  Info
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';
import { format, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable';
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar';
import type { ResponsiveColumn } from '@/components/shared/ResponsiveTable';

interface PayoutScheduleItem {
  id: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  expectedDate: Date;
  estimatedAmount: number;
  ordersCount: number;
  status: 'upcoming' | 'processing' | 'ready';
}

interface PayoutHistoryItem {
  id: string;
  amount: number;
  status: string;
  method: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export default function PayoutsPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [isExporting, setIsExporting] = useState(false);

  // Fetch payout history
  const { data: payoutHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: queryKeys.payoutsAdmin.history(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('marketplace_payouts')
          .select('id, amount, status, method, reference_id, notes, created_at, processed_at')
          .eq('seller_tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          // Table might not exist
          if (error.code === '42P01') return [];
          throw error;
        }
        return (data ?? []) as PayoutHistoryItem[];
      } catch (error) {
        logger.error('Failed to fetch payout history', error, { component: 'PayoutsPage' });
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Fetch orders that are ready for payout (delivered but not yet paid)
  const { data: pendingOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: queryKeys.payoutsAdmin.pendingOrders(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('marketplace_orders')
          .select('id, total_amount, platform_fee, status, created_at, delivered_at, payout_id')
          .eq('seller_tenant_id', tenantId)
          .is('payout_id', null)
          .neq('status', 'cancelled')
          .neq('status', 'rejected')
          .order('created_at', { ascending: false });

        if (error) {
          if (error.code === '42P01') return [];
          throw error;
        }
        return data ?? [];
      } catch (error) {
        logger.error('Failed to fetch pending orders', error, { component: 'PayoutsPage' });
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Calculate payout schedule based on pending orders
  const payoutSchedule: PayoutScheduleItem[] = (() => {
    const now = new Date();
    const schedules: PayoutScheduleItem[] = [];

    // Group orders by week for schedule
    const deliveredOrders = pendingOrders.filter(o => o.status === 'delivered');
    const pendingDeliveryOrders = pendingOrders.filter(o => o.status !== 'delivered');

    // Current week's ready payouts (delivered orders)
    if (deliveredOrders.length > 0) {
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);
      const nextPayoutDate = addDays(weekEnd, 1); // Monday after week ends

      const totalAmount = deliveredOrders.reduce((sum, o) => {
        return sum + ((o.total_amount ?? 0) - (o.platform_fee ?? 0));
      }, 0);

      schedules.push({
        id: 'current-week',
        period: `Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
        periodStart: weekStart,
        periodEnd: weekEnd,
        expectedDate: nextPayoutDate,
        estimatedAmount: totalAmount,
        ordersCount: deliveredOrders.length,
        status: 'ready',
      });
    }

    // Pending orders (not yet delivered) - estimate for next week
    if (pendingDeliveryOrders.length > 0) {
      const nextWeekStart = addDays(endOfWeek(now), 1);
      const nextWeekEnd = addDays(nextWeekStart, 6);
      const estimatedPayoutDate = addDays(nextWeekEnd, 1);

      const totalAmount = pendingDeliveryOrders.reduce((sum, o) => {
        return sum + ((o.total_amount ?? 0) - (o.platform_fee ?? 0));
      }, 0);

      schedules.push({
        id: 'next-week',
        period: `Week of ${format(nextWeekStart, 'MMM d')} - ${format(nextWeekEnd, 'MMM d')}`,
        periodStart: nextWeekStart,
        periodEnd: nextWeekEnd,
        expectedDate: estimatedPayoutDate,
        estimatedAmount: totalAmount,
        ordersCount: pendingDeliveryOrders.length,
        status: 'upcoming',
      });
    }

    return schedules;
  })();

  // Calculate summary stats
  const availableForPayout = pendingOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + ((o.total_amount ?? 0) - (o.platform_fee ?? 0)), 0);

  const pendingClearance = pendingOrders
    .filter(o => o.status !== 'delivered')
    .reduce((sum, o) => sum + ((o.total_amount ?? 0) - (o.platform_fee ?? 0)), 0);

  const totalWithdrawn = payoutHistory
    .filter((p: PayoutHistoryItem) => p.status === 'completed')
    .reduce((sum: number, p: PayoutHistoryItem) => sum + (p.amount ?? 0), 0);

  const pendingPayouts = payoutHistory
    .filter((p: PayoutHistoryItem) => p.status === 'pending' || p.status === 'processing')
    .reduce((sum: number, p: PayoutHistoryItem) => sum + (p.amount ?? 0), 0);

  // Export functionality
  const handleExportCSV = async () => {
    if (payoutHistory.length === 0) {
      showErrorToast('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      const csvRows = [
        ['Date', 'Reference', 'Method', 'Amount', 'Status', 'Processed Date'].join(','),
        ...payoutHistory.map((p: PayoutHistoryItem) => [
          format(parseISO(p.created_at), 'yyyy-MM-dd'),
          p.reference_id || '-',
          p.method || 'Manual',
          p.amount?.toFixed(2) || '0.00',
          p.status || 'pending',
          p.processed_at ? format(parseISO(p.processed_at), 'yyyy-MM-dd') : '-',
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `payouts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();

      showSuccessToast('Export Complete', 'CSV file downloaded');
    } catch (error) {
      logger.error('Export failed', error, { component: 'PayoutsPage' });
      showErrorToast('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="h-3 w-3 mr-1" /> Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getScheduleStatusBadge = (status: PayoutScheduleItem['status']) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Ready</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="h-3 w-3 mr-1" /> Processing</Badge>;
      case 'upcoming':
        return <Badge variant="secondary"><Calendar className="h-3 w-3 mr-1" /> Upcoming</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const payoutHistoryColumns: ResponsiveColumn<PayoutHistoryItem>[] = [
    {
      header: 'Date',
      accessorKey: 'created_at',
      cell: (payout) => formatSmartDate(payout.created_at)
    },
    {
      header: 'Reference',
      accessorKey: 'reference_id',
      cell: (payout) => <span className="font-mono text-xs">{payout.reference_id || '-'}</span>
    },
    {
      header: 'Method',
      accessorKey: 'method',
      cell: (payout) => <span className="capitalize">{payout.method || 'Manual'}</span>
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (payout) => getStatusBadge(payout.status)
    },
    {
      header: 'Processed',
      accessorKey: 'processed_at',
      cell: (payout) => payout.processed_at ? formatSmartDate(payout.processed_at) : '-'
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      cell: (payout) => <span className="font-bold">{formatCurrency(payout.amount)}</span>
    }
  ];

  if (isLoadingHistory || isLoadingOrders) {
    return (
      <div className="p-6">
        <EnhancedLoadingState variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-background border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available for Payout</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(availableForPayout)}</div>
            <p className="text-xs text-muted-foreground mt-1">From delivered orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-background border-yellow-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Clearance</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingClearance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Orders in progress</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-background border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(pendingPayouts)}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting transfer</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-background border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Withdrawn</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalWithdrawn)}</div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Schedule and History */}
      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Payout Schedule
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Payout History
          </TabsTrigger>
        </TabsList>

        {/* Payout Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Upcoming Payouts
                  </CardTitle>
                  <CardDescription>
                    Your scheduled payout periods and estimated amounts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {payoutSchedule.length > 0 ? (
                <div className="space-y-4">
                  {payoutSchedule.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="font-semibold">{schedule.period}</div>
                          {getScheduleStatusBadge(schedule.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expected: {format(schedule.expectedDate, 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {schedule.ordersCount} orders
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(schedule.estimatedAmount)}
                        </div>
                        <div className="text-xs text-muted-foreground">Estimated payout</div>
                      </div>
                    </div>
                  ))}

                  {/* Info about payout processing */}
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Payout Schedule Information</p>
                      <p>Payouts are processed weekly. Orders must be marked as delivered before they become available for payout. Platform fees are automatically deducted from each order.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <EnhancedEmptyState type="generic" compact
                  icon={CalendarDays}
                  title="No Scheduled Payouts"
                  description="You'll see upcoming payouts here once you have delivered orders ready for payout."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payout History Tab */}
        <TabsContent value="history" className="space-y-4">
          <AdminToolbar
            hideSearch={true}
            actions={
              <Button
                variant="outline"
                onClick={handleExportCSV}
                disabled={isExporting || payoutHistory.length === 0}
                className="gap-2"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export History
              </Button>
            }
          />
          <AdminDataTable
            data={payoutHistory}
            keyExtractor={(payout) => payout.id}
            isLoading={isLoadingHistory}
            columns={payoutHistoryColumns}
            emptyStateIcon={History}
            emptyStateTitle="No Payout History"
            emptyStateDescription="Your payout history will appear here once you receive your first payout."
          />
        </TabsContent>
      </Tabs>

      {/* Footer info */}
      <div className="text-center text-sm text-muted-foreground pt-4 border-t">
        Payouts are processed weekly. Need help?{' '}
        <span className="underline hover:text-foreground cursor-default">Contact Support</span>
      </div>
    </div>
  );
}

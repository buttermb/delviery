/**
 * CustomerPaymentHistoryTab Component
 *
 * Displays complete payment history for a customer with DataTable.
 * Shows all payments across all orders with date, amount, method, order reference, status.
 * Includes running total of paid vs outstanding, payment trends chart, and links to records.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Calendar,
  Filter,
  X,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/shared/DataTable';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { OrderLink } from '@/components/admin/cross-links';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useIsMobile } from '@/hooks/use-mobile';

interface CustomerPaymentHistoryTabProps {
  customerId: string;
}

interface Payment {
  id: string;
  created_at: string;
  amount: number;
  payment_method: string | null;
  payment_status: string | null;
  order_id: string | null;
  reference_number: string | null;
  notes: string | null;
}

interface Order {
  id: string;
  total_amount: number;
  payment_status: string | null;
}

type PaymentStatus = 'all' | 'completed' | 'pending' | 'failed' | 'refunded';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getPaymentStatusStyles(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'paid':
    case 'success':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'pending':
    case 'processing':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
    case 'failed':
    case 'declined':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
    case 'refunded':
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
  }
}

function getPaymentMethodIcon(method: string | null): string {
  switch (method?.toLowerCase()) {
    case 'credit_card':
    case 'card':
      return 'Card';
    case 'cash':
      return 'Cash';
    case 'check':
      return 'Check';
    case 'bank_transfer':
    case 'wire':
    case 'ach':
      return 'Bank';
    case 'crypto':
      return 'Crypto';
    default:
      return 'Payment';
  }
}

export function CustomerPaymentHistoryTab({ customerId }: CustomerPaymentHistoryTabProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const isMobile = useIsMobile();
  const tenantId = tenant?.id;

  // Filter state
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Fetch customer payments
  const {
    data: payments,
    isLoading: paymentsLoading,
    isError: paymentsError,
    error: paymentsErrorObj,
  } = useQuery({
    queryKey: queryKeys.customerDetail.payments(customerId, tenantId),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const { data, error: queryError } = await supabase
        .from('customer_payments')
        .select(`
          id,
          created_at,
          amount,
          payment_method,
          payment_status,
          order_id,
          notes
        `)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (queryError) {
        logger.error('Failed to fetch customer payments', queryError, { customerId, tenantId });
        throw queryError;
      }

      return (data ?? []) as unknown as Payment[];
    },
    enabled: !!customerId && !!tenantId,
  });

  // Fetch customer orders for outstanding balance calculation
  const {
    data: orders,
    isLoading: ordersLoading,
  } = useQuery({
    queryKey: queryKeys.customerDetail.ordersTotals(customerId, tenantId),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const { data, error: queryError } = await supabase
        .from('orders')
        .select('id, total_amount, payment_status')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId);

      if (queryError) {
        logger.error('Failed to fetch customer orders for payment calculations', queryError, { customerId, tenantId });
        throw queryError;
      }

      return data as Order[];
    },
    enabled: !!customerId && !!tenantId,
  });

  // Filter payments based on status and date range
  const filteredPayments = useMemo(() => {
    if (!payments) return [];

    return payments.filter((payment) => {
      // Status filter
      if (statusFilter !== 'all' && payment.payment_status?.toLowerCase() !== statusFilter) {
        return false;
      }

      // Date range filter
      if (dateRange.from || dateRange.to) {
        const paymentDate = new Date(payment.created_at);
        if (dateRange.from && paymentDate < dateRange.from) {
          return false;
        }
        if (dateRange.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (paymentDate > endOfDay) {
            return false;
          }
        }
      }

      return true;
    });
  }, [payments, statusFilter, dateRange]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalPaid = (payments ?? [])
      .filter((p) => p.payment_status?.toLowerCase() === 'completed' || p.payment_status?.toLowerCase() === 'paid')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);

    const totalOrdersAmount = (orders ?? []).reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
    const outstandingBalance = Math.max(0, totalOrdersAmount - totalPaid);

    const pendingPayments = (payments ?? [])
      .filter((p) => p.payment_status?.toLowerCase() === 'pending')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);

    // Calculate average payment amount
    const completedPayments = (payments ?? []).filter(
      (p) => p.payment_status?.toLowerCase() === 'completed' || p.payment_status?.toLowerCase() === 'paid'
    );
    const avgPaymentAmount = completedPayments.length > 0
      ? totalPaid / completedPayments.length
      : 0;

    return {
      totalPaid,
      outstandingBalance,
      pendingPayments,
      avgPaymentAmount,
      paymentCount: payments?.length ?? 0,
    };
  }, [payments, orders]);

  // Generate payment trends data for the chart (last 6 months)
  const trendData = useMemo(() => {
    if (!payments || payments.length === 0) return [];

    const monthlyData: { [key: string]: number } = {};
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const key = format(monthDate, 'MMM yyyy');
      monthlyData[key] = 0;
    }

    // Aggregate payments by month
    payments.forEach((payment) => {
      if (payment.payment_status?.toLowerCase() === 'completed' || payment.payment_status?.toLowerCase() === 'paid') {
        const paymentDate = new Date(payment.created_at);
        const key = format(paymentDate, 'MMM yyyy');
        if (key in monthlyData) {
          monthlyData[key] += payment.amount ?? 0;
        }
      }
    });

    return Object.entries(monthlyData).map(([month, amount]) => ({
      month,
      amount,
    }));
  }, [payments]);

  // Define table columns
  const columns = useMemo(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Date',
        cell: ({ original }: { original: Payment }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {format(new Date(original.created_at), 'MMM d, yyyy')}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(original.created_at), 'h:mm a')}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ original }: { original: Payment }) => (
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(original.amount ?? 0)}
          </span>
        ),
      },
      {
        accessorKey: 'payment_method',
        header: 'Method',
        cell: ({ original }: { original: Payment }) => (
          <div className="flex items-center gap-2">
            <span>{getPaymentMethodIcon(original.payment_method)}</span>
            <span className="text-sm capitalize">
              {original.payment_method?.replace(/_/g, ' ') || 'Unknown'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'order_id',
        header: 'Order Reference',
        cell: ({ original }: { original: Payment }) => {
          if (!original.order_id) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <OrderLink
              orderId={original.order_id}
              orderNumber={`#${original.order_id.slice(0, 8).toUpperCase()}`}
              className="font-mono text-sm"
            />
          );
        },
      },
      {
        accessorKey: 'payment_status',
        header: 'Status',
        cell: ({ original }: { original: Payment }) => (
          <Badge className={getPaymentStatusStyles(original.payment_status)}>
            {original.payment_status
              ? original.payment_status.charAt(0).toUpperCase() + original.payment_status.slice(1)
              : 'Unknown'}
          </Badge>
        ),
      },
      {
        accessorKey: 'reference_number',
        header: 'Ref #',
        cell: ({ original }: { original: Payment }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {original.reference_number || '—'}
          </span>
        ),
      },
    ],
    []
  );

  const clearFilters = () => {
    setStatusFilter('all');
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = statusFilter !== 'all' || dateRange.from || dateRange.to;

  const isLoading = paymentsLoading || ordersLoading;

  if (isLoading) {
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-lg mb-6" />
          <Skeleton className="h-64 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (paymentsError) {
    logger.error('Error displaying customer payment history', paymentsErrorObj instanceof Error ? paymentsErrorObj : new Error(String(paymentsErrorObj)));
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load payment history. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(stats.totalPaid)}
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900/30">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className={`text-2xl font-bold ${stats.outstandingBalance > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {formatCurrency(stats.outstandingBalance)}
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/30">
                <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(stats.pendingPayments)}
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Payment</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.avgPaymentAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Trends Chart */}
        {trendData.length > 0 && trendData.some((d) => d.amount > 0) && (
          <div className="border rounded-lg p-4 bg-background">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Payment Trends (Last 6 Months)
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Payments']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PaymentStatus)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                    </>
                  ) : (
                    format(dateRange.from, 'MMM d, yyyy')
                  )
                ) : (
                  <span className="text-muted-foreground">Date Range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  setDateRange({ from: range?.from, to: range?.to });
                }}
                numberOfMonths={isMobile ? 1 : 2}
              />
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}

          {hasActiveFilters && (
            <span className="text-sm text-muted-foreground ml-2">
              Showing {filteredPayments.length} of {payments?.length ?? 0} payments
            </span>
          )}
        </div>

        {/* Payments Table */}
        {!payments || payments.length === 0 ? (
          <EnhancedEmptyState
            icon={CreditCard}
            title="No Payments Yet"
            description="This customer hasn't made any payments yet."
            primaryAction={{
              label: 'Record Payment',
              onClick: () => navigateToAdmin(`inventory/fronted/record-payment?customer=${customerId}`),
            }}
            compact
          />
        ) : filteredPayments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No payments match the current filters.</p>
            <Button variant="link" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredPayments}
            searchable={true}
            searchPlaceholder="Search payments..."
            searchColumn="reference_number"
            pagination={true}
            pageSize={10}
            emptyMessage="No payments found."
            getRowId={(row) => row.id}
          />
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => navigateToAdmin(`inventory/fronted/record-payment?customer=${customerId}`)}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Record Payment
          </Button>
          <Button
            variant="outline"
            onClick={() => navigateToAdmin(`customers/${customerId}/invoices`)}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

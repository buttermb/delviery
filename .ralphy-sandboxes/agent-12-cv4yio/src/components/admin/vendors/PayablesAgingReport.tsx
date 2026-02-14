/**
 * Payables Aging Report Component
 *
 * Shows aging report for outstanding payables.
 * Features:
 * - Aging buckets (current, 1-30, 31-60, 61-90, 90+)
 * - Total outstanding and overdue amounts
 * - Drill-down to individual POs
 * - Filter by vendor
 * - Payment due date alerts
 */

import { useState, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DollarSign,
  Loader2,
  AlertTriangle,
  Clock,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Calendar,
  Building2,
  ExternalLink,
  Filter,
  RefreshCw,
} from 'lucide-react';

import {
  usePayablesAging,
  useOverduePayments,
  useUpcomingPayments,
  type PayablePO,
  type AgingBucket,
} from '@/hooks/useVendorPaymentTerms';
import { useVendors } from '@/hooks/useVendors';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/utils/formatters';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { usePagination } from '@/hooks/usePagination';

// ============================================================================
// Types
// ============================================================================

interface PayablesAgingReportProps {
  vendorId?: string;
  showFilters?: boolean;
  compact?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function AgingBucketCard({
  bucket,
  totalOutstanding,
  isExpanded,
  onToggle,
  onViewPO,
}: {
  bucket: AgingBucket;
  totalOutstanding: number;
  isExpanded: boolean;
  onToggle: () => void;
  onViewPO: (poId: string) => void;
}) {
  const percentage = totalOutstanding > 0
    ? Math.round((bucket.total / totalOutstanding) * 100)
    : 0;

  const isOverdue = bucket.minDays > 0;
  const isCritical = bucket.minDays >= 61;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={`rounded-lg border p-4 transition-colors ${
          isCritical && bucket.count > 0
            ? 'border-destructive bg-destructive/5'
            : isOverdue && bucket.count > 0
            ? 'border-orange-300 bg-orange-50'
            : ''
        }`}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <h4 className="font-medium">{bucket.label}</h4>
                  <p className="text-xs text-muted-foreground">
                    {bucket.range} days overdue
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-semibold ${isCritical ? 'text-destructive' : isOverdue ? 'text-orange-600' : ''}`}>
                  {formatCurrency(bucket.total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bucket.count} PO{bucket.count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Progress
                value={percentage}
                className={`h-2 ${
                  isCritical
                    ? '[&>div]:bg-destructive'
                    : isOverdue
                    ? '[&>div]:bg-orange-500'
                    : '[&>div]:bg-primary'
                }`}
              />
              <p className="mt-1 text-xs text-muted-foreground text-right">
                {percentage}% of total
              </p>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4">
          {bucket.pos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No purchase orders in this bucket.
            </p>
          ) : (
            <div className="space-y-2">
              {bucket.pos.map((po) => (
                <div
                  key={po.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{po.po_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {po.vendor_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(po.outstanding_balance)}
                      </p>
                      {po.payment_due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due {format(new Date(po.payment_due_date), 'MMM d')}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPO(po.id);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function OverdueAlertBanner({
  overdueCount,
  overdueTotal,
}: {
  overdueCount: number;
  overdueTotal: number;
}) {
  if (overdueCount === 0) return null;

  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-destructive">Overdue Payments</h4>
          <p className="text-sm text-muted-foreground mt-1">
            You have {overdueCount} purchase order{overdueCount !== 1 ? 's' : ''} with{' '}
            <span className="font-medium text-destructive">
              {formatCurrency(overdueTotal)}
            </span>{' '}
            in overdue payments. Consider prioritizing these for payment.
          </p>
        </div>
      </div>
    </div>
  );
}

function UpcomingPaymentsWidget() {
  const { data: upcomingPayments, isLoading } = useUpcomingPayments(7);
  const navigate = useNavigate();
  const { tenantSlug } = useTenantAdminAuth();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const payments = upcomingPayments ?? [];
  const totalUpcoming = payments.reduce((sum, po) => sum + po.outstanding_balance, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          Due Within 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payments due in the next 7 days.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(totalUpcoming)}
            </div>
            <div className="space-y-2">
              {payments.slice(0, 3).map((po) => (
                <div
                  key={po.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="font-medium">{po.po_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {po.vendor_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(po.outstanding_balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {po.days_until_due === 0
                        ? 'Due today'
                        : `${po.days_until_due} day${po.days_until_due !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {payments.length > 3 && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto"
                onClick={() => navigate(`/${tenantSlug}/admin/purchase-orders`)}
              >
                View all {payments.length} upcoming
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PayablesAgingReport({
  vendorId,
  showFilters = true,
  compact = false,
}: PayablesAgingReportProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useTenantAdminAuth();

  const [selectedVendor, setSelectedVendor] = useState<string>(vendorId ?? 'all');
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());

  const { data: vendors } = useVendors();
  const {
    data: agingData,
    isLoading,
    isError,
    refetch,
  } = usePayablesAging(selectedVendor === 'all' ? undefined : selectedVendor);

  // Toggle bucket expansion
  const toggleBucket = (bucketKey: string) => {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucketKey)) {
        next.delete(bucketKey);
      } else {
        next.add(bucketKey);
      }
      return next;
    });
  };

  // Navigate to PO detail
  const handleViewPO = (poId: string) => {
    navigate(`/${tenantSlug}/admin/purchase-orders/${poId}`);
  };

  // Aging buckets array for iteration
  const buckets = useMemo(() => {
    if (!agingData) return [];
    return [
      { key: 'current', data: agingData.current },
      { key: 'days_1_30', data: agingData.days_1_30 },
      { key: 'days_31_60', data: agingData.days_31_60 },
      { key: 'days_61_90', data: agingData.days_61_90 },
      { key: 'days_over_90', data: agingData.days_over_90 },
    ];
  }, [agingData]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError || !agingData) {
    return (
      <Card>
        <CardContent className="p-6">
          <EnhancedEmptyState
            icon={DollarSign}
            title="Failed to load aging report"
            description="There was an error loading the payables aging data. Please try again."
            primaryAction={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        </CardContent>
      </Card>
    );
  }

  // Compact view for dashboard widgets
  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            Payables Aging
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total Outstanding</span>
              <span className="text-2xl font-bold">
                {formatCurrency(agingData.total_outstanding)}
              </span>
            </div>
            {agingData.total_overdue > 0 && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {formatCurrency(agingData.total_overdue)} overdue
                </span>
              </div>
            )}
            <div className="grid grid-cols-5 gap-1 text-xs">
              {buckets.map(({ key, data }) => (
                <div key={key} className="text-center">
                  <div
                    className={`h-2 rounded ${
                      data.count > 0
                        ? key === 'current'
                          ? 'bg-green-500'
                          : key === 'days_1_30'
                          ? 'bg-yellow-500'
                          : key === 'days_31_60'
                          ? 'bg-orange-500'
                          : 'bg-destructive'
                        : 'bg-muted'
                    }`}
                  />
                  <span className="text-muted-foreground mt-1 block">
                    {data.range}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overdue Alert */}
      <OverdueAlertBanner
        overdueCount={agingData.overdue_count}
        overdueTotal={agingData.total_overdue}
      />

      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Payables Aging Report</h2>
          <p className="text-muted-foreground">
            Outstanding vendor payables by aging bucket
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showFilters && (
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {(vendors ?? []).map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(agingData.total_outstanding)}
            </div>
            <p className="text-xs text-muted-foreground">
              {agingData.total_count} purchase order{agingData.total_count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current (Not Due)</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(agingData.current.total)}
            </div>
            <p className="text-xs text-muted-foreground">
              {agingData.current.count} PO{agingData.current.count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(agingData.total_overdue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {agingData.overdue_count} PO{agingData.overdue_count !== 1 ? 's' : ''} overdue
            </p>
          </CardContent>
        </Card>

        <UpcomingPaymentsWidget />
      </div>

      {/* Aging Buckets */}
      <Card>
        <CardHeader>
          <CardTitle>Aging Breakdown</CardTitle>
          <CardDescription>
            Click on each bucket to see individual purchase orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agingData.total_count === 0 ? (
            <EnhancedEmptyState
              icon={DollarSign}
              title="No outstanding payables"
              description="All vendor payments are up to date."
            />
          ) : (
            <div className="space-y-3">
              {buckets.map(({ key, data }) => (
                <AgingBucketCard
                  key={key}
                  bucket={data}
                  totalOutstanding={agingData.total_outstanding}
                  isExpanded={expandedBuckets.has(key)}
                  onToggle={() => toggleBucket(key)}
                  onViewPO={handleViewPO}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Dashboard Widget Export
// ============================================================================

export function PayablesAgingWidget() {
  return <PayablesAgingReport compact showFilters={false} />;
}

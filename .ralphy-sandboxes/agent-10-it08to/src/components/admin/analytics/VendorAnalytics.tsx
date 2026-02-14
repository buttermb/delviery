import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

interface VendorSpend {
  name: string;
  value: number;
  color: string;
  orders: number;
}

interface LeadTimeTrend {
  month: string;
  avgLeadDays: number;
  orders: number;
}

interface VendorReliability {
  vendorId: string;
  name: string;
  onTimeRate: number;
  accuracyRate: number;
  totalOrders: number;
  avgLeadDays: number;
  reliabilityScore: number;
}

interface VendorAnalyticsData {
  spendByVendor: VendorSpend[];
  leadTimeTrends: LeadTimeTrend[];
  vendorReliability: VendorReliability[];
  totalSpend: number;
  totalOrders: number;
  avgLeadTime: number;
}

interface VendorAnalyticsProps {
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6',
];

// ============================================================================
// Data Fetching
// ============================================================================

function useVendorAnalytics(tenantId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.analytics.all, 'vendor-analytics', tenantId],
    queryFn: async (): Promise<VendorAnalyticsData> => {
      if (!tenantId) throw new Error('No tenant context');

      // Fetch vendors and their purchase orders in parallel
      const [vendorsResult, posResult] = await Promise.all([
        supabase
          .from('vendors')
          .select('id, name, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        supabase
          .from('purchase_orders')
          .select(`
            id,
            vendor_id,
            status,
            total,
            expected_delivery_date,
            received_date,
            created_at
          `)
          .eq('tenant_id', tenantId)
          .neq('status', 'cancelled'),
      ]);

      if (vendorsResult.error) {
        logger.error('Failed to fetch vendors for analytics', vendorsResult.error, {
          component: 'VendorAnalytics',
        });
        throw vendorsResult.error;
      }

      if (posResult.error) {
        logger.error('Failed to fetch purchase orders for analytics', posResult.error, {
          component: 'VendorAnalytics',
        });
        throw posResult.error;
      }

      const vendors = vendorsResult.data ?? [];
      const purchaseOrders = posResult.data ?? [];

      // Build vendor name map
      const vendorMap = new Map(vendors.map(v => [v.id, v.name]));

      // --- Spend by Vendor ---
      const spendMap = new Map<string, { spend: number; orders: number }>();
      for (const po of purchaseOrders) {
        const vendorId = po.vendor_id;
        if (!vendorId) continue;
        const existing = spendMap.get(vendorId) ?? { spend: 0, orders: 0 };
        spendMap.set(vendorId, {
          spend: existing.spend + (po.total ?? 0),
          orders: existing.orders + 1,
        });
      }

      const spendByVendor: VendorSpend[] = Array.from(spendMap.entries())
        .map(([vendorId, data], index) => ({
          name: vendorMap.get(vendorId) ?? 'Unknown',
          value: Math.round(data.spend * 100) / 100,
          color: COLORS[index % COLORS.length],
          orders: data.orders,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // --- Lead Time Trends (monthly) ---
      const receivedPOs = purchaseOrders.filter(
        po => po.status === 'received' && po.received_date && po.created_at
      );

      const monthlyLeadTimes = new Map<string, { totalDays: number; count: number }>();
      for (const po of receivedPOs) {
        const created = new Date(po.created_at);
        const received = new Date(po.received_date!);
        const leadDays = Math.max(0, Math.round((received.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
        const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        const existing = monthlyLeadTimes.get(monthKey) ?? { totalDays: 0, count: 0 };
        monthlyLeadTimes.set(monthKey, {
          totalDays: existing.totalDays + leadDays,
          count: existing.count + 1,
        });
      }

      const leadTimeTrends: LeadTimeTrend[] = Array.from(monthlyLeadTimes.entries())
        .map(([month, data]) => ({
          month,
          avgLeadDays: Math.round((data.totalDays / data.count) * 10) / 10,
          orders: data.count,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      // --- Vendor Reliability Scores ---
      const vendorReliability: VendorReliability[] = [];
      for (const [vendorId, vendorName] of vendorMap) {
        const vendorPOs = purchaseOrders.filter(po => po.vendor_id === vendorId);
        if (vendorPOs.length === 0) continue;

        const vendorReceived = vendorPOs.filter(
          po => po.status === 'received' && po.received_date
        );

        // On-time rate
        const withDates = vendorReceived.filter(po => po.expected_delivery_date);
        const onTime = withDates.filter(po => {
          const expected = new Date(po.expected_delivery_date!);
          const received = new Date(po.received_date!);
          return received <= expected;
        });
        const onTimeRate = withDates.length > 0
          ? Math.round((onTime.length / withDates.length) * 100)
          : 100;

        // Fulfillment rate (received / total non-draft)
        const nonDraft = vendorPOs.filter(po => po.status !== 'draft');
        const accuracyRate = nonDraft.length > 0
          ? Math.round((vendorReceived.length / nonDraft.length) * 100)
          : 0;

        // Average lead time
        const leadTimes = vendorReceived
          .filter(po => po.created_at)
          .map(po => {
            const created = new Date(po.created_at);
            const received = new Date(po.received_date!);
            return Math.max(0, Math.round((received.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
          });
        const avgLeadDays = leadTimes.length > 0
          ? Math.round((leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length) * 10) / 10
          : 0;

        // Composite reliability score (weighted)
        const reliabilityScore = Math.round(
          onTimeRate * 0.4 + accuracyRate * 0.4 + Math.max(0, 100 - avgLeadDays * 2) * 0.2
        );

        vendorReliability.push({
          vendorId,
          name: vendorName,
          onTimeRate,
          accuracyRate,
          totalOrders: vendorPOs.length,
          avgLeadDays,
          reliabilityScore: Math.min(100, Math.max(0, reliabilityScore)),
        });
      }

      vendorReliability.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

      // --- Aggregate Metrics ---
      const totalSpend = purchaseOrders.reduce((sum, po) => sum + (po.total ?? 0), 0);
      const allLeadDays = receivedPOs.map(po => {
        const created = new Date(po.created_at);
        const received = new Date(po.received_date!);
        return Math.max(0, (received.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      });
      const avgLeadTime = allLeadDays.length > 0
        ? Math.round((allLeadDays.reduce((s, d) => s + d, 0) / allLeadDays.length) * 10) / 10
        : 0;

      return {
        spendByVendor,
        leadTimeTrends,
        vendorReliability,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalOrders: purchaseOrders.length,
        avgLeadTime,
      };
    },
    enabled: !!tenantId,
    staleTime: 120_000,
    gcTime: 300_000,
  });
}

// ============================================================================
// Sub-components
// ============================================================================

function SpendByVendorChart({ data }: { data: VendorSpend[] }) {
  const totalSpend = useMemo(
    () => data.reduce((sum, v) => sum + v.value, 0),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend by Vendor</CardTitle>
        <CardDescription>
          Total: <span className="font-semibold text-foreground">${totalSpend.toLocaleString()}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex justify-center items-center h-[300px] text-muted-foreground">
            No vendor spend data available
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Spend']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeadTimeTrendsChart({ data }: { data: LeadTimeTrend[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Time Trends</CardTitle>
        <CardDescription>Average vendor lead time by month (days)</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex justify-center items-center h-[280px] text-muted-foreground">
            No lead time data available
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}d`}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip
                  formatter={(value: number, _name: string) => [`${value} days`, 'Avg Lead Time']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line
                  type="monotone"
                  dataKey="avgLeadDays"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VendorReliabilityTable({ data }: { data: VendorReliability[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Reliability Scores</CardTitle>
        <CardDescription>
          Composite score based on on-time delivery, fulfillment accuracy, and lead time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex justify-center items-center h-[200px] text-muted-foreground">
            No vendor reliability data available
          </div>
        ) : (
          <div className="space-y-3">
            {data.slice(0, 8).map((vendor) => (
              <div key={vendor.vendorId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{vendor.name}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <ReliabilityBadge score={vendor.reliabilityScore} />
                      <span className="text-sm font-semibold">{vendor.reliabilityScore}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${vendor.reliabilityScore}%`,
                        backgroundColor: getScoreColor(vendor.reliabilityScore),
                      }}
                    />
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>On-time: {vendor.onTimeRate}%</span>
                    <span>Fulfillment: {vendor.accuracyRate}%</span>
                    <span>Avg lead: {vendor.avgLeadDays}d</span>
                    <span>{vendor.totalOrders} orders</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FulfillmentAccuracyChart({ data }: { data: VendorReliability[] }) {
  const chartData = useMemo(
    () =>
      data
        .filter(v => v.totalOrders >= 1)
        .slice(0, 8)
        .map(v => ({
          name: v.name.length > 12 ? `${v.name.slice(0, 12)}...` : v.name,
          onTimeRate: v.onTimeRate,
          fulfillmentRate: v.accuracyRate,
        })),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>PO Fulfillment Accuracy</CardTitle>
        <CardDescription>On-time delivery vs fulfillment rate by vendor</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex justify-center items-center h-[280px] text-muted-foreground">
            No fulfillment data available
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === 'onTimeRate' ? 'On-Time' : 'Fulfillment',
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="onTimeRate" fill="#10b981" radius={[0, 4, 4, 0]} name="On-Time" />
                <Bar dataKey="fulfillmentRate" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Fulfillment" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function ReliabilityBadge({ score }: { score: number }) {
  if (score >= 80) {
    return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-xs">Good</Badge>;
  }
  if (score >= 60) {
    return <Badge variant="default" className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs">Fair</Badge>;
  }
  return <Badge variant="default" className="bg-red-500/10 text-red-600 border-red-200 text-xs">Poor</Badge>;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function VendorAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[280px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VendorAnalytics({ className }: VendorAnalyticsProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data, isLoading, error } = useVendorAnalytics(tenantId);

  if (isLoading) {
    return (
      <div className={className}>
        <VendorAnalyticsSkeleton />
      </div>
    );
  }

  if (error) {
    logger.error('VendorAnalytics render error', error instanceof Error ? error : new Error(String(error)), {
      component: 'VendorAnalytics',
    });
    return (
      <div className={className}>
        <Card>
          <CardContent className="flex justify-center items-center h-[200px] text-muted-foreground">
            Failed to load vendor analytics. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="flex justify-center items-center h-[200px] text-muted-foreground">
            No vendor data available
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Vendor Spend</p>
              <p className="text-2xl font-bold">${data.totalSpend.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Purchase Orders</p>
              <p className="text-2xl font-bold">{data.totalOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Avg Lead Time</p>
              <p className="text-2xl font-bold">{data.avgLeadTime} days</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SpendByVendorChart data={data.spendByVendor} />
          <LeadTimeTrendsChart data={data.leadTimeTrends} />
          <VendorReliabilityTable data={data.vendorReliability} />
          <FulfillmentAccuracyChart data={data.vendorReliability} />
        </div>
      </div>
    </div>
  );
}

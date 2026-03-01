/**
 * Vendor Dashboard Overview
 *
 * Overview of the vendor module with:
 * - Stats cards (total vendors, active POs, outstanding payables, on-time delivery rate)
 * - Top vendors by spend table
 * - Recent PO activity feed
 * - Vendor distribution by category chart
 * - Quick actions (add vendor, create PO, view pending deliveries)
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  Users,
  FileText,
  DollarSign,
  CheckCircle2,
  Plus,
  Truck,
  RefreshCw,
  Loader2,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { formatCurrency, formatSmartDate } from '@/lib/formatters';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageErrorState } from '@/components/admin/shared/PageErrorState';
import { queryKeys } from '@/lib/queryKeys';
import { CHART_COLORS } from '@/lib/chartColors';

// ============================================================================
// Types
// ============================================================================

interface VendorStats {
  totalVendors: number;
  activePoCount: number;
  outstandingPayables: number;
  onTimeDeliveryRate: number;
}

interface TopVendor {
  id: string;
  name: string;
  totalSpend: number;
  poCount: number;
  avgRating: number | null;
}

interface POActivity {
  id: string;
  poNumber: string;
  vendorName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface VendorCategory {
  category: string;
  count: number;
  color: string;
}

interface PurchaseOrderRow {
  id: string;
  vendor_id: string | null;
  total: number;
  status: string;
  expected_delivery_date: string | null;
  received_at: string | null;
  po_number: string | null;
  created_at: string;
  vendors?: { name: string } | null;
}

interface VendorRatingRow {
  vendor_id: string;
  overall_score: number | null;
}

interface VendorRow {
  id: string;
  category: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500 dark:bg-gray-600',
  submitted: 'bg-blue-500',
  approved: 'bg-green-500',
  received: 'bg-emerald-500',
  cancelled: 'bg-red-500',
};

// ============================================================================
// Component
// ============================================================================

export default function VendorDashboard() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, loading: authLoading } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch vendor stats
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: queryKeys.vendorDashboard.stats(tenantId),
    queryFn: async (): Promise<VendorStats> => {
      if (!tenantId) {
        return {
          totalVendors: 0,
          activePoCount: 0,
          outstandingPayables: 0,
          onTimeDeliveryRate: 0,
        };
      }

      // Get total vendors
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('id')
        .eq('account_id', tenantId);

      if (vendorsError) {
        logger.error('Failed to fetch vendors count', vendorsError, { component: 'VendorDashboard' });
        throw vendorsError;
      }

      // Get active POs (draft, submitted, approved statuses)
      const { data: activePOs, error: poError } = await supabase
        .from('purchase_orders' as 'tenants')
        .select('id, status, total, expected_delivery_date, received_at')
        .eq('tenant_id', tenantId)
        .in('status', ['draft', 'submitted', 'approved']);

      if (poError) {
        logger.error('Failed to fetch active POs', poError, { component: 'VendorDashboard' });
        throw poError;
      }

      // Get all POs for payables and delivery rate calculation
      const { data: allPOs, error: allPoError } = await supabase
        .from('purchase_orders' as 'tenants')
        .select('id, status, total, expected_delivery_date, received_at')
        .eq('tenant_id', tenantId);

      if (allPoError) {
        logger.error('Failed to fetch all POs', allPoError, { component: 'VendorDashboard' });
        throw allPoError;
      }

      // Calculate outstanding payables (approved POs not yet received)
      const outstandingPayables = (allPOs ?? [])
        .filter((po) => po.status === 'approved' || po.status === 'submitted')
        .reduce((sum: number, po: PurchaseOrderRow) => sum + (po.total ?? 0), 0);

      // Calculate on-time delivery rate
      const receivedPOs = (allPOs ?? []).filter((po) => po.status === 'received');
      let onTimeCount = 0;
      receivedPOs.forEach((po) => {
        if (po.expected_delivery_date && po.received_at) {
          const expectedDate = new Date(po.expected_delivery_date);
          const receivedDate = new Date(po.received_at);
          if (receivedDate <= expectedDate) {
            onTimeCount++;
          }
        }
      });
      const onTimeDeliveryRate = receivedPOs.length > 0
        ? Math.round((onTimeCount / receivedPOs.length) * 100)
        : 100;

      return {
        totalVendors: vendors?.length ?? 0,
        activePoCount: activePOs?.length ?? 0,
        outstandingPayables,
        onTimeDeliveryRate,
      };
    },
    enabled: !!tenantId,
  });

  // Fetch top vendors by spend
  const { data: topVendors = [], isLoading: topVendorsLoading } = useQuery({
    queryKey: queryKeys.vendorDashboard.topVendors(tenantId),
    queryFn: async (): Promise<TopVendor[]> => {
      if (!tenantId) return [];

      // Get vendors with their PO totals
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('account_id', tenantId);

      if (vendorsError) {
        logger.error('Failed to fetch vendors', vendorsError, { component: 'VendorDashboard' });
        throw vendorsError;
      }

      if (!vendors || vendors.length === 0) return [];

      // Get PO data for each vendor
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders' as 'tenants')
        .select('vendor_id, total, status')
        .eq('tenant_id', tenantId)
        .in('status', ['approved', 'received']);

      if (poError) {
        logger.error('Failed to fetch purchase orders', poError, { component: 'VendorDashboard' });
        throw poError;
      }

      // Get vendor ratings
      const { data: ratings, error: ratingsError } = await supabase
        .from('vendor_ratings' as 'tenants')
        .select('vendor_id, overall_score')
        .eq('tenant_id', tenantId);

      if (ratingsError) {
        logger.error('Failed to fetch vendor ratings', ratingsError, { component: 'VendorDashboard' });
        // Don't throw - ratings are optional
      }

      // Aggregate data per vendor
      const vendorSpendMap = new Map<string, { totalSpend: number; poCount: number }>();
      (purchaseOrders ?? []).forEach((po: PurchaseOrderRow) => {
        if (po.vendor_id) {
          const existing = vendorSpendMap.get(po.vendor_id) || { totalSpend: 0, poCount: 0 };
          existing.totalSpend += po.total ?? 0;
          existing.poCount += 1;
          vendorSpendMap.set(po.vendor_id, existing);
        }
      });

      // Calculate average rating per vendor
      const vendorRatingsMap = new Map<string, number[]>();
      (ratings ?? []).forEach((r: VendorRatingRow) => {
        if (r.vendor_id && r.overall_score !== null) {
          const scores = vendorRatingsMap.get(r.vendor_id) ?? [];
          scores.push(r.overall_score);
          vendorRatingsMap.set(r.vendor_id, scores);
        }
      });

      // Build result
      const result: TopVendor[] = vendors.map((v) => {
        const spendData = vendorSpendMap.get(v.id) || { totalSpend: 0, poCount: 0 };
        const ratingScores = vendorRatingsMap.get(v.id);
        const avgRating = ratingScores && ratingScores.length > 0
          ? ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length
          : null;

        return {
          id: v.id,
          name: v.name,
          totalSpend: spendData.totalSpend,
          poCount: spendData.poCount,
          avgRating,
        };
      });

      // Sort by total spend descending, take top 10
      return result
        .filter((v) => v.totalSpend > 0)
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 10);
    },
    enabled: !!tenantId,
  });

  // Fetch recent PO activity
  const { data: recentActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: queryKeys.vendorDashboard.activity(tenantId),
    queryFn: async (): Promise<POActivity[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('purchase_orders' as 'tenants')
        .select(`
          id,
          po_number,
          status,
          total,
          created_at,
          vendor_id,
          vendors!purchase_orders_vendor_id_fkey (name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Failed to fetch recent PO activity', error, { component: 'VendorDashboard' });
        throw error;
      }

      return (data ?? []).map((po: PurchaseOrderRow) => ({
        id: po.id,
        poNumber: po.po_number || `PO-${po.id.slice(0, 8)}`,
        vendorName: po.vendors?.name || 'Unknown Vendor',
        status: po.status || 'draft',
        totalAmount: po.total ?? 0,
        createdAt: po.created_at || new Date().toISOString(),
      }));
    },
    enabled: !!tenantId,
  });

  // Fetch vendor distribution by category
  const { data: categoryDistribution = [], isLoading: categoryLoading } = useQuery({
    queryKey: queryKeys.vendorDashboard.categories(tenantId),
    queryFn: async (): Promise<VendorCategory[]> => {
      if (!tenantId) return [];

      const { data: vendors, error } = await supabase
        .from('vendors' as 'tenants')
        .select('id, category')
        .eq('account_id', tenantId);

      if (error) {
        logger.error('Failed to fetch vendor categories', error, { component: 'VendorDashboard' });
        throw error;
      }

      // Count vendors by category
      const categoryMap = new Map<string, number>();
      (vendors ?? []).forEach((v: VendorRow) => {
        const category = v.category || 'Uncategorized';
        categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
      });

      // Convert to array with colors
      let colorIndex = 0;
      return Array.from(categoryMap.entries())
        .map(([category, count]) => ({
          category,
          count,
          color: CHART_COLORS[colorIndex++ % CHART_COLORS.length],
        }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!tenantId,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.vendorDashboard.stats(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.vendorDashboard.topVendors(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.vendorDashboard.activity(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.vendorDashboard.categories(tenantId) }),
    ]);
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    return formatSmartDate(dateString, { includeTime: true });
  };

  if (authLoading) {
    return (
      <div className="container mx-auto py-4 space-y-4" role="status" aria-label="Loading vendor dashboard...">
        <div className="flex items-center justify-between px-2 sm:px-0">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (statsError) {
    return <PageErrorState onRetry={handleRefresh} message="Failed to load vendor dashboard data. Please try again." />;
  }

  if (!tenant) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl mb-2">Access Denied</CardTitle>
            <CardDescription>
              You need to be logged in as a tenant admin to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/saas/login')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Vendors',
      value: stats?.totalVendors ?? 0,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Active POs',
      value: stats?.activePoCount ?? 0,
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Outstanding Payables',
      value: formatCurrency(stats?.outstandingPayables ?? 0),
      icon: DollarSign,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      title: 'On-Time Delivery',
      value: `${stats?.onTimeDeliveryRate ?? 0}%`,
      icon: CheckCircle2,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
  ];

  return (
    <div className="container mx-auto py-4 sm:py-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 sm:px-0">
        <div>
          <h1 className="text-xl font-bold">Vendor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your vendor relationships and purchase orders
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => navigate(`/${tenantSlug}/admin/vendors?action=add`)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/${tenantSlug}/admin/purchase-orders/new`)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Create PO
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/${tenantSlug}/admin/purchase-orders?status=approved`)}
              className="gap-2"
            >
              <Truck className="h-4 w-4" />
              View Pending Deliveries
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statsLoading
          ? [1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          : statCards.map((stat) => (
              <Card key={stat.title} className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={cn('p-2 rounded-full', stat.bg)}>
                    <stat.icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Vendors by Spend */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Vendors by Spend
              </CardTitle>
              <CardDescription>Your highest-spending vendor relationships</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/${tenantSlug}/admin/vendors`)}
            >
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {topVendorsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            ) : topVendors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No vendor spending data yet</p>
                <p className="text-sm">Create purchase orders to see vendor metrics</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">POs</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topVendors.map((vendor) => (
                    <TableRow
                      key={vendor.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/${tenantSlug}/admin/vendors/${vendor.id}`)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {vendor.name}
                          {vendor.avgRating !== null && (
                            <Badge variant="secondary" className="text-xs">
                              {vendor.avgRating.toFixed(1)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{vendor.poCount}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(vendor.totalSpend)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Vendor Distribution by Category */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vendor Distribution
            </CardTitle>
            <CardDescription>Vendors grouped by category</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : categoryDistribution.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No vendors found</p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="category"
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} vendors`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {categoryDistribution.map((item) => (
                    <div key={item.category} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {item.category} ({item.count})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent PO Activity Feed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent PO Activity
            </CardTitle>
            <CardDescription>Latest purchase order updates</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/${tenantSlug}/admin/purchase-orders`)}
          >
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No purchase orders yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first purchase order to see activity here
              </p>
              <Button
                className="mt-4"
                onClick={() => navigate(`/${tenantSlug}/admin/purchase-orders/new`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Purchase Order
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/${tenantSlug}/admin/purchase-orders/${activity.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{activity.poNumber}</span>
                        <Badge
                          className={cn(
                            'text-white text-xs',
                            STATUS_COLORS[activity.status] || 'bg-gray-500 dark:bg-gray-600'
                          )}
                        >
                          {activity.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{activity.vendorName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(activity.totalAmount)}</div>
                    <p className="text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

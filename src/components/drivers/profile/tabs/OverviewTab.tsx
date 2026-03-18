import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from '@/components/ui/lazy-recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriverOverviewStats {
  deliveriesToday: number;
  deliveriesWeek: number;
  deliveriesMonth: number;
  deliveriesAllTime: number;
  totalEarned: number;
  avgRating: number;
  onTimeRate: number | null;
  avgDeliveryTime: number | null;
}

interface RatingTrendPoint {
  date: string;
  rating: number;
}

interface ActiveOrder {
  id: string;
  order_number: string;
  status: string;
  customer_name: string | null;
  delivery_address: string | null;
  pickup_address: string | null; // derived from merchants.address
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  accent,
  suffix,
  isLoading,
}: {
  label: string;
  value: string | number;
  accent?: string;
  suffix?: string;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-7 w-16 bg-muted" />
      ) : (
        <span
          className="font-['Space_Grotesk'] text-xl font-bold leading-7"
          style={{ color: accent ?? '#F8FAFC' }}
        >
          {value}
          {suffix && <span className="ml-0.5 text-sm font-normal text-muted-foreground">{suffix}</span>}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OverviewTabProps {
  driver: DriverProfile;
  tenantId: string;
}

export function OverviewTab({ driver, tenantId }: OverviewTabProps) {
  const { navigateToAdmin } = useTenantNavigation();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const statsQuery = useQuery({
    queryKey: [...queryKeys.couriersAdmin.byTenant(tenantId), 'profile-stats', driver.id],
    queryFn: async (): Promise<DriverOverviewStats> => {
      // Deliveries today
      const { count: deliveriesToday } = await supabase
        .from('driver_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('driver_id', driver.id)
        .eq('event_type', 'delivery_completed')
        .gte('created_at', todayStart.toISOString());

      // Deliveries this week
      const { count: deliveriesWeek } = await supabase
        .from('driver_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('driver_id', driver.id)
        .eq('event_type', 'delivery_completed')
        .gte('created_at', weekStart.toISOString());

      // Deliveries this month
      const { count: deliveriesMonth } = await supabase
        .from('driver_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('driver_id', driver.id)
        .eq('event_type', 'delivery_completed')
        .gte('created_at', monthStart.toISOString());

      // All time
      const { count: deliveriesAllTime } = await supabase
        .from('driver_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('driver_id', driver.id)
        .eq('event_type', 'delivery_completed');

      // Total earned from courier_earnings
      const { data: earningsData } = await supabase
        .from('courier_earnings')
        .select('total_earned')
        .eq('courier_id', driver.id);

      const totalEarned = (earningsData ?? []).reduce(
        (sum, row) => sum + (row.total_earned ?? 0),
        0,
      );

      // Average rating from delivery_ratings
      const { data: ratingsData } = await supabase
        .from('delivery_ratings')
        .select('rating')
        .eq('tenant_id', tenantId)
        .eq('runner_id', driver.id);

      const avgRating =
        ratingsData && ratingsData.length > 0
          ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
          : 0;

      return {
        deliveriesToday: deliveriesToday ?? 0,
        deliveriesWeek: deliveriesWeek ?? 0,
        deliveriesMonth: deliveriesMonth ?? 0,
        deliveriesAllTime: deliveriesAllTime ?? 0,
        totalEarned,
        avgRating,
        onTimeRate: null,
        avgDeliveryTime: null,
      };
    },
    enabled: !!tenantId && !!driver.id,
  });

  // 30-day rating trend
  const ratingTrendQuery = useQuery({
    queryKey: [...queryKeys.couriersAdmin.byTenant(tenantId), 'rating-trend', driver.id],
    queryFn: async (): Promise<RatingTrendPoint[]> => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('delivery_ratings')
        .select('rating, created_at')
        .eq('tenant_id', tenantId)
        .eq('runner_id', driver.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch rating trend', error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Group by date
      const byDate = new Map<string, number[]>();
      for (const row of data) {
        const dateKey = new Date(row.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const existing = byDate.get(dateKey) ?? [];
        existing.push(row.rating);
        byDate.set(dateKey, existing);
      }

      return Array.from(byDate.entries()).map(([date, ratings]) => ({
        date,
        rating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      }));
    },
    enabled: !!tenantId && !!driver.id,
  });

  // Active delivery query
  const activeOrderQuery = useQuery({
    queryKey: [...queryKeys.couriersAdmin.byTenant(tenantId), 'active-order', driver.id],
    queryFn: async (): Promise<ActiveOrder | null> => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, customer_name, delivery_address, merchants(address)')
        .eq('courier_id', driver.id)
        .eq('tenant_id', tenantId)
        .in('status', ['assigned', 'in_transit'])
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch active order', error);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        order_number: data.order_number,
        status: data.status,
        customer_name: data.customer_name,
        delivery_address: data.delivery_address,
        pickup_address: (data.merchants as { address?: string } | null)?.address ?? null,
      };
    },
    enabled: !!tenantId && !!driver.id,
  });

  const stats = statsQuery.data;
  const isLoading = statsQuery.isLoading;
  const ratingTrendData = ratingTrendQuery.data ?? [];
  const activeOrder = activeOrderQuery.data;

  const lastSeen = driver.last_seen_at
    ? formatRelativeTime(driver.last_seen_at)
    : 'Never';

  const hasLocation = driver.current_lat != null && driver.current_lng != null;

  function handleOpenMap() {
    if (hasLocation) {
      window.open(
        `https://www.google.com/maps?q=${driver.current_lat},${driver.current_lng}`,
        '_blank',
      );
    } else {
      toast.info('No location data available');
    }
  }

  function handleViewOrderDetails() {
    if (activeOrder) {
      navigateToAdmin(`orders/${activeOrder.id}`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Delivery stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Deliveries Today" value={stats?.deliveriesToday ?? 0} isLoading={isLoading} />
        <StatCard label="This Week" value={stats?.deliveriesWeek ?? 0} isLoading={isLoading} />
        <StatCard label="This Month" value={stats?.deliveriesMonth ?? 0} isLoading={isLoading} />
        <StatCard label="All Time" value={stats?.deliveriesAllTime ?? 0} isLoading={isLoading} />
      </div>

      {/* Row 2: Performance stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Earned"
          value={`$${(stats?.totalEarned ?? 0).toLocaleString()}`}
          accent="#10B981"
          isLoading={isLoading}
        />
        <StatCard
          label="Avg Rating"
          value={stats?.avgRating ? stats.avgRating.toFixed(1) : '0.0'}
          suffix="★"
          isLoading={isLoading}
        />
        <StatCard
          label="On-Time Rate"
          value={stats?.onTimeRate != null ? `${stats.onTimeRate}%` : 'N/A'}
          isLoading={isLoading}
        />
        <StatCard
          label="Avg Delivery Time"
          value={stats?.avgDeliveryTime != null ? stats.avgDeliveryTime : 'N/A'}
          suffix={stats?.avgDeliveryTime != null ? 'min' : undefined}
          isLoading={isLoading}
        />
      </div>

      {/* Row 3: Charts + cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Rating trend chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">30-day rating trend</span>
          </div>
          <div className="h-[140px]">
            {ratingTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratingTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(ratingTrendData.length / 5) - 1)}
                  />
                  <YAxis
                    domain={[0, 5]}
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#F8FAFC',
                    }}
                    formatter={(val: number) => [val.toFixed(1), 'Rating']}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-sm text-muted-foreground">No rating data yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Last location card */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex h-[100px] items-center justify-center rounded-md bg-background">
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-6 w-6 text-emerald-500" />
              <span className="text-[11px]">
                {hasLocation
                  ? `${driver.current_lat!.toFixed(4)}, ${driver.current_lng!.toFixed(4)}`
                  : 'Location unavailable'}
              </span>
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">Last seen {lastSeen}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasLocation ? `${driver.current_lat!.toFixed(4)}, ${driver.current_lng!.toFixed(4)}` : 'No location data'}
          </p>
          <button
            type="button"
            onClick={handleOpenMap}
            className="mt-2 text-xs font-medium text-emerald-500 hover:underline"
          >
            Open full map →
          </button>
        </div>

        {/* Active delivery card */}
        <div className="rounded-lg border border-border bg-card p-4">
          {activeOrder ? (
            <ActiveDeliveryCard order={activeOrder} onViewDetails={handleViewOrderDetails} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center">
              <span className="text-sm text-muted-foreground">No active delivery</span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                Driver is currently {driver.availability}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active delivery card
// ---------------------------------------------------------------------------

function ActiveDeliveryCard({
  order,
  onViewDetails,
}: {
  order: ActiveOrder;
  onViewDetails: () => void;
}) {
  const statusLabel = order.status === 'in_transit' ? 'In Transit' : 'Assigned';
  const statusColor = order.status === 'in_transit' ? 'amber' : 'blue';

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Active Delivery
        </span>
        <span className={`inline-flex items-center rounded-full bg-${statusColor}-500/20 px-2 py-0.5 text-[11px] font-medium text-${statusColor}-500`}>
          {statusLabel}
        </span>
      </div>
      <p className="text-sm font-medium text-foreground">{order.order_number}</p>
      {order.customer_name && (
        <p className="text-xs text-muted-foreground">{order.customer_name}</p>
      )}
      {(order.pickup_address || order.delivery_address) && (
        <div className="mt-3 flex items-start gap-2">
          <div className="mt-1 flex flex-col items-center gap-0.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <div className="h-6 w-[2px] bg-muted" />
            <div className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <span className="text-muted-foreground">{order.pickup_address ?? '—'}</span>
            <span className="text-muted-foreground">{order.delivery_address ?? '—'}</span>
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={onViewDetails}
          className="text-xs text-emerald-500 hover:underline"
        >
          View Order Details
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

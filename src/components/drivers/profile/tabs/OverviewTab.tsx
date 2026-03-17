import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';

import type { DriverProfile } from '@/pages/drivers/DriverProfilePage';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
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
  onTimeRate: number;
  avgDeliveryTime: number;
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

      return {
        deliveriesToday: deliveriesToday ?? 0,
        deliveriesWeek: deliveriesWeek ?? 0,
        deliveriesMonth: deliveriesMonth ?? 0,
        deliveriesAllTime: deliveriesAllTime ?? 0,
        totalEarned: 3240,  // Placeholder until earnings table is integrated
        avgRating: 4.8,     // Placeholder until ratings table is integrated
        onTimeRate: 96,     // Placeholder
        avgDeliveryTime: 22, // Placeholder
      };
    },
    enabled: !!tenantId && !!driver.id,
  });

  const stats = statsQuery.data;
  const isLoading = statsQuery.isLoading;

  // 30-day rating trend data (placeholder)
  const ratingTrendData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rating: 4.5 + Math.random() * 0.6,
    };
  });

  const lastSeen = driver.last_seen_at
    ? formatRelativeTime(driver.last_seen_at)
    : 'Never';

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
          value={stats?.avgRating.toFixed(1) ?? '—'}
          suffix="★"
          isLoading={isLoading}
        />
        <StatCard
          label="On-Time Rate"
          value={`${stats?.onTimeRate ?? 0}%`}
          isLoading={isLoading}
        />
        <StatCard
          label="Avg Delivery Time"
          value={stats?.avgDeliveryTime ?? 0}
          suffix="min"
          isLoading={isLoading}
        />
      </div>

      {/* Row 3: Charts + cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Rating trend chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">30-day rating trend</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
              +0.3
            </span>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratingTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  domain={[4, 5]}
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
          </div>
        </div>

        {/* Last location card */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex h-[100px] items-center justify-center rounded-md bg-background">
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-6 w-6 text-emerald-500" />
              <span className="text-[11px]">Map preview</span>
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">Last seen {lastSeen}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Brooklyn, NY</p>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-emerald-500 hover:underline"
          >
            Open full map →
          </button>
        </div>

        {/* Active delivery card */}
        <div className="rounded-lg border border-border bg-card p-4">
          {driver.availability === 'on_delivery' ? (
            <ActiveDeliveryCard />
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
// Active delivery card (placeholder)
// ---------------------------------------------------------------------------

function ActiveDeliveryCard() {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Active Delivery
        </span>
        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-500">
          In Transit
        </span>
      </div>
      <p className="text-sm font-medium text-foreground">FIQ-0044</p>
      <p className="text-xs text-muted-foreground">Sarah Johnson</p>
      <div className="mt-3 flex items-start gap-2">
        <div className="mt-1 flex flex-col items-center gap-0.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <div className="h-6 w-[2px] bg-muted" />
          <div className="h-2 w-2 rounded-full bg-amber-500" />
        </div>
        <div className="flex flex-col gap-2 text-xs">
          <span className="text-muted-foreground">420 Broadway, Brooklyn</span>
          <span className="text-muted-foreground">88 Court St, Brooklyn</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">ETA ~11 min</span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
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


import { Skeleton } from '@/components/ui/skeleton';
import type { DriverStats } from '@/pages/drivers/DriverDirectoryPage';

interface DriverStatsStripProps {
  stats: DriverStats;
  isLoading: boolean;
}

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: string;
  icon?: React.ReactNode;
  pulse?: boolean;
  isLoading: boolean;
}

function StatCard({ label, value, accent, icon, pulse, isLoading }: StatCardProps) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </span>
        {pulse && (
          <span className="relative flex h-[7px] w-[7px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-green-500" />
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-8 w-16 bg-muted" />
      ) : (
        <div className="flex items-center gap-1.5">
          <span
            className="font-['Space_Grotesk'] text-[28px] font-bold leading-[34px]"
            style={{ color: accent ?? '#F8FAFC' }}
          >
            {value}
          </span>
          {icon}
        </div>
      )}
    </div>
  );
}

export function DriverStatsStrip({ stats, isLoading }: DriverStatsStripProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Total Drivers"
        value={stats.total}
        isLoading={isLoading}
      />
      <StatCard
        label="Online Now"
        value={stats.online}
        accent="#10B981"
        pulse
        isLoading={isLoading}
      />
      <StatCard
        label="Avg Rating"
        value={stats.avgRating.toFixed(1)}
        icon={
          <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        }
        isLoading={isLoading}
      />
      <StatCard
        label="Deliveries Today"
        value={stats.deliveriesToday}
        isLoading={isLoading}
      />
    </div>
  );
}

/**
 * Real-time Analytics Ticker
 * Horizontal scrolling ticker showing live business metrics.
 * Updates every 10 seconds with realtime subscription fallback.
 */

import { useMemo } from 'react';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Truck from 'lucide-react/dist/esm/icons/truck';
import Eye from 'lucide-react/dist/esm/icons/eye';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Activity from 'lucide-react/dist/esm/icons/activity';
import { Skeleton } from '@/components/ui/skeleton';
import { useRealtimeTicker } from '@/hooks/useRealtimeTicker';
import { formatCompactCurrency } from '@/lib/utils/formatCurrency';

interface TickerItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

function TickerItem({ icon, label, value, color }: TickerItemProps) {
  return (
    <div className="flex items-center gap-2 px-4 whitespace-nowrap">
      <span className={color}>{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function TickerSkeleton() {
  return (
    <div className="flex items-center gap-6 overflow-hidden rounded-lg border bg-muted/30 px-4 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export function RealtimeTicker() {
  const { metrics, isLoading, error } = useRealtimeTicker();

  const items = useMemo(
    () => [
      {
        icon: <ShoppingCart className="h-3.5 w-3.5" />,
        label: 'Orders (1h)',
        value: String(metrics.ordersLastHour),
        color: 'text-blue-500',
      },
      {
        icon: <DollarSign className="h-3.5 w-3.5" />,
        label: 'Revenue today',
        value: formatCompactCurrency(metrics.revenueToday),
        color: 'text-green-500',
      },
      {
        icon: <Truck className="h-3.5 w-3.5" />,
        label: 'Active deliveries',
        value: String(metrics.activeDeliveries),
        color: 'text-orange-500',
      },
      {
        icon: <Eye className="h-3.5 w-3.5" />,
        label: 'Menu views (live)',
        value: String(metrics.menuViewsNow),
        color: 'text-purple-500',
      },
    ],
    [metrics]
  );

  if (isLoading) {
    return <TickerSkeleton />;
  }

  if (error) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center py-2">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 pl-4 pr-2 border-r mr-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Live
          </span>
        </div>

        {/* Scrolling ticker content */}
        <div className="flex-1 overflow-hidden">
          <div className="animate-ticker flex items-center gap-2">
            {/* Render items twice for seamless loop */}
            {items.map((item, i) => (
              <TickerItem key={i} {...item} />
            ))}
            <span className="text-muted-foreground/30 px-2">|</span>
            {items.map((item, i) => (
              <TickerItem key={`dup-${i}`} {...item} />
            ))}
          </div>
        </div>

        {/* Refresh indicator */}
        <div className="flex items-center pl-2 pr-4 border-l ml-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
        </div>
      </div>
    </div>
  );
}

export default RealtimeTicker;

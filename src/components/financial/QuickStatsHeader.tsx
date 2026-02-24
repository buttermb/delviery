/**
 * Quick Stats Header
 * 
 * Sticky header with 5 critical metrics always visible:
 * Cash Position | Today's P&L | Outstanding AR | Fronted Value | Alerts
 */

import { Wallet, TrendingUp, AlertCircle, Package, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuickStats } from '@/hooks/useFinancialCommandCenter';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCompactCurrency } from '@/lib/formatters';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: 'default' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}

function StatItem({ icon, label, value, color = 'default', onClick }: StatItemProps) {
  const colorClasses = {
    default: 'text-zinc-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg transition-all',
        'hover:bg-white/5 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
        'flex-shrink-0 min-w-fit'
      )}
    >
      <span className={cn('opacity-70', colorClasses[color])}>{icon}</span>
      <div className="text-left">
        <div className={cn('text-sm sm:text-lg font-bold font-mono', colorClasses[color])}>
          {value}
        </div>
        <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </div>
      </div>
    </button>
  );
}

interface QuickStatsHeaderProps {
  onStatClick?: (stat: 'cash' | 'pnl' | 'ar' | 'fronted' | 'alerts') => void;
}

export function QuickStatsHeader({ onStatClick }: QuickStatsHeaderProps) {
  const { data: stats, isLoading } = useQuickStats();

  if (isLoading) {
    return (
      <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="flex items-center justify-between px-4 py-2 overflow-x-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2">
              <Skeleton className="h-8 w-8 rounded bg-zinc-800" />
              <div className="space-y-1">
                <Skeleton className="h-5 w-16 bg-zinc-800" />
                <Skeleton className="h-3 w-12 bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/50 shadow-lg shadow-black/10">
      <div className="max-w-7xl mx-auto flex items-center justify-center md:justify-between px-2 sm:px-4 md:px-6 py-2 overflow-x-auto scrollbar-hide gap-1 sm:gap-2">
        <StatItem
          icon={<Wallet className="h-5 w-5" />}
          label="Cash"
          value={formatCompactCurrency(stats?.cashPosition || 0)}
          color="success"
          onClick={() => onStatClick?.('cash')}
        />
        
        <div className="w-px h-8 bg-zinc-800 hidden md:block" />
        
        <StatItem
          icon={<TrendingUp className="h-5 w-5" />}
          label="Today P&L"
          value={(stats?.todayPnL || 0) >= 0 
            ? `+${formatCompactCurrency(stats?.todayPnL || 0)}` 
            : formatCompactCurrency(stats?.todayPnL || 0)
          }
          color={(stats?.todayPnL || 0) >= 0 ? 'success' : 'danger'}
          onClick={() => onStatClick?.('pnl')}
        />
        
        <div className="w-px h-8 bg-zinc-800 hidden md:block" />
        
        <StatItem
          icon={<AlertCircle className="h-5 w-5" />}
          label="Outstanding"
          value={formatCompactCurrency(stats?.outstandingAR || 0)}
          color={(stats?.outstandingAR || 0) > 50000 ? 'danger' : 'warning'}
          onClick={() => onStatClick?.('ar')}
        />
        
        <div className="w-px h-8 bg-zinc-800 hidden md:block" />
        
        <StatItem
          icon={<Package className="h-5 w-5" />}
          label="Fronted"
          value={formatCompactCurrency(stats?.frontedValue || 0)}
          color="default"
          onClick={() => onStatClick?.('fronted')}
        />
        
        <div className="w-px h-8 bg-zinc-800 hidden md:block" />
        
        <button
          onClick={() => onStatClick?.('alerts')}
          className={cn(
            'relative flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg transition-all',
            'hover:bg-white/5 active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
            'flex-shrink-0'
          )}
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400" />
          {(stats?.alertCount || 0) > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] animate-pulse"
            >
              {stats?.alertCount}
            </Badge>
          )}
        </button>
      </div>
    </div>
  );
}


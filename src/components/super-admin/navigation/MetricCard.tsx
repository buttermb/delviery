/**
 * Metric Card Component
 * Mini metric card for displaying metrics in mega menus
 */

import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  className?: string;
}

export function MetricCard({ 
  label, 
  value, 
  change, 
  trend,
  className 
}: MetricCardProps) {
  return (
    <div className={cn('p-3 rounded-lg bg-muted/50 border border-border', className)}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold">{value}</span>
        {change && trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs',
            trend === 'up' ? 'text-success' : 'text-destructive'
          )}>
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{change}</span>
          </div>
        )}
      </div>
    </div>
  );
}


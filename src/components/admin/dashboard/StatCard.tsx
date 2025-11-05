/**
 * Stat Card Component - Modern dashboard stat card
 */

import { Link, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  href?: string;
}

const colorClasses = {
  blue: 'border-blue-500/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20',
  green: 'border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20',
  orange: 'border-orange-500/30 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20',
  red: 'border-red-500/30 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20',
  purple: 'border-purple-500/30 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20',
};

const iconColors = {
  blue: 'text-blue-500 bg-blue-500/10',
  green: 'text-emerald-500 bg-emerald-500/10',
  orange: 'text-orange-500 bg-orange-500/10',
  red: 'text-red-500 bg-red-500/10',
  purple: 'text-purple-500 bg-purple-500/10',
};

export function StatCard({
  title,
  value,
  change,
  subtitle,
  icon,
  color = 'blue',
  href,
}: StatCardProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const Component = href ? Link : 'div';
  
  // Build the full path with tenant slug if href is provided
  const fullPath = href 
    ? href.startsWith('/admin') && tenantSlug
      ? `/${tenantSlug}${href}`
      : href
    : '#';

  return (
    <Component
      to={fullPath}
      className={cn(href && 'cursor-pointer')}
    >
      <Card className={cn(
        'p-6 border-2 hover:shadow-lg transition-all',
        colorClasses[color],
        href && 'hover:scale-[1.02]'
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className={cn('p-2 rounded-lg', iconColors[color])}>
            {icon}
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        </div>

        <div className="text-2xl font-bold mb-1">{value}</div>

        {(change || subtitle) && (
          <div className="flex items-center gap-2 text-sm">
            {change && (
              <span
                className={cn(
                  'flex items-center gap-1 font-medium',
                  change.type === 'increase' ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {change.type === 'increase' ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                {change.value.toFixed(1)}%
              </span>
            )}
            {subtitle && (
              <span className="text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </Card>
    </Component>
  );
}


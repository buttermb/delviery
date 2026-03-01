/**
 * Stat Card Component - Modern dashboard stat card
 */

import type React from 'react';
import { Link, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { LastUpdated } from '@/components/shared/LastUpdated';

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
  onClick?: () => void;
  lastUpdated?: Date;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const colorClasses = {
  blue: 'border-blue-500/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20',
  green: 'border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20',
  orange: 'border-orange-500/30 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20',
  red: 'border-red-500/30 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20',
  purple: 'border-purple-500/30 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20',
};

const iconColors = {
  blue: 'text-accent bg-accent/10',
  green: 'text-primary bg-primary/10',
  orange: 'text-orange-500 dark:text-orange-400 bg-orange-500/10',
  red: 'text-destructive bg-destructive/10',
  purple: 'text-purple-500 dark:text-purple-400 bg-purple-500/10',
};

export function StatCard({
  title,
  value,
  change,
  subtitle,
  icon,
  color = 'blue',
  href,
  onClick,
  lastUpdated,
  onRefresh,
  isRefreshing,
}: StatCardProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Build the full path with tenant slug if href is provided
  const fullPath = href
    ? href.startsWith('/admin') && tenantSlug
      ? `/${tenantSlug}${href}`
      : href
    : undefined;

  const isClickable = !!onClick || !!fullPath;

  const cardContent = (
    <Card
      className={cn(
        'p-4 sm:p-6 hover:shadow-md transition-all',
        colorClasses[color],
        isClickable && 'hover:scale-[1.02] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-lg', iconColors[color])}>
          {icon}
        </div>
        <h3 className="text-sm font-medium text-muted-foreground truncate ml-2 text-right">{title}</h3>
      </div>

      <div className="text-2xl font-bold mb-1">{value}</div>

      {(change || subtitle) && (
        <div className="flex items-center gap-2 text-sm">
          {change && (
            <span
              className={cn(
                'flex items-center gap-1 font-medium',
                change.type === 'increase' ? 'text-primary' : 'text-destructive'
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

      {lastUpdated && (
        <LastUpdated
          date={lastUpdated}
          onRefresh={onRefresh}
          isLoading={isRefreshing}
          className="mt-2"
        />
      )}
    </Card>
  );

  if (fullPath) {
    return <Link to={fullPath}>{cardContent}</Link>;
  }

  return cardContent;
}


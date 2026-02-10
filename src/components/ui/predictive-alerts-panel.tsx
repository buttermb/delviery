/**
 * Predictive Alerts Panel Component
 * Displays proactive alerts with actions
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  Shield,
  ChevronRight,
  X,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PredictiveAlert, AlertSeverity, AlertCategory } from '@/hooks/usePredictiveAlerts';

interface PredictiveAlertsPanelProps {
  alerts: PredictiveAlert[];
  onDismiss?: (alertId: string) => void;
  maxVisible?: number;
  className?: string;
  compact?: boolean;
}

export function PredictiveAlertsPanel({
  alerts,
  onDismiss,
  maxVisible = 5,
  className,
  compact = false,
}: PredictiveAlertsPanelProps) {
  const visibleAlerts = alerts.slice(0, maxVisible);
  const hasMore = alerts.length > maxVisible;

  if (alerts.length === 0) {
    return null;
  }

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/20 text-red-600';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-600';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-600';
    }
  };

  const getCategoryIcon = (category: AlertCategory) => {
    switch (category) {
      case 'inventory': return <Package className="h-3.5 w-3.5" />;
      case 'orders': return <ShoppingCart className="h-3.5 w-3.5" />;
      case 'payments': return <CreditCard className="h-3.5 w-3.5" />;
      case 'customers': return <Users className="h-3.5 w-3.5" />;
      case 'compliance': return <Shield className="h-3.5 w-3.5" />;
    }
  };

  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        {visibleAlerts.map(alert => (
          <div
            key={alert.id}
            className={cn(
              'flex items-center gap-2 p-2 rounded-md border text-sm',
              getSeverityStyles(alert.severity)
            )}
          >
            {getSeverityIcon(alert.severity)}
            <span className="flex-1 truncate">{alert.title}</span>
            {alert.actionHref && (
              <Link to={alert.actionHref}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
        {hasMore && (
          <p className="text-xs text-muted-foreground text-center">
            +{alerts.length - maxVisible} more alerts
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('bg-card border rounded-lg', className)}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Predictive Alerts
          </h3>
          <Badge variant="secondary">{alerts.length}</Badge>
        </div>
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="divide-y">
          {visibleAlerts.map(alert => (
            <div
              key={alert.id}
              className={cn(
                'p-4 transition-colors hover:bg-muted/50',
                getSeverityStyles(alert.severity).replace('border-', 'hover:border-l-4 border-l-4 border-l-')
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5', getSeverityStyles(alert.severity).split(' ')[2])}>
                  {getSeverityIcon(alert.severity)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">{alert.title}</span>
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      {getCategoryIcon(alert.category)}
                      {alert.category}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">
                    {alert.message}
                  </p>

                  {alert.daysUntil !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <Clock className="h-3 w-3" />
                      {alert.daysUntil < 0
                        ? `${Math.abs(alert.daysUntil)} day${Math.abs(alert.daysUntil) === 1 ? '' : 's'} overdue`
                        : alert.daysUntil === 0
                        ? 'Due today'
                        : `${alert.daysUntil} day${alert.daysUntil === 1 ? '' : 's'} remaining`}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {alert.actionHref && (
                      <Button asChild variant="secondary" size="sm" className="h-7">
                        <Link to={alert.actionHref}>
                          {alert.actionLabel || 'View'}
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                    {onDismiss && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground"
                        onClick={() => onDismiss(alert.id)}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {hasMore && (
        <div className="p-3 border-t text-center">
          <Button variant="link" size="sm" className="text-muted-foreground">
            View all {alerts.length} alerts
          </Button>
        </div>
      )}
    </div>
  );
}

// Compact alert badge for headers
export function AlertBadge({ count, severity = 'warning' }: { count: number; severity?: AlertSeverity }) {
  if (count === 0) return null;

  const colors = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  return (
    <span className={cn('inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium text-white', colors[severity])}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

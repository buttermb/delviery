/**
 * Dashboard Notification Bell Component
 * Shows a bell icon with dropdown of recent alerts for quick access
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bell, Package, ShoppingCart, CreditCard, Shield, Users, ChevronRight, AlertCircle, AlertTriangle, Info, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDashboardAlerts } from '@/hooks/useDashboardAlerts';
import type { AlertSeverity, AlertCategory } from '@/hooks/usePredictiveAlerts';

interface DashboardNotificationBellProps {
  className?: string;
}

export function DashboardNotificationBell({ className }: DashboardNotificationBellProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [open, setOpen] = useState(false);

  const {
    alerts,
    unreadCount,
    isLoading,
    dismissAlert,
    dismissAll,
    markAsRead,
  } = useDashboardAlerts();

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-amber-500';
      case 'info': return 'bg-blue-500';
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'warning': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'info': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const getCategoryIcon = (category: AlertCategory) => {
    switch (category) {
      case 'inventory': return Package;
      case 'orders': return ShoppingCart;
      case 'payments': return CreditCard;
      case 'customers': return Users;
      case 'compliance': return Shield;
    }
  };

  const handleAlertClick = (alertId: string, href?: string) => {
    markAsRead(alertId);
    if (href) {
      // Replace /admin with tenant-aware path
      const tenantPath = href.replace('/admin/', `/${tenantSlug}/admin/`);
      navigate(tenantPath);
      setOpen(false);
    }
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.read).length;
  const hasCritical = criticalCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-10 w-10 min-h-[44px] min-w-[44px]", className)}
          aria-label={`${unreadCount} unread alerts`}
        >
          <Bell className={cn("h-5 w-5", hasCritical && "text-red-500")} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                "absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center",
                hasCritical ? "animate-pulse bg-red-500" : "bg-amber-500"
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 border-border shadow-lg"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Alerts</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={dismissAll}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Dismiss all
            </Button>
          )}
        </div>

        {/* Alerts List */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Bell className="h-6 w-6 opacity-30" />
              </div>
              <p className="font-medium">All clear!</p>
              <p className="text-xs mt-1">No alerts at the moment</p>
            </div>
          ) : (
            <div className="divide-y">
              {alerts.map((alert) => {
                const CategoryIcon = getCategoryIcon(alert.category);
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-4 hover:bg-muted/50 transition-colors cursor-pointer group relative",
                      !alert.read && "bg-muted/20"
                    )}
                    onClick={() => handleAlertClick(alert.id, alert.actionHref)}
                  >
                    <div className="flex gap-3">
                      {/* Severity Icon */}
                      <div className={cn(
                        "p-2 rounded-full h-fit shadow-sm flex-shrink-0",
                        getSeverityColor(alert.severity)
                      )}>
                        <CategoryIcon className="h-4 w-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-sm leading-tight truncate">
                            {alert.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] flex-shrink-0", getSeverityBadge(alert.severity))}
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                          {alert.message}
                        </p>

                        {/* Days Until (if applicable) */}
                        {alert.daysUntil !== undefined && (
                          <p className={cn(
                            "text-[11px] mt-1.5 font-medium",
                            alert.daysUntil <= 0 ? "text-red-600" : alert.daysUntil <= 3 ? "text-amber-600" : "text-muted-foreground"
                          )}>
                            {alert.daysUntil < 0
                              ? `${Math.abs(alert.daysUntil)} day${Math.abs(alert.daysUntil) === 1 ? '' : 's'} overdue`
                              : alert.daysUntil === 0
                              ? 'Due today'
                              : `${alert.daysUntil} day${alert.daysUntil === 1 ? '' : 's'} remaining`}
                          </p>
                        )}

                        {/* Action Link */}
                        {alert.actionHref && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-primary font-medium">
                            <span>{alert.actionLabel || 'View details'}</span>
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        )}
                      </div>

                      {/* Dismiss Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissAlert(alert.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {alerts.length > 0 && (
          <div className="p-3 border-t bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                navigate(`/${tenantSlug}/admin/alerts`);
                setOpen(false);
              }}
            >
              View all alerts
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

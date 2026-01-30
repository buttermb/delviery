import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Repeat, AlertCircle, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useScheduledMenus } from '@/hooks/useMenuScheduler';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ScheduledMenu {
  id: string;
  name: string;
  status: string;
  scheduledActivationTime: string | null;
  scheduledDeactivationTime: string | null;
  isScheduled: boolean;
  scheduleTimezone: string;
  recurrencePattern: string | null;
}

interface ScheduledMenuItemProps {
  menu: ScheduledMenu;
}

function ScheduledMenuItem({ menu }: ScheduledMenuItemProps) {
  const activationTime = menu.scheduledActivationTime ? new Date(menu.scheduledActivationTime) : null;
  const deactivationTime = menu.scheduledDeactivationTime ? new Date(menu.scheduledDeactivationTime) : null;
  const now = new Date();

  const getScheduleStatus = () => {
    if (!activationTime) return 'unknown';
    if (isPast(activationTime) && (!deactivationTime || isFuture(deactivationTime))) {
      return 'active';
    }
    if (isFuture(activationTime)) {
      return 'upcoming';
    }
    if (deactivationTime && isPast(deactivationTime)) {
      return 'expired';
    }
    return 'unknown';
  };

  const scheduleStatus = getScheduleStatus();

  const statusConfig = {
    upcoming: { label: 'Upcoming', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
    active: { label: 'Active', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
    expired: { label: 'Expired', color: 'bg-gray-500/10 text-gray-500 border-gray-500/30' },
    unknown: { label: 'Unknown', color: 'bg-gray-500/10 text-gray-500 border-gray-500/30' },
  };

  const config = statusConfig[scheduleStatus];

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          scheduleStatus === 'upcoming' && "bg-blue-500/10",
          scheduleStatus === 'active' && "bg-green-500/10",
          scheduleStatus === 'expired' && "bg-gray-500/10"
        )}>
          <Calendar className={cn(
            "h-5 w-5",
            scheduleStatus === 'upcoming' && "text-blue-600",
            scheduleStatus === 'active' && "text-green-600",
            scheduleStatus === 'expired' && "text-gray-500"
          )} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{menu.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            {activationTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {scheduleStatus === 'upcoming'
                  ? `Activates ${formatDistanceToNow(activationTime, { addSuffix: true })}`
                  : `Activated ${format(activationTime, 'MMM d, h:mm a')}`
                }
              </span>
            )}
            {menu.recurrencePattern && menu.recurrencePattern !== 'none' && (
              <span className="flex items-center gap-1">
                <Repeat className="h-3 w-3" />
                <span className="capitalize">{menu.recurrencePattern}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={cn("text-xs", config.color)}>
          {config.label}
        </Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ScheduledMenusPanel() {
  const { tenant } = useTenantAdminAuth();
  const { data: scheduledMenus = [], isLoading } = useScheduledMenus(tenant?.id);

  const { upcoming, active, past } = useMemo(() => {
    const now = new Date();
    const categorized = {
      upcoming: [] as ScheduledMenu[],
      active: [] as ScheduledMenu[],
      past: [] as ScheduledMenu[],
    };

    scheduledMenus.forEach((menu: ScheduledMenu) => {
      const activation = menu.scheduledActivationTime ? new Date(menu.scheduledActivationTime) : null;
      const deactivation = menu.scheduledDeactivationTime ? new Date(menu.scheduledDeactivationTime) : null;

      if (!activation) return;

      if (isFuture(activation)) {
        categorized.upcoming.push(menu);
      } else if (isPast(activation) && (!deactivation || isFuture(deactivation))) {
        categorized.active.push(menu);
      } else {
        categorized.past.push(menu);
      }
    });

    return categorized;
  }, [scheduledMenus]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (scheduledMenus.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No Scheduled Menus</p>
        <p className="text-sm mt-1">
          Schedule menus when creating them to have them automatically activate at specific times.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upcoming Section */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-600">
            <Clock className="h-4 w-4" />
            Upcoming ({upcoming.length})
          </h4>
          <div className="space-y-2">
            {upcoming.map((menu) => (
              <ScheduledMenuItem key={menu.id} menu={menu} />
            ))}
          </div>
        </div>
      )}

      {/* Currently Active Section */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-green-600">
            <Calendar className="h-4 w-4" />
            Currently Scheduled & Active ({active.length})
          </h4>
          <div className="space-y-2">
            {active.map((menu) => (
              <ScheduledMenuItem key={menu.id} menu={menu} />
            ))}
          </div>
        </div>
      )}

      {/* Past/Expired Section */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Past Schedules ({past.length})
          </h4>
          <div className="space-y-2 opacity-60">
            {past.slice(0, 5).map((menu) => (
              <ScheduledMenuItem key={menu.id} menu={menu} />
            ))}
            {past.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                + {past.length - 5} more past schedules
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

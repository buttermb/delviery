/**
 * OrderDeliveryWindow - Displays scheduled delivery time slot information
 * Shows the delivery window with date, time slot, and status indicators
 */

import { format, isToday, isTomorrow, isPast, isFuture, differenceInHours } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeSlot {
  label: string;
  start: string;
  end: string;
}

interface OrderDeliveryWindowProps {
  /** ISO timestamp for scheduled delivery */
  scheduledDeliveryAt?: string | null;
  /** Time slot label from store settings (e.g., "Morning (9am-12pm)") */
  timeSlotLabel?: string | null;
  /** Time slot details if available */
  timeSlot?: TimeSlot | null;
  /** Delivery status for context */
  deliveryStatus?: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  /** Whether to show compact version */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get display badge variant based on time urgency
 */
function getUrgencyVariant(
  scheduledDate: Date,
  deliveryStatus?: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (deliveryStatus === 'delivered') return 'secondary';
  if (deliveryStatus === 'cancelled') return 'outline';

  const hoursUntil = differenceInHours(scheduledDate, new Date());

  if (isPast(scheduledDate)) return 'destructive';
  if (hoursUntil <= 2) return 'destructive';
  if (hoursUntil <= 6) return 'default';
  return 'secondary';
}

/**
 * Format time slot string for display
 */
function formatTimeSlotDisplay(timeSlot: TimeSlot): string {
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'pm' : 'am';
    const hour12 = hours % 12 || 12;
    return minutes === 0 ? `${hour12}${period}` : `${hour12}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  return `${formatTime(timeSlot.start)} - ${formatTime(timeSlot.end)}`;
}

/**
 * Get smart date display (Today, Tomorrow, or formatted date)
 */
function getSmartDateDisplay(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}

/**
 * OrderDeliveryWindow Component
 * Displays the scheduled delivery time window with visual indicators
 */
export function OrderDeliveryWindow({
  scheduledDeliveryAt,
  timeSlotLabel,
  timeSlot,
  deliveryStatus,
  compact = false,
  className,
}: OrderDeliveryWindowProps) {
  // No scheduled delivery
  if (!scheduledDeliveryAt) {
    if (compact) {
      return (
        <span className={cn('text-sm text-muted-foreground', className)}>
          No scheduled time
        </span>
      );
    }

    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Clock className="h-4 w-4" />
        <span>No scheduled delivery time</span>
      </div>
    );
  }

  const scheduledDate = new Date(scheduledDeliveryAt);

  if (isNaN(scheduledDate.getTime())) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        Invalid date
      </span>
    );
  }

  const smartDate = getSmartDateDisplay(scheduledDate);
  const timeDisplay = timeSlot
    ? formatTimeSlotDisplay(timeSlot)
    : format(scheduledDate, 'h:mm a');
  const urgencyVariant = getUrgencyVariant(scheduledDate, deliveryStatus);
  const isOverdue = isPast(scheduledDate) && deliveryStatus !== 'delivered';
  const isUpcoming = isFuture(scheduledDate) && differenceInHours(scheduledDate, new Date()) <= 2;

  // Compact display - just badge
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={urgencyVariant}
              className={cn('cursor-default', className)}
            >
              <CalendarClock className="h-3 w-3 mr-1" />
              {smartDate}, {timeSlotLabel || timeDisplay}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">Scheduled Delivery</p>
              <p>{format(scheduledDate, 'EEEE, MMMM d, yyyy')}</p>
              <p>{timeSlotLabel || timeDisplay}</p>
              {isOverdue && (
                <p className="text-destructive mt-1">Delivery window has passed</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full display with card
  return (
    <Card className={cn('border', className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'p-2 rounded-full',
            deliveryStatus === 'delivered' && 'bg-green-100 text-green-600',
            deliveryStatus === 'in_transit' && 'bg-blue-100 text-blue-600',
            isOverdue && 'bg-destructive/10 text-destructive',
            !deliveryStatus && !isOverdue && 'bg-muted'
          )}>
            {deliveryStatus === 'delivered' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : deliveryStatus === 'in_transit' ? (
              <Truck className="h-5 w-5" />
            ) : isOverdue ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CalendarClock className="h-5 w-5" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium">Scheduled Delivery</h4>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              )}
              {isUpcoming && !isOverdue && (
                <Badge variant="default" className="text-xs">
                  Upcoming
                </Badge>
              )}
            </div>

            {/* Date and Time */}
            <div className="mt-1 space-y-0.5">
              <p className="text-base font-semibold">
                {smartDate}
              </p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {timeSlotLabel || timeDisplay}
                </span>
              </div>
            </div>

            {/* Full date for reference */}
            <p className="text-xs text-muted-foreground mt-2">
              {format(scheduledDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline version for use in tables/lists
 */
export function OrderDeliveryWindowInline({
  scheduledDeliveryAt,
  timeSlotLabel,
  timeSlot,
  deliveryStatus,
  className,
}: Omit<OrderDeliveryWindowProps, 'compact'>) {
  if (!scheduledDeliveryAt) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        —
      </span>
    );
  }

  const scheduledDate = new Date(scheduledDeliveryAt);

  if (isNaN(scheduledDate.getTime())) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        —
      </span>
    );
  }

  const smartDate = getSmartDateDisplay(scheduledDate);
  const timeDisplay = timeSlot
    ? formatTimeSlotDisplay(timeSlot)
    : format(scheduledDate, 'h:mm a');
  const isOverdue = isPast(scheduledDate) && deliveryStatus !== 'delivered';

  return (
    <div className={cn('flex items-center gap-1.5 text-sm', className)}>
      <CalendarClock className={cn(
        'h-4 w-4',
        isOverdue ? 'text-destructive' : 'text-muted-foreground'
      )} />
      <span className={cn(
        isOverdue && 'text-destructive'
      )}>
        {smartDate}, {timeSlotLabel || timeDisplay}
      </span>
    </div>
  );
}

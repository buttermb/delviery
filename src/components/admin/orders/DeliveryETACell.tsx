/**
 * DeliveryETACell — table cell component for showing delivery ETA.
 *
 * Shows:
 * - Estimated time remaining (e.g. "~23 min")
 * - Runner name
 * - Overdue deliveries highlighted in red
 * - Clicking opens a delivery detail panel
 *
 * Renders nothing for orders that are not currently in delivery.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Truck, MapPin, Phone, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatSmartDate } from '@/lib/formatters';

import type { DeliveryETA } from '@/hooks/useDeliveryETA';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailPanel } from '@/components/admin/shared/DetailPanel';
import { Separator } from '@/components/ui/separator';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { cn } from '@/lib/utils';

interface DeliveryETACellProps {
  eta: DeliveryETA | undefined;
  orderStatus: string;
}

function formatETA(minutes: number): string {
  if (minutes <= 0) return 'Now';
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `~${hours}h`;
  return `~${hours}h ${remaining}m`;
}

function formatTime(date: Date): string {
  return formatSmartDate(date, { includeTime: true });
}

function getDeliveryStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    assigned: 'Assigned',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    delivered: 'Delivered',
  };
  return labels[status] || status;
}

function getDeliveryStatusColor(status: string): string {
  const colors: Record<string, string> = {
    assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    picked_up: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    in_transit: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  };
  return colors[status] || '';
}

export function DeliveryETACell({ eta, orderStatus }: DeliveryETACellProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const navigate = useTenantNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Only show for delivery-related statuses
  const isInDelivery = ['in_transit', 'out_for_delivery'].includes(orderStatus);

  if (!eta && !isInDelivery) {
    return <span className="text-muted-foreground text-xs">--</span>;
  }

  if (!eta && isInDelivery) {
    return (
      <span className="text-muted-foreground text-xs italic">No tracking</span>
    );
  }

  if (!eta) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsPanelOpen(true);
        }}
        className={cn(
          'flex flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left transition-colors',
          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          eta.isOverdue
            ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
            : 'bg-transparent'
        )}
      >
        <div className="flex items-center gap-1.5">
          {eta.isOverdue ? (
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <span
            className={cn(
              'text-sm font-medium tabular-nums',
              eta.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            )}
          >
            {eta.isOverdue ? 'Overdue' : formatETA(eta.estimatedMinutesRemaining)}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
          {eta.runnerName}
        </span>
      </button>

      {/* Delivery Detail Panel */}
      <DetailPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title="Delivery Tracking"
        entityType="DELIVERY"
        entityId={eta.deliveryId}
        width="md"
        actions={[
          {
            label: 'View Full Tracking',
            icon: ExternalLink,
            onClick: () => {
              setIsPanelOpen(false);
              navigate(`/${tenantSlug}/admin/delivery-tracking/${eta.deliveryId}`);
            },
          },
        ]}
      >
        <div className="space-y-5">
          {/* ETA Summary */}
          <div className={cn(
            'rounded-lg p-4 text-center',
            eta.isOverdue
              ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
              : 'bg-muted/30 border'
          )}>
            <p className="text-sm text-muted-foreground mb-1">Estimated Arrival</p>
            <p className={cn(
              'text-2xl font-bold tabular-nums',
              eta.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            )}>
              {eta.isOverdue
                ? 'OVERDUE'
                : formatETA(eta.estimatedMinutesRemaining)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ETA: {formatTime(eta.estimatedArrival)}
            </p>
          </div>

          {/* Delivery Status */}
          <div>
            <h4 className="text-sm font-medium mb-2">Status</h4>
            <Badge className={getDeliveryStatusColor(eta.deliveryStatus)}>
              {getDeliveryStatusLabel(eta.deliveryStatus)}
            </Badge>
          </div>

          <Separator />

          {/* Runner Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Runner
            </h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{eta.runnerName}</span>
            </div>
            {eta.runnerPhone && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Phone</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-sm font-medium text-primary"
                  onClick={() => {
                    if (eta.runnerPhone) {
                      window.location.href = `tel:${eta.runnerPhone}`;
                    }
                  }}
                >
                  <Phone className="h-3.5 w-3.5 mr-1" />
                  {eta.runnerPhone}
                </Button>
              </div>
            )}
            {eta.remainingStopsBefore > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stops ahead</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {eta.remainingStopsBefore} stop{eta.remainingStopsBefore > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Timeline</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Assigned</span>
                <span className="text-sm tabular-nums">
                  {new Date(eta.assignedAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {eta.pickedUpAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Picked up</span>
                  <span className="text-sm tabular-nums">
                    {new Date(eta.pickedUpAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Est. arrival</span>
                <span className={cn(
                  'text-sm font-medium tabular-nums',
                  eta.isOverdue ? 'text-red-600 dark:text-red-400' : ''
                )}>
                  {formatTime(eta.estimatedArrival)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DetailPanel>
    </>
  );
}

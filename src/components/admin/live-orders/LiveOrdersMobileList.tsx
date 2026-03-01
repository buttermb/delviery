import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  Clock,
  CheckCircle,
  Package,
  Truck,
  MapPin,
  AlertCircle,
  ChevronRight,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { AssignToFleetDialog } from '@/components/admin/AssignToFleetDialog';
import { OrderLink } from '@/components/admin/cross-links';
import { LiveOrderStatusBadge } from '@/components/admin/live-orders/LiveOrderStatusBadge';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { formatCurrency } from '@/lib/formatters';
import type { LiveOrder } from '@/components/admin/live-orders/LiveOrdersKanban';
import { getValidNextStatuses } from '@/components/admin/live-orders/LiveOrdersKanban';

interface LiveOrdersMobileListProps {
  orders: LiveOrder[];
  onStatusChange: (orderId: string, newStatus: string, source: 'menu' | 'app') => void;
  isLoading?: boolean;
}

// Reuse same column definitions as Kanban for consistency
const SECTIONS = [
  {
    id: 'new',
    label: 'New',
    statuses: ['pending'],
    color: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    accentColor: 'text-blue-600 dark:text-blue-400',
    icon: AlertCircle,
  },
  {
    id: 'prep',
    label: 'Preparing',
    statuses: ['confirmed', 'processing', 'preparing'],
    color: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    accentColor: 'text-orange-600 dark:text-orange-400',
    icon: Package,
  },
  {
    id: 'ready',
    label: 'Ready',
    statuses: ['ready_for_pickup', 'ready'],
    color: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    accentColor: 'text-yellow-600 dark:text-yellow-400',
    icon: CheckCircle,
  },
  {
    id: 'driver',
    label: 'In Transit',
    statuses: ['in_transit', 'picked_up'],
    color: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    accentColor: 'text-purple-600 dark:text-purple-400',
    icon: Truck,
  },
  {
    id: 'delivered',
    label: 'Done',
    statuses: ['delivered', 'completed'],
    color: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    accentColor: 'text-green-600 dark:text-green-400',
    icon: MapPin,
  },
];

function MobileOrderCard({
  order,
  onStatusChange,
}: {
  order: LiveOrder;
  onStatusChange: LiveOrdersMobileListProps['onStatusChange'];
}) {
  const [fleetDialogOpen, setFleetDialogOpen] = useState(false);
  const { isEnabled } = useTenantFeatureToggles();
  const deliveryEnabled = isEnabled('delivery_tracking');

  const validActions = getValidNextStatuses(order.status);
  const primaryAction = validActions.find((a) => a.variant === 'default');
  const cancelAction = validActions.find((a) => a.status === 'cancelled');
  const showAssignToFleet =
    (order.status === 'ready_for_pickup' || order.status === 'ready') && !order.courier_id;

  const created = new Date(order.created_at);
  const slaTarget = new Date(created.getTime() + 45 * 60000);
  const isLate = new Date() > slaTarget;

  return (
    <>
      <Card className="border-l-4 overflow-hidden">
        <CardContent className="p-3 space-y-2">
          {/* Top row: order number + status + amount */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-sm shrink-0">
                <OrderLink orderId={order.id} orderNumber={`#${order.order_number}`} />
              </span>
              <LiveOrderStatusBadge status={order.status} />
              {order.source === 'menu' && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1 shrink-0">
                  Menu
                </Badge>
              )}
            </div>
            {order.total_amount != null && (
              <span className="font-semibold text-sm shrink-0 ml-2">
                {formatCurrency(order.total_amount)}
              </span>
            )}
          </div>

          {/* Middle row: description + time */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{order.menu_title || 'App Order'}</span>
            <div
              className={cn(
                'flex items-center gap-1 shrink-0 ml-2 px-1.5 py-0.5 rounded-full text-[11px] font-medium',
                isLate
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(created, { addSuffix: true })}
            </div>
          </div>

          {/* Action buttons */}
          {(primaryAction || cancelAction || showAssignToFleet) && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              {cancelAction ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    onStatusChange(order.id, cancelAction.status, order.source || 'app')
                  }
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {showAssignToFleet && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() => setFleetDialogOpen(true)}
                    disabled={!deliveryEnabled}
                  >
                    <Truck className="h-3 w-3" />
                    Fleet
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() =>
                      onStatusChange(order.id, primaryAction.status, order.source || 'app')
                    }
                  >
                    {primaryAction.label}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AssignToFleetDialog
        open={fleetDialogOpen}
        onOpenChange={setFleetDialogOpen}
        orderId={order.id}
        orderNumber={order.order_number}
        isWholesale={false}
        deliveryAddress={order.delivery_address}
      />
    </>
  );
}

export function LiveOrdersMobileList({
  orders,
  onStatusChange,
  isLoading,
}: LiveOrdersMobileListProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const sections = useMemo(() => {
    return SECTIONS.map((section) => ({
      ...section,
      orders: orders.filter((o) => section.statuses.includes(o.status)),
    })).filter((section) => section.orders.length > 0);
  }, [orders]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {sections.map((section) => {
        const isCollapsed = collapsedSections.has(section.id);
        const Icon = section.icon;

        return (
          <div key={section.id}>
            {/* Section header - tappable to collapse/expand */}
            <button
              onClick={() => toggleSection(section.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg mb-2',
                section.color,
                'border',
                section.borderColor
              )}
            >
              <div className={cn('flex items-center gap-2 font-semibold text-sm', section.accentColor)}>
                <Icon className="h-4 w-4" />
                {section.label}
                <Badge variant="secondary" className="bg-white/60 dark:bg-white/10 text-xs">
                  {section.orders.length}
                </Badge>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  section.accentColor,
                  isCollapsed && '-rotate-90'
                )}
              />
            </button>

            {/* Order cards */}
            {!isCollapsed && (
              <div className="space-y-2">
                {section.orders.map((order) => (
                  <MobileOrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={onStatusChange}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

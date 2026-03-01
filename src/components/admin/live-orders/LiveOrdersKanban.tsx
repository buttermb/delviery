import { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCenter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
} from 'lucide-react';
  Clock,
  CheckCircle,
  Package,
  Truck,
  MapPin,
  AlertCircle,
  ChevronRight,
  MoreHorizontal,
  GripVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AssignToFleetDialog } from '@/components/admin/AssignToFleetDialog';
import { OrderLink } from '@/components/admin/cross-links';
import { LiveOrderStatusBadge } from '@/components/admin/live-orders/LiveOrderStatusBadge';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { formatCurrency } from '@/lib/formatters';

// Types
export interface LiveOrder {
    id: string;
    order_number: string;
    status: string;
    created_at: string;
    user_id: string;
    courier_id?: string;
    source?: 'menu' | 'app';
    menu_title?: string;
    total_amount?: number;
    customer_name?: string;
    customer_phone?: string;
    delivery_address?: string;
    payment_status?: string;
    payment_method?: string;
    payment_method?: string;
    payment_status?: string;
    order_type?: string;
    items_count?: number;
}

interface LiveOrdersKanbanProps {
    orders: LiveOrder[];
    onStatusChange: (orderId: string, newStatus: string, source: 'menu' | 'app') => void;
    isLoading?: boolean;
    newOrderIds?: Set<string>;
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  user_id: string;
  courier_id?: string;
  source?: 'menu' | 'app';
  menu_title?: string;
  total_amount?: number;
  customer_name?: string;
  delivery_address?: string;
}

interface LiveOrdersKanbanProps {
  orders: LiveOrder[];
  onStatusChange: (orderId: string, newStatus: string, source: 'menu' | 'app') => void;
  isLoading?: boolean;
}

// Column Configuration
const COLUMNS = [
  {
    id: 'new',
    label: 'NEW',
    statuses: ['pending'],
    dropStatus: 'pending',
    color: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    activeColor: 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400',
    icon: AlertCircle,
  },
  {
    id: 'prep',
    label: 'PREP',
    statuses: ['confirmed', 'processing', 'preparing'],
    dropStatus: 'preparing',
    color: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    activeColor: 'bg-orange-100 dark:bg-orange-900/40 ring-2 ring-orange-400',
    icon: Package,
  },
  {
    id: 'ready',
    label: 'READY',
    statuses: ['ready_for_pickup', 'ready'],
    dropStatus: 'ready_for_pickup',
    color: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    activeColor: 'bg-yellow-100 dark:bg-yellow-900/40 ring-2 ring-yellow-400',
    icon: CheckCircle,
  },
  {
    id: 'driver',
    label: 'DRIVER',
    statuses: ['in_transit', 'picked_up'],
    dropStatus: 'in_transit',
    color: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    activeColor: 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-400',
    icon: Truck,
  },
  {
    id: 'delivered',
    label: 'DONE',
    statuses: ['delivered', 'completed'],
    dropStatus: 'delivered',
    color: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    activeColor: 'bg-green-100 dark:bg-green-900/40 ring-2 ring-green-400',
    icon: MapPin,
  },
];

// Helper: SLA Countdown
function SLATimer({ createdAt }: { createdAt: string }) {
  const created = new Date(createdAt);
  const slaTarget = new Date(created.getTime() + 45 * 60000);
  const isLate = new Date() > slaTarget;

  return (
    <div className={cn(
      'flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
      isLate ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    )}>
      <Clock className="h-3 w-3" />
      <span>{formatDistanceToNow(created, { addSuffix: true })}</span>
    </div>
  );
}

/**
 * Returns valid next statuses for an order based on its current status.
 * Follows the defined progression: pending → confirmed → preparing → ready_for_pickup → in_transit → delivered
 * Cancel is available at every non-terminal step. Reject is only valid for pending orders.
 */
export function getValidNextStatuses(
    currentStatus: string
): Array<{ status: string; label: string; variant: 'default' | 'destructive' }> {
    switch (currentStatus) {
        case 'pending':
            return [
                { status: 'confirmed', label: 'Confirm', variant: 'default' },
                { status: 'rejected', label: 'Reject', variant: 'destructive' },
                { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
            ];
        case 'confirmed':
            return [
                { status: 'preparing', label: 'Start Preparing', variant: 'default' },
                { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
            ];
        case 'processing':
            return [
                { status: 'preparing', label: 'Start Preparing', variant: 'default' },
                { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
            ];
        case 'preparing':
            return [
                { status: 'ready_for_pickup', label: 'Mark Ready', variant: 'default' },
                { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
            ];
        case 'ready_for_pickup':
        case 'ready':
            return [
                { status: 'in_transit', label: 'Out for Delivery', variant: 'default' },
                { status: 'cancelled', label: 'Cancel', variant: 'destructive' },
            ];
        case 'in_transit':
        case 'picked_up':
            return [
                { status: 'delivered', label: 'Mark Delivered', variant: 'default' },
            ];
        case 'delivered':
        case 'completed':
        case 'cancelled':
        case 'rejected':
            return [];
        default:
            return [];
    }
}

function KanbanCard({ order, onStatusChange }: { order: LiveOrder, onStatusChange: LiveOrdersKanbanProps['onStatusChange'] }) {
function KanbanCard({ order, onStatusChange, isNew }: { order: LiveOrder; onStatusChange: LiveOrdersKanbanProps['onStatusChange']; isNew?: boolean }) {
    const [fleetDialogOpen, setFleetDialogOpen] = useState(false);
    const { isEnabled } = useTenantFeatureToggles();
    const deliveryEnabled = isEnabled('delivery_tracking');

    const validActions = getValidNextStatuses(order.status);
    const primaryAction = validActions.find(a => a.variant === 'default');
    const cancelAction = validActions.find(a => a.status === 'cancelled');
// Draggable Kanban Card
function DraggableKanbanCard({
  order,
  onStatusChange,
}: {
  order: LiveOrder;
  onStatusChange: LiveOrdersKanbanProps['onStatusChange'];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'z-50')}>
      <KanbanCardContent
        order={order}
        onStatusChange={onStatusChange}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// Card content (shared between draggable card and drag overlay)
function KanbanCardContent({
  order,
  onStatusChange,
  dragHandleProps,
  isOverlay,
}: {
  order: LiveOrder;
  onStatusChange: LiveOrdersKanbanProps['onStatusChange'];
  dragHandleProps?: Record<string, unknown>;
  isOverlay?: boolean;
}) {
  const [fleetDialogOpen, setFleetDialogOpen] = useState(false);
  const { isEnabled } = useTenantFeatureToggles();
  const deliveryEnabled = isEnabled('delivery_tracking');

    return (
        <>
            <Card className={cn(
                "mb-2 hover:shadow-md transition-all border-l-4 overflow-hidden relative group",
                isNew && "animate-new-order-slide-in ring-2 ring-primary/40 border-l-primary"
            )}>
                <CardContent className="p-2.5 space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">
                                    <OrderLink orderId={order.id} orderNumber={`#${order.order_number}`} />
                                </span>
                                <LiveOrderStatusBadge status={order.status} />
                                {isNew && (
                                    <Badge className="text-[10px] h-5 px-1 bg-primary text-primary-foreground animate-pulse">NEW</Badge>
                                )}
                                {order.source === 'menu' && (
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1">Menu</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{order.menu_title || 'App Order'}</p>
                        </div>
                    </div>
  const getNextStatus = (current: string) => {
    switch (current) {
      case 'pending': return 'confirmed';
      case 'confirmed': return 'preparing';
      case 'preparing': return 'ready_for_pickup';
      case 'ready_for_pickup': return 'in_transit';
      case 'in_transit': return 'delivered';
      default: return null;
    }
  };

  const nextStatus = getNextStatus(order.status);
  const showAssignToFleet = (order.status === 'ready_for_pickup' || order.status === 'ready') && !order.courier_id;

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        {/* Cancel / Reject button */}
                        {cancelAction && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => onStatusChange(order.id, cancelAction.status, order.source || 'app')}
                                title="Cancel order"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {!cancelAction && <div />}

                        <div className="flex items-center gap-2">
                            {showAssignToFleet && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span tabIndex={0}>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                                    onClick={() => setFleetDialogOpen(true)}
                                                    disabled={!deliveryEnabled}
                                                >
                                                    <Truck className="h-3 w-3" />
                                                    Fleet
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        {!deliveryEnabled && (
                                            <TooltipContent>Enable Delivery Tracking in Settings</TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {primaryAction && (
                                <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => onStatusChange(order.id, primaryAction.status, order.source || 'app')}
                                >
                                    {primaryAction.label}
                                    <ChevronRight className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
  return (
    <>
      <Card className={cn(
        'mb-2 hover:shadow-md transition-all border-l-4 overflow-hidden relative group',
        isOverlay && 'shadow-xl ring-2 ring-primary/30 rotate-[2deg] scale-105',
      )}>
        <CardContent className="p-2.5 space-y-3">
          {/* Header with drag handle */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {dragHandleProps && (
                <button
                  {...dragHandleProps}
                  className="touch-none cursor-grab active:cursor-grabbing shrink-0 p-0.5 -ml-0.5 rounded hover:bg-muted/80 transition-colors"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">
                    <OrderLink orderId={order.id} orderNumber={`#${order.order_number}`} />
                  </span>
                  <LiveOrderStatusBadge status={order.status} />
                  {order.source === 'menu' && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1">Menu</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{order.menu_title || 'App Order'}</p>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="flex items-center justify-between text-xs">
            <SLATimer createdAt={order.created_at} />
            {order.total_amount != null && (
              <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
            )}
          </div>

          {/* Actions */}
          {!isOverlay && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Order actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onStatusChange(order.id, 'rejected', order.source || 'app')}>
                    Reject Order
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(order.id, 'cancelled', order.source || 'app')}>
                    Cancel Order
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2">
                {showAssignToFleet && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            onClick={() => setFleetDialogOpen(true)}
                            disabled={!deliveryEnabled}
                          >
                            <Truck className="h-3 w-3" />
                            Fleet
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!deliveryEnabled && (
                        <TooltipContent>Enable Delivery Tracking in Settings</TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
                {nextStatus && (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => onStatusChange(order.id, nextStatus, order.source || 'app')}
                  >
                    Next Stage
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fleet Assignment Dialog */}
      {!isOverlay && (
        <AssignToFleetDialog
          open={fleetDialogOpen}
          onOpenChange={setFleetDialogOpen}
          orderId={order.id}
          orderNumber={order.order_number}
          isWholesale={false}
          deliveryAddress={order.delivery_address}
        />
      )}
    </>
  );
}

// Droppable column wrapper
function DroppableColumn({
  columnId,
  isOver,
  children,
}: {
  columnId: string;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: columnId });

  return (
    <div ref={setNodeRef} className={cn('flex-1 transition-colors rounded-lg', isOver && 'ring-2 ring-primary/40')}>
      {children}
    </div>
  );
}

export function LiveOrdersKanban({ orders, onStatusChange, isLoading, newOrderIds }: LiveOrdersKanbanProps) {
    // Group orders by column
    const columns = useMemo(() => {
        return COLUMNS.map(col => ({
            ...col,
            orders: orders.filter(o => col.statuses.includes(o.status))
        }));
    }, [orders]);
export function LiveOrdersKanban({ orders, onStatusChange, isLoading }: LiveOrdersKanbanProps) {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Group orders by column
  const columns = useMemo(() => {
    return COLUMNS.map(col => ({
      ...col,
      orders: orders.filter(o => col.statuses.includes(o.status)),
    }));
  }, [orders]);

  // Find which column an item belongs to
  const findColumnForOrder = useCallback((orderId: string): string | null => {
    for (const col of columns) {
      if (col.orders.some(o => o.id === orderId)) {
        return col.id;
      }
    }
    return null;
  }, [columns]);

  const activeOrder = useMemo(
    () => activeOrderId ? orders.find(o => o.id === activeOrderId) ?? null : null,
    [activeOrderId, orders]
  );

  // Sensors with activation constraints to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveOrderId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }

    const overId = over.id as string;
    // Check if hovering over a column directly
    const isColumn = COLUMNS.some(c => c.id === overId);
    if (isColumn) {
      setOverColumnId(overId);
      return;
    }

                        {/* Orders List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {col.orders.length === 0 ? (
                                <div className="h-32 flex items-center justify-center text-muted-foreground/40 text-sm italic">
                                    Empty
                                </div>
                            ) : (
                                col.orders.map(order => (
                                    <KanbanCard
                                        key={order.id}
                                        order={order}
                                        onStatusChange={onStatusChange}
                                        isNew={newOrderIds?.has(order.id)}
                                    />
                                ))
                            )}
                        </div>
    // Otherwise, find which column the hovered order belongs to
    const col = findColumnForOrder(overId);
    setOverColumnId(col);
  }, [findColumnForOrder]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrderId(null);
    setOverColumnId(null);

    if (!over) return;

    const draggedOrderId = active.id as string;
    const overId = over.id as string;

    // Determine source column
    const sourceColumnId = findColumnForOrder(draggedOrderId);
    if (!sourceColumnId) return;

    // Determine target column: could be column ID or order ID
    let targetColumnId: string | null = null;
    if (COLUMNS.some(c => c.id === overId)) {
      targetColumnId = overId;
    } else {
      targetColumnId = findColumnForOrder(overId);
    }

    if (!targetColumnId || sourceColumnId === targetColumnId) return;

    // Find the order and target column config
    const order = orders.find(o => o.id === draggedOrderId);
    const targetCol = COLUMNS.find(c => c.id === targetColumnId);
    if (!order || !targetCol) return;

    // Use the column's dropStatus to set the new status
    onStatusChange(draggedOrderId, targetCol.dropStatus, order.source || 'app');
  }, [findColumnForOrder, orders, onStatusChange]);

  const handleDragCancel = useCallback(() => {
    setActiveOrderId(null);
    setOverColumnId(null);
  }, []);

  if (isLoading) {
    return <div className="text-center py-10">Loading orders...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-[calc(100vh-200px)] overflow-x-auto">
        <div className="flex gap-2 h-full pb-4 px-1">
          {columns.map(col => {
            const isOverThis = overColumnId === col.id && activeOrderId !== null;
            const orderIds = col.orders.map(o => o.id);

            return (
              <DroppableColumn key={col.id} columnId={col.id} isOver={isOverThis}>
                <div className={cn(
                  'flex flex-col h-full min-w-[200px] rounded-xl border border-slate-200/60 dark:border-slate-800/60 transition-all',
                  isOverThis ? col.activeColor : 'bg-slate-50/50 dark:bg-slate-900/20',
                )}>
                  {/* Column Header */}
                  <div className={cn('p-3 border-b flex items-center justify-between mb-2', col.borderColor, col.color, 'rounded-t-xl bg-opacity-50')}>
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <col.icon className="h-4 w-4 opacity-70" />
                      {col.label}
                    </div>
                    <Badge variant="secondary" className="bg-white/50 dark:bg-white/10 text-xs">
                      {col.orders.length}
                    </Badge>
                  </div>

                  {/* Orders List */}
                  <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
                    <div className="flex-1 overflow-y-auto p-2">
                      {col.orders.length === 0 ? (
                        <div className={cn(
                          'h-32 flex items-center justify-center text-sm italic rounded-lg border-2 border-dashed transition-colors',
                          isOverThis
                            ? 'border-primary/40 text-primary/60 bg-primary/5'
                            : 'border-transparent text-muted-foreground/40',
                        )}>
                          {isOverThis ? 'Drop here' : 'Empty'}
                        </div>
                      ) : (
                        col.orders.map(order => (
                          <DraggableKanbanCard
                            key={order.id}
                            order={order}
                            onStatusChange={onStatusChange}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </div>
              </DroppableColumn>
            );
          })}
        </div>
      </div>

      {/* Drag Overlay - floating card that follows the cursor */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeOrder ? (
          <div className="w-[240px]">
            <KanbanCardContent
              order={activeOrder}
              onStatusChange={onStatusChange}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

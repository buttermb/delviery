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
    MoreHorizontal
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { AssignToFleetDialog } from '@/components/admin/AssignToFleetDialog';
import { OrderLink } from '@/components/admin/cross-links';

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
        color: 'bg-blue-50 dark:bg-blue-950/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        icon: AlertCircle
    },
    {
        id: 'prep',
        label: 'PREP',
        statuses: ['confirmed', 'processing', 'preparing'],
        color: 'bg-orange-50 dark:bg-orange-950/20',
        borderColor: 'border-orange-200 dark:border-orange-800',
        icon: Package
    },
    {
        id: 'ready',
        label: 'READY',
        statuses: ['ready_for_pickup', 'ready'],
        color: 'bg-yellow-50 dark:bg-yellow-950/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        icon: CheckCircle
    },
    {
        id: 'driver',
        label: 'DRIVER',
        statuses: ['in_transit', 'picked_up'],
        color: 'bg-purple-50 dark:bg-purple-950/20',
        borderColor: 'border-purple-200 dark:border-purple-800',
        icon: Truck
    },
    {
        id: 'delivered',
        label: 'DONE',
        statuses: ['delivered', 'completed'],
        color: 'bg-green-50 dark:bg-green-950/20',
        borderColor: 'border-green-200 dark:border-green-800',
        icon: MapPin
    }
];

// Helper: SLA Countdown
function SLATimer({ createdAt }: { createdAt: string }) {
    const created = new Date(createdAt);
    // Standard SLA: 45 mins
    const slaTarget = new Date(created.getTime() + 45 * 60000);
    const isLate = new Date() > slaTarget;

    // Simplistic relative time for now
    // Ideally this updates every minute with a useInterval

    return (
        <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
            isLate ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
        )}>
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(created, { addSuffix: true })}</span>
        </div>
    );
}

function KanbanCard({ order, onStatusChange }: { order: LiveOrder, onStatusChange: LiveOrdersKanbanProps['onStatusChange'] }) {
    const [fleetDialogOpen, setFleetDialogOpen] = useState(false);

    // Determine next logical status
    const getNextStatus = (current: string) => {
        switch (current) {
            case 'pending': return 'confirmed';
            case 'confirmed': return 'preparing';
            case 'preparing': return 'ready_for_pickup';
            case 'ready_for_pickup': return 'in_transit'; // Or courier assignment
            case 'in_transit': return 'delivered';
            default: return null;
        }
    };

    const nextStatus = getNextStatus(order.status);

    // Show "Assign to Fleet" button for orders that are ready for pickup and don't have a courier assigned
    const showAssignToFleet = (order.status === 'ready_for_pickup' || order.status === 'ready') && !order.courier_id;

    return (
        <>
            <Card className="mb-3 hover:shadow-md transition-all border-l-4 overflow-hidden relative group">
                <CardContent className="p-3 space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">
                                    <OrderLink orderId={order.id} orderNumber={`#${order.order_number}`} />
                                </span>
                                {order.source === 'menu' && (
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1">Menu</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{order.menu_title || 'App Order'}</p>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="flex items-center justify-between text-xs">
                        <SLATimer createdAt={order.created_at} />
                        {order.total_amount && (
                            <span className="font-semibold">${Number(order.total_amount).toFixed(2)}</span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Order actions">
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
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                    onClick={() => setFleetDialogOpen(true)}
                                >
                                    <Truck className="h-3 w-3" />
                                    Fleet
                                </Button>
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
                </CardContent>
            </Card>

            {/* Fleet Assignment Dialog */}
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

export function LiveOrdersKanban({ orders, onStatusChange, isLoading }: LiveOrdersKanbanProps) {
    // Group orders by column
    const columns = useMemo(() => {
        return COLUMNS.map(col => ({
            ...col,
            orders: orders.filter(o => col.statuses.includes(o.status))
        }));
    }, [orders]);

    if (isLoading) {
        return <div className="text-center py-10">Loading orders...</div>;
    }

    return (
        <div className="h-[calc(100vh-200px)] overflow-x-auto">
            <div className="flex gap-4 min-w-[1200px] h-full pb-4 px-1">
                {columns.map(col => (
                    <div key={col.id} className="flex-1 min-w-[280px] flex flex-col h-full rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/60 dark:border-slate-800/60">
                        {/* Column Header */}
                        <div className={cn("p-3 border-b flex items-center justify-between mb-2", col.borderColor, col.color, "rounded-t-xl bg-opacity-50")}>
                            <div className="flex items-center gap-2 font-semibold text-sm">
                                <col.icon className="h-4 w-4 opacity-70" />
                                {col.label}
                            </div>
                            <Badge variant="secondary" className="bg-white/50 dark:bg-white/10 text-xs">
                                {col.orders.length}
                            </Badge>
                        </div>

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
                                    />
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

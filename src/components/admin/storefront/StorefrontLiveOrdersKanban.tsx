/**
 * Storefront Live Orders Kanban
 * Kanban-style order fulfillment board for storefront orders
 */

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
    Clock,
    Package,
    Truck,
    User,
    Phone,
    ChevronRight,
    Bell,
    MessageSquare,
    Mail,
    Send,
    Loader2,
    Store,
    XCircle,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { getValidNextStatuses } from '@/pages/admin/storefront/StorefrontLiveOrders';

// Types
interface StorefrontOrder {
    id: string;
    order_number: string;
    status: string;
    created_at: string;
    customer_name: string | null;
    customer_phone: string | null;
    customer_email?: string | null;
    total: number;
    total_amount?: number;
    items: unknown[];
    delivery_notes?: string | null;
    delivery_address?: unknown;
    shipping_method?: string | null;
    notification_sent?: boolean;
}

interface StorefrontKanbanProps {
    orders: StorefrontOrder[];
    onStatusChange: (orderId: string, newStatus: string) => void;
    onViewDetails: (orderId: string) => void;
    onNotifyCustomer?: (orderId: string, phone: string, email?: string) => Promise<boolean>;
    isLoading?: boolean;
    /** ID of order currently being updated (for loading state) */
    updatingOrderId?: string | null;
    telegramLink?: string | null;
}

// Column Configuration — action buttons now use getValidNextStatuses() instead of nextStatus
const COLUMNS = [
    {
        id: 'pending',
        label: 'NEW',
        statuses: ['pending'],
        color: 'bg-amber-50 dark:bg-amber-950/20',
        borderColor: 'border-amber-200 dark:border-amber-800',
        textColor: 'text-amber-700',
    },
    {
        id: 'preparing',
        label: 'PREPARING',
        statuses: ['confirmed', 'preparing'],
        color: 'bg-blue-50 dark:bg-blue-950/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-700',
    },
    {
        id: 'ready',
        label: 'READY',
        statuses: ['ready'],
        color: 'bg-green-50 dark:bg-green-950/20',
        borderColor: 'border-green-200 dark:border-green-800',
        textColor: 'text-green-700',
    },
    {
        id: 'out_for_delivery',
        label: 'OUT FOR DELIVERY',
        statuses: ['out_for_delivery'],
        color: 'bg-purple-50 dark:bg-purple-950/20',
        borderColor: 'border-purple-200 dark:border-purple-800',
        textColor: 'text-purple-700',
    },
];

// Helper: Time since order
function TimeSince({ createdAt }: { createdAt: string }) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    let display: string;
    let urgencyClass = 'text-muted-foreground';

    if (diffMins < 5) {
        display = 'Just now';
    } else if (diffMins < 60) {
        display = `${diffMins}m`;
        if (diffMins > 15) urgencyClass = 'text-amber-600 font-medium';
        if (diffMins > 30) urgencyClass = 'text-red-600 font-bold';
    } else {
        const hours = Math.floor(diffMins / 60);
        display = `${hours}h ${diffMins % 60}m`;
        urgencyClass = 'text-red-600 font-bold';
    }

    return (
        <div className={cn('flex items-center gap-1 text-xs', urgencyClass)}>
            <Clock className="h-3 w-3" />
            {display}
        </div>
    );
}

// Kanban Card
function KanbanCard({
    order,
    column,
    onStatusChange,
    onViewDetails,
    onNotifyCustomer,
    isUpdating,
    telegramLink,
}: {
    order: StorefrontOrder;
    column: typeof COLUMNS[0];
    onStatusChange: StorefrontKanbanProps['onStatusChange'];
    onViewDetails: StorefrontKanbanProps['onViewDetails'];
    onNotifyCustomer?: StorefrontKanbanProps['onNotifyCustomer'];
    isUpdating?: boolean;
    telegramLink?: string | null;
}) {
    const items = Array.isArray(order.items) ? order.items : [];
    const itemCount = items.length;
    const [isSendingNotification, setIsSendingNotification] = useState(false);
    const [notificationSent, setNotificationSent] = useState(order.notification_sent ?? false);

    // Determine fulfillment type
    const fulfillmentType = (() => {
        if (order.shipping_method) {
            const method = order.shipping_method.toLowerCase();
            if (method.includes('pickup') || method.includes('collect')) return 'pickup' as const;
            return 'delivery' as const;
        }
        if (!order.delivery_address) return 'pickup' as const;
        return 'delivery' as const;
    })();

    const isReadyColumn = column.id === 'ready';
    const canNotify = isReadyColumn && (order.customer_phone || order.customer_email) && !notificationSent;

    const handleNotify = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onNotifyCustomer || !order.customer_phone) return;

        setIsSendingNotification(true);
        try {
            const success = await onNotifyCustomer(
                order.id,
                order.customer_phone,
                order.customer_email || undefined
            );
            if (success) {
                setNotificationSent(true);
            }
        } finally {
            setIsSendingNotification(false);
        }
    };

    return (
        <Card
            className={cn(
                'cursor-pointer hover:shadow-md transition-all border-l-4',
                column.borderColor
            )}
            onClick={() => onViewDetails(order.id)}
        >
            <CardContent className="p-3 space-y-2">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                    <div>
                        <p className="font-semibold text-sm">#{order.order_number}</p>
                        <TimeSince createdAt={order.created_at} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary" className="text-xs">
                            {formatCurrency(order.total || order.total_amount || 0)}
                        </Badge>
                        <Badge
                            variant="outline"
                            className={cn(
                                'text-[10px] px-1.5 py-0',
                                fulfillmentType === 'delivery'
                                    ? 'border-blue-300 text-blue-700 bg-blue-50'
                                    : 'border-orange-300 text-orange-700 bg-orange-50'
                            )}
                        >
                            {fulfillmentType === 'delivery' ? (
                                <><Truck className="h-2.5 w-2.5 mr-0.5" /> Delivery</>
                            ) : (
                                <><Store className="h-2.5 w-2.5 mr-0.5" /> Pickup</>
                            )}
                        </Badge>
                    </div>
                </div>

                {/* Customer */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate">{order.customer_name || 'Guest'}</span>
                </div>

                {/* Contact shortcuts */}
                {(order.customer_phone || order.customer_email || telegramLink) && (
                    <TooltipProvider delayDuration={200}>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {order.customer_phone && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                            <a href={`tel:${order.customer_phone}`} aria-label="Call">
                                                <Phone className="h-3 w-3" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">Call</TooltipContent>
                                </Tooltip>
                            )}
                            {order.customer_phone && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                            <a href={`sms:${order.customer_phone}`} aria-label="SMS">
                                                <MessageSquare className="h-3 w-3" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">SMS</TooltipContent>
                                </Tooltip>
                            )}
                            {order.customer_email && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                            <a href={`mailto:${order.customer_email}`} aria-label="Email">
                                                <Mail className="h-3 w-3" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">Email</TooltipContent>
                                </Tooltip>
                            )}
                            {telegramLink && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                            <a href={telegramLink} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                                                <Send className="h-3 w-3" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">Telegram</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </TooltipProvider>
                )}

                {/* Items */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Notes */}
                {order.delivery_notes && (
                    <p className="text-xs text-muted-foreground italic truncate">
                        "{order.delivery_notes}"
                    </p>
                )}

                {/* Notify Customer Button - Only in Ready column */}
                {canNotify && onNotifyCustomer && (
                    <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-green-100 hover:bg-green-200 text-green-700"
                        onClick={handleNotify}
                        disabled={isSendingNotification}
                    >
                        {isSendingNotification ? (
                            <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Bell className="h-3 w-3 mr-1" />
                                Notify Customer
                            </>
                        )}
                    </Button>
                )}

                {/* Notification Sent Indicator */}
                {isReadyColumn && notificationSent && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                        <MessageSquare className="h-3 w-3" />
                        <span>Customer notified</span>
                    </div>
                )}

                {/* Action Buttons — valid next statuses */}
                {(() => {
                    const validActions = getValidNextStatuses(order.status, fulfillmentType);
                    const primaryAction = validActions.find(a => a.variant === 'default');
                    const cancelAction = validActions.find(a => a.variant === 'destructive');

                    if (validActions.length === 0) return null;

                    return (
                        <div className="flex gap-1 mt-2">
                            {primaryAction && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-xs h-7"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(order.id, primaryAction.status);
                                    }}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? (
                                        <>
                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            {primaryAction.label}
                                            <ChevronRight className="h-3 w-3 ml-1" />
                                        </>
                                    )}
                                </Button>
                            )}
                            {cancelAction && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(order.id, cancelAction.status);
                                    }}
                                    disabled={isUpdating}
                                    title="Cancel order"
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    );
                })()}
            </CardContent>
        </Card>
    );
}

// Main Kanban Component
export function StorefrontLiveOrdersKanban({
    orders,
    onStatusChange,
    onViewDetails,
    onNotifyCustomer,
    isLoading,
    updatingOrderId,
    telegramLink,
}: StorefrontKanbanProps) {
    // Group orders by column
    const ordersByColumn = useMemo(() => {
        const grouped: Record<string, StorefrontOrder[]> = {};
        COLUMNS.forEach((col) => {
            grouped[col.id] = orders.filter((order) =>
                col.statuses.includes(order.status)
            );
        });
        return grouped;
    }, [orders]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {COLUMNS.map((col) => (
                    <div key={col.id} className={cn('rounded-lg p-3', col.color)}>
                        <div className="h-6 w-24 bg-muted rounded animate-pulse mb-4" />
                        <div className="space-y-2">
                            {[1, 2].map((i) => (
                                <div key={i} className="h-32 bg-muted rounded animate-pulse" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLUMNS.map((column) => {
                const columnOrders = ordersByColumn[column.id] ?? [];

                return (
                    <div
                        key={column.id}
                        className={cn(
                            'rounded-lg p-3 min-h-[400px] flex flex-col',
                            column.color
                        )}
                    >
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className={cn('font-bold text-sm', column.textColor)}>
                                    {column.label}
                                </h3>
                                <Badge variant="secondary" className="text-xs">
                                    {columnOrders.length}
                                </Badge>
                            </div>
                        </div>

                        {/* Orders - scrollable container */}
                        <div className="space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
                            {columnOrders.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No orders
                                </div>
                            ) : (
                                columnOrders.map((order) => (
                                    <KanbanCard
                                        key={order.id}
                                        order={order}
                                        column={column}
                                        onStatusChange={onStatusChange}
                                        onViewDetails={onViewDetails}
                                        onNotifyCustomer={onNotifyCustomer}
                                        isUpdating={updatingOrderId === order.id}
                                        telegramLink={telegramLink}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}


import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ShoppingBag, User, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PendingOrder } from '@/hooks/usePendingOrders';

interface PendingOrderCardProps {
    order: PendingOrder;
    onLoad: (order: PendingOrder) => void;
    onCancel: (order: PendingOrder) => void;
}

export function PendingOrderCard({ order, onLoad, onCancel }: PendingOrderCardProps) {
    const customerName = order.customer
        ? `${order.customer.first_name} ${order.customer.last_name}`
        : 'Guest Customer';

    const itemCount = order.items?.length ?? 0;

    return (
        <Card className="overflow-hidden border-l-4 border-l-primary">
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{customerName}</span>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Ready for Pickup
                    </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" />
                        <span>{itemCount} items</span>
                    </div>
                    <div className="font-semibold text-foreground">
                        ${order.total_amount.toFixed(2)}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        className="flex-1"
                        size="sm"
                        onClick={() => onLoad(order)}
                    >
                        Load Order
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onCancel(order)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

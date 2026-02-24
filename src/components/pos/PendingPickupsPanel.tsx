import { useState } from 'react';
import { usePendingOrders, PendingOrder } from '@/hooks/usePendingOrders';
import { PendingOrderCard } from './PendingOrderCard';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PendingPickupsPanelProps {
    tenantId: string;
    onLoadOrder: (order: PendingOrder) => void;
    onCancelOrder: (order: PendingOrder) => void;
}

export function PendingPickupsPanel({ tenantId, onLoadOrder, onCancelOrder }: PendingPickupsPanelProps) {
    const { orders, loading, refresh } = usePendingOrders(tenantId);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredOrders = orders.filter(order => {
        if (!searchQuery) return true;
        const customerName = order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.toLowerCase()
            : '';
        return customerName.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search pickups..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                        aria-label="Search pickups"
                    />
                </div>
                <Button variant="ghost" size="icon" onClick={refresh} disabled={loading} aria-label="Refresh pending pickups">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-3 pb-4">
                    {filteredOrders.length > 0 ? (
                        filteredOrders.map(order => (
                            <PendingOrderCard
                                key={order.id}
                                order={order}
                                onLoad={onLoadOrder}
                                onCancel={onCancelOrder}
                            />
                        ))
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            {loading ? 'Loading orders...' : 'No pending pickups found'}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

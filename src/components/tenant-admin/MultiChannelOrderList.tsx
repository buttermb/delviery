/**
 * Multi-Channel Order List
 * Aggregates orders from Wholesale, POS, and Online channels
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ShoppingBag,
    Store,
    Globe,
    Search,
    Filter,
    ArrowUpRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { useNavigate } from 'react-router-dom';

type OrderChannel = 'wholesale' | 'pos' | 'online';

interface ChannelOrder {
    id: string;
    channel: OrderChannel;
    customer_name: string;
    total_amount: number;
    status: string;
    created_at: string;
    order_number: string;
}

export function MultiChannelOrderList() {
    const navigate = useNavigate();
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;
    const [searchTerm, setSearchTerm] = useState('');
    const [channelFilter, setChannelFilter] = useState<OrderChannel | 'all'>('all');

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['multi-channel-orders', tenantId, channelFilter],
        queryFn: async () => {
            if (!tenantId) return [];

            // Fetch Wholesale Orders
            // @ts-ignore - Outdated Supabase types
            const { data: wholesale } = await supabase
                .from('wholesale_orders')
                .select(`
          id, 
          total_amount, 
          status, 
          created_at,
          wholesale_clients(business_name)
        `)
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(20);

            // Fetch POS Orders (Mock for now if table doesn't exist or is separate)
            // In a real scenario, this would query a 'pos_orders' table or filter a unified 'orders' table
            const pos: ChannelOrder[] = []; // Placeholder

            // Fetch Online Orders (Mock)
            const online: ChannelOrder[] = []; // Placeholder

            // Map to unified format
            const unifiedOrders: ChannelOrder[] = [
                ...(wholesale || []).map((o: any) => ({
                    id: o.id,
                    channel: 'wholesale' as OrderChannel,
                    customer_name: o.wholesale_clients?.business_name || 'Unknown Client',
                    total_amount: Number(o.total_amount),
                    status: o.status,
                    created_at: o.created_at,
                    order_number: `WS-${o.id.substring(0, 6).toUpperCase()}`
                })),
                ...pos,
                ...online
            ];

            // Sort by date
            return unifiedOrders.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        },
        enabled: !!tenantId,
    });

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.order_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesChannel = channelFilter === 'all' || order.channel === channelFilter;
        return matchesSearch && matchesChannel;
    });

    const getChannelIcon = (channel: OrderChannel) => {
        switch (channel) {
            case 'wholesale': return Store;
            case 'pos': return ShoppingBag;
            case 'online': return Globe;
        }
    };

    const getChannelColor = (channel: OrderChannel) => {
        switch (channel) {
            case 'wholesale': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
            case 'pos': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
            case 'online': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400';
        }
    };

    const getChannelLabel = (channel: OrderChannel) => {
        switch (channel) {
            case 'wholesale': return 'Wholesale';
            case 'pos': return 'In-Store';
            case 'online': return 'Online';
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle>Recent Orders</CardTitle>
                    <div className="flex gap-2">
                        <Button
                            variant={channelFilter === 'all' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setChannelFilter('all')}
                        >
                            All
                        </Button>
                        <Button
                            variant={channelFilter === 'wholesale' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setChannelFilter('wholesale')}
                        >
                            <Store className="h-4 w-4 mr-2" />
                            Wholesale
                        </Button>
                        <Button
                            variant={channelFilter === 'pos' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setChannelFilter('pos')}
                        >
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            POS
                        </Button>
                    </div>
                </div>
                <div className="relative mt-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by customer or order #..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No orders found</div>
                    ) : (
                        filteredOrders.map((order) => {
                            const Icon = getChannelIcon(order.channel);
                            return (
                                <div
                                    key={order.id}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${getChannelColor(order.channel)}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                {order.customer_name}
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                                                    {order.order_number}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span>{getChannelLabel(order.channel)}</span>
                                                <span>•</span>
                                                <span>{formatSmartDate(order.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-bold">{formatCurrency(order.total_amount)}</div>
                                            <Badge variant="secondary" className="text-[10px] h-5 capitalize">
                                                {order.status}
                                            </Badge>
                                        </div>
                                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowUpRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

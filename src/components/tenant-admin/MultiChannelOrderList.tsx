/**
 * Multi-Channel Order List
 * Aggregates orders from Wholesale, POS, and Online channels using REAL data
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
    ArrowUpRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { useNavigate, useParams } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

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

interface WholesaleOrderRow {
    id: string;
    total_amount: number | null;
    status: string;
    created_at: string;
    wholesale_clients: { business_name: string | null } | null;
}

interface POSTransactionRow {
    id: string;
    total_amount: number;
    payment_status: string;
    created_at: string;
    transaction_number: string;
    customer_name: string | null;
}

interface UnifiedOrderRow {
    id: string;
    total_amount?: number;
    subtotal: number;
    status: string;
    created_at: string;
    order_number: string;
    source: string;
    order_type: string;
    contact_name: string | null;
}

export function MultiChannelOrderList() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;
    const [searchTerm, setSearchTerm] = useState('');
    const [channelFilter, setChannelFilter] = useState<OrderChannel | 'all'>('all');

    const { data: orders = [], isLoading } = useQuery({
        queryKey: queryKeys.tenantWidgets.multiChannelOrders(tenantId, channelFilter),
        queryFn: async () => {
            if (!tenantId) return [];

            const unifiedOrders: ChannelOrder[] = [];

            // 1. Fetch Wholesale Orders
            try {
                const { data: wholesale, error: wholesaleError } = await supabase
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

                if (wholesaleError) {
                    logger.warn('Failed to fetch wholesale orders', wholesaleError, { component: 'MultiChannelOrderList' });
                } else if (wholesale) {
                    const wholesaleOrders = (wholesale as unknown as WholesaleOrderRow[]).map((o) => ({
                        id: o.id,
                        channel: 'wholesale' as OrderChannel,
                        customer_name: o.wholesale_clients?.business_name || 'Unknown Client',
                        total_amount: Number(o.total_amount) || 0,
                        status: o.status || 'pending',
                        created_at: o.created_at,
                        order_number: `WS-${o.id.substring(0, 6).toUpperCase()}`
                    }));
                    unifiedOrders.push(...wholesaleOrders);
                }
            } catch (error) {
                logger.error('Error fetching wholesale orders', error, { component: 'MultiChannelOrderList' });
            }

            // 2. Fetch POS Transactions (REAL DATA)
            try {
                const { data: posData, error: posError } = await supabase
                    .from('pos_transactions')
                    .select('id, total_amount, payment_status, created_at, transaction_number, customer_name')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (posError) {
                    logger.warn('Failed to fetch POS transactions', posError, { component: 'MultiChannelOrderList' });
                } else if (posData) {
                    const posOrders = (posData as POSTransactionRow[]).map((t) => ({
                        id: t.id,
                        channel: 'pos' as OrderChannel,
                        customer_name: t.customer_name || 'Walk-in Customer',
                        total_amount: Number(t.total_amount) || 0,
                        status: t.payment_status || 'completed',
                        created_at: t.created_at,
                        order_number: t.transaction_number || `POS-${t.id.substring(0, 6).toUpperCase()}`
                    }));
                    unifiedOrders.push(...posOrders);
                }
            } catch (error) {
                logger.error('Error fetching POS transactions', error, { component: 'MultiChannelOrderList' });
            }

            // 3. Fetch from unified_orders table (for online orders and any other sources)
            try {
                const { data: unifiedData, error: unifiedError } = await supabase
                    .from('unified_orders')
                    .select('id, subtotal, status, created_at, order_number, source, order_type, contact_name')
                    .eq('tenant_id', tenantId)
                    .in('source', ['online', 'web', 'app', 'marketplace'])
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (unifiedError) {
                    logger.warn('Failed to fetch unified orders', unifiedError, { component: 'MultiChannelOrderList' });
                } else if (unifiedData) {
                    const onlineOrders = (unifiedData as UnifiedOrderRow[]).map((o) => ({
                        id: o.id,
                        channel: 'online' as OrderChannel,
                        customer_name: o.contact_name || 'Online Customer',
                        total_amount: Number(o.subtotal) || 0,
                        status: o.status || 'pending',
                        created_at: o.created_at,
                        order_number: o.order_number || `ON-${o.id.substring(0, 6).toUpperCase()}`
                    }));
                    unifiedOrders.push(...onlineOrders);
                }
            } catch (error) {
                logger.error('Error fetching unified orders', error, { component: 'MultiChannelOrderList' });
            }

            // 4. Fetch Storefront Orders (from marketplace stores)
            try {
                // First get the stores for this tenant
                const { data: stores } = await supabase
                    .from('marketplace_stores')
                    .select('id, store_name')
                    .eq('tenant_id', tenantId);

                if (stores && stores.length > 0) {
                    const storeIds = stores.map(s => s.id);
                    const { data: sfOrders, error: sfError } = await supabase
                        .from('storefront_orders')
                        .select('id, total, status, created_at, order_number, customer_name, store_id')
                        .in('store_id', storeIds)
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (sfError) {
                        logger.warn('Failed to fetch storefront orders', sfError, { component: 'MultiChannelOrderList' });
                    } else if (sfOrders) {
                        const storefrontOrders = sfOrders.map((o) => ({
                            id: o.id,
                            channel: 'online' as OrderChannel,
                            customer_name: o.customer_name || 'Storefront Customer',
                            total_amount: Number(o.total) || 0,
                            status: o.status || 'pending',
                            created_at: o.created_at,
                            order_number: o.order_number || `SF-${o.id.substring(0, 6).toUpperCase()}`
                        }));
                        unifiedOrders.push(...storefrontOrders);
                    }
                }
            } catch (error) {
                logger.error('Error fetching storefront orders', error, { component: 'MultiChannelOrderList' });
            }

            // Sort all orders by date (newest first)
            return unifiedOrders.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        },
        enabled: !!tenantId,
        staleTime: 30000, // Cache for 30 seconds
    });

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.order_number.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesChannel = channelFilter === 'all' || order.channel === channelFilter;
        return matchesSearch && matchesChannel;
    });

    // Count orders per channel for badges
    const channelCounts = {
        wholesale: orders.filter(o => o.channel === 'wholesale').length,
        pos: orders.filter(o => o.channel === 'pos').length,
        online: orders.filter(o => o.channel === 'online').length,
    };

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

    const handleOrderClick = (order: ChannelOrder) => {
        // Navigate to appropriate order detail based on channel
        if (order.channel === 'wholesale') {
            navigate(`/${tenantSlug}/admin/wholesale-orders/${order.id}`);
        } else if (order.channel === 'pos') {
            navigate(`/${tenantSlug}/admin/pos-system?tab=history&transaction=${order.id}`);
        } else {
            navigate(`/${tenantSlug}/admin/orders/${order.id}`);
        }
    };

    return (
        <Card className="glass-card">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle>Recent Orders</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                        <Button
                            variant={channelFilter === 'all' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setChannelFilter('all')}
                        >
                            All
                            {orders.length > 0 && (
                                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                                    {orders.length}
                                </Badge>
                            )}
                        </Button>
                        <Button
                            variant={channelFilter === 'wholesale' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setChannelFilter('wholesale')}
                        >
                            <Store className="h-4 w-4 mr-1" />
                            Wholesale
                            {channelCounts.wholesale > 0 && (
                                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                                    {channelCounts.wholesale}
                                </Badge>
                            )}
                        </Button>
                        <Button
                            variant={channelFilter === 'pos' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setChannelFilter('pos')}
                        >
                            <ShoppingBag className="h-4 w-4 mr-1" />
                            POS
                            {channelCounts.pos > 0 && (
                                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                                    {channelCounts.pos}
                                </Badge>
                            )}
                        </Button>
                        {channelCounts.online > 0 && (
                            <Button
                                variant={channelFilter === 'online' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setChannelFilter('online')}
                            >
                                <Globe className="h-4 w-4 mr-1" />
                                Online
                                <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-[10px]">
                                    {channelCounts.online}
                                </Badge>
                            </Button>
                        )}
                    </div>
                </div>
                <div className="relative mt-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by customer or order #..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Search orders"
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
                        filteredOrders.slice(0, 10).map((order) => {
                            const Icon = getChannelIcon(order.channel);
                            return (
                                <div
                                    key={`${order.channel}-${order.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
                                    onClick={() => handleOrderClick(order)}
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
                                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="View order details">
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

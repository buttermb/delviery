/**
 * Order Status Pipeline Board
 * Kanban-style view for managing order workflow
 * Enhanced with URL-based filters, last updated indicator, and copy buttons
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Clock,
    Package,
    Truck,
    CheckCircle2,
    MoreVertical,
    ArrowRight,
    AlertCircle,
    Copy,
    Check,
    Filter,
    X
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { wholesaleOrderFlowManager, WholesaleOrderStatus } from '@/lib/orders/wholesaleOrderFlowManager';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LastUpdated } from '@/components/ui/last-updated';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';

type OrderStatus = 'pending' | 'processing' | 'ready' | 'delivered' | 'cancelled';

interface PipelineOrder {
    id: string;
    customer_name: string;
    total_amount: number;
    status: OrderStatus;
    created_at: string;
    item_count: number;
    priority?: 'high' | 'normal';
}

interface ColumnProps {
    title: string;
    status: OrderStatus;
    orders: PipelineOrder[];
    icon: React.ElementType;
    color: string;
    onMove: (orderId: string, newStatus: OrderStatus) => void;
}

function PipelineColumn({ title, status, orders, icon: Icon, color, onMove }: ColumnProps) {
    const navigate = useNavigate();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopyId = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        toast.success('Order ID copied');
        setTimeout(() => setCopiedId(null), 1500);
    };

    return (
        <div className="flex-1 min-w-[280px] flex flex-col h-full bg-muted/30 rounded-lg border border-border/50">
            <div className={`p-3 border-b flex items-center justify-between ${color} bg-opacity-10`}>
                <div className="flex items-center gap-2 font-semibold">
                    <Icon className="h-4 w-4" />
                    {title}
                </div>
                <Badge variant="secondary" className="bg-background/80">
                    {orders.length}
                </Badge>
            </div>

            <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                    {orders.map((order) => (
                        <Card
                            key={order.id}
                            className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98] group"
                            onClick={() => navigate(`/admin/orders/${order.id}`)}
                        >
                            <CardContent className="p-3 space-y-2">
                                <div className="flex items-start justify-between">
                                    <div className="font-medium truncate pr-2 flex items-center gap-1">
                                        {order.customer_name}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => handleCopyId(e, order.id)}
                                        >
                                            {copiedId === order.id ? (
                                                <Check className="h-3 w-3 text-emerald-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreVertical className="h-3 w-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {status !== 'processing' && (
                                                <DropdownMenuItem onClick={() => onMove(order.id, 'processing')}>
                                                    Move to Processing
                                                </DropdownMenuItem>
                                            )}
                                            {status !== 'ready' && (
                                                <DropdownMenuItem onClick={() => onMove(order.id, 'ready')}>
                                                    Move to Ready
                                                </DropdownMenuItem>
                                            )}
                                            {status !== 'delivered' && (
                                                <DropdownMenuItem onClick={() => onMove(order.id, 'delivered')}>
                                                    Move to Delivered
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-mono font-semibold">
                                        {formatCurrency(order.total_amount)}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {order.item_count} items
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t mt-2">
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatSmartDate(order.created_at)}
                                    </div>

                                    {/* Quick Move Action */}
                                    {status === 'pending' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-[10px] hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/30"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMove(order.id, 'processing');
                                            }}
                                        >
                                            Process <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    )}
                                    {status === 'processing' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-2 text-[10px] hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/30"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMove(order.id, 'ready');
                                            }}
                                        >
                                            Ready <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {orders.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                            No orders
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

export function OrderPipelineBoard() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const tenantId = tenant?.id;
    const [lastFetched, setLastFetched] = useState<Date | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    
    // URL-based filter state
    const searchQuery = searchParams.get('search') || '';
    const minAmount = searchParams.get('minAmount') || '';
    const showFilters = searchParams.get('filters') === 'true';

    const updateUrlFilter = (key: string, value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value) {
            newParams.set(key, value);
        } else {
            newParams.delete(key);
        }
        setSearchParams(newParams, { replace: true });
    };

    const clearFilters = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('search');
        newParams.delete('minAmount');
        newParams.delete('filters');
        setSearchParams(newParams, { replace: true });
    };

    const hasActiveFilters = searchQuery || minAmount;

    const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
        queryKey: ['pipeline-orders', tenantId],
        queryFn: async () => {
            if (!tenantId) return [];

            // @ts-ignore - Outdated Supabase types
            const { data, error } = await supabase
                .from('wholesale_orders')
                .select(`
                    id, 
                    total_amount, 
                    status, 
                    created_at,
                    wholesale_clients(business_name),
                    items:wholesale_order_items(count)
                `)
                .eq('tenant_id', tenantId)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setLastFetched(new Date());

            return data.map((order: any) => ({
                id: order.id,
                customer_name: order.wholesale_clients?.business_name || 'Unknown Client',
                total_amount: Number(order.total_amount),
                status: order.status,
                created_at: order.created_at,
                item_count: order.items?.[0]?.count || 0
            })) as PipelineOrder[];
        },
        enabled: !!tenantId,
        refetchInterval: 30000
    });

    // Filter orders based on URL params
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            if (searchQuery && !order.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
            if (minAmount && order.total_amount < parseFloat(minAmount)) {
                return false;
            }
            return true;
        });
    }, [orders, searchQuery, minAmount]);

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
            // Use flow manager for proper inventory handling and validation
            const result = await wholesaleOrderFlowManager.transitionOrderStatus(
                id,
                status as WholesaleOrderStatus
            );
            if (!result.success) {
                throw new Error(result.error || 'Failed to update status');
            }
        },
        onSuccess: () => {
            // Invalidate all related queries
            queryClient.invalidateQueries({ queryKey: ['pipeline-orders'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['wholesale-inventory'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            queryClient.invalidateQueries({ queryKey: ['wholesale-clients'] });
            toast.success('Order status updated');
        },
        onError: (error: Error) => {
            toast.error('Failed to update order status', {
                description: error.message
            });
        }
    });

    const handleMove = (id: string, status: OrderStatus) => {
        updateStatusMutation.mutate({ id, status });
    };

    const handleRefresh = () => {
        refetch();
    };

    if (isLoading) {
        return <div className="h-[500px] flex items-center justify-center">Loading pipeline...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Header with Filters and Last Updated */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                        {filteredOrders.length} of {orders.length} orders
                    </div>
                    <Button
                        variant={showFilters ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => updateUrlFilter('filters', showFilters ? '' : 'true')}
                        className="h-8"
                    >
                        <Filter className="h-3 w-3 mr-1" />
                        Filters
                        {hasActiveFilters && (
                            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                                {(searchQuery ? 1 : 0) + (minAmount ? 1 : 0)}
                            </Badge>
                        )}
                    </Button>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            className="h-8 text-muted-foreground"
                        >
                            <X className="h-3 w-3 mr-1" />
                            Clear
                        </Button>
                    )}
                </div>
                <LastUpdated 
                    lastFetched={lastFetched} 
                    onRefresh={handleRefresh}
                    isRefreshing={isFetching}
                />
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg border">
                    <div className="flex-1 min-w-[200px]">
                        <Input
                            placeholder="Search by customer name..."
                            value={searchQuery}
                            onChange={(e) => updateUrlFilter('search', e.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="w-[150px]">
                        <Input
                            type="number"
                            placeholder="Min amount..."
                            value={minAmount}
                            onChange={(e) => updateUrlFilter('minAmount', e.target.value)}
                            className="h-9"
                        />
                    </div>
                </div>
            )}

            {/* Pipeline Columns */}
            <div className="h-[calc(100vh-300px)] min-h-[500px] flex gap-4 overflow-x-auto pb-4">
                <PipelineColumn
                    title="Pending"
                    status="pending"
                    orders={filteredOrders.filter(o => o.status === 'pending')}
                    icon={AlertCircle}
                    color="text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                    onMove={handleMove}
                />
                <PipelineColumn
                    title="Processing"
                    status="processing"
                    orders={filteredOrders.filter(o => o.status === 'processing')}
                    icon={Package}
                    color="text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    onMove={handleMove}
                />
                <PipelineColumn
                    title="Ready to Ship"
                    status="ready"
                    orders={filteredOrders.filter(o => o.status === 'ready')}
                    icon={CheckCircle2}
                    color="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                    onMove={handleMove}
                />
                <PipelineColumn
                    title="Delivered"
                    status="delivered"
                    orders={filteredOrders.filter(o => o.status === 'delivered')}
                    icon={Truck}
                    color="text-slate-600 bg-slate-50 dark:bg-slate-900/20"
                    onMove={handleMove}
                />
            </div>
        </div>
    );
}

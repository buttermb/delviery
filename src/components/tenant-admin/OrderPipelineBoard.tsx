/**
 * Order Status Pipeline Board
 * Kanban-style view for managing order workflow
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { useNavigate } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
                                    <div className="font-medium truncate pr-2">
                                        {order.customer_name}
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

    const { data: orders = [], isLoading } = useQuery({
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

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
            const { error } = await supabase
                .from('wholesale_orders')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pipeline-orders'] });
        }
    });

    const handleMove = (id: string, status: OrderStatus) => {
        updateStatusMutation.mutate({ id, status });
    };

    if (isLoading) {
        return <div className="h-[500px] flex items-center justify-center">Loading pipeline...</div>;
    }

    return (
        <div className="h-[calc(100vh-200px)] min-h-[500px] flex gap-4 overflow-x-auto pb-4">
            <PipelineColumn
                title="Pending"
                status="pending"
                orders={orders.filter(o => o.status === 'pending')}
                icon={AlertCircle}
                color="text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                onMove={handleMove}
            />
            <PipelineColumn
                title="Processing"
                status="processing"
                orders={orders.filter(o => o.status === 'processing')}
                icon={Package}
                color="text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                onMove={handleMove}
            />
            <PipelineColumn
                title="Ready to Ship"
                status="ready"
                orders={orders.filter(o => o.status === 'ready')}
                icon={CheckCircle2}
                color="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                onMove={handleMove}
            />
            <PipelineColumn
                title="Delivered"
                status="delivered"
                orders={orders.filter(o => o.status === 'delivered')}
                icon={Truck}
                color="text-slate-600 bg-slate-50 dark:bg-slate-900/20"
                onMove={handleMove}
            />
        </div>
    );
}

import { logger } from '@/lib/logger';
/**
 * Marketplace Orders Page
 * View and manage orders from marketplace buyers
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    ShoppingCart,
    Search,
    Filter,
    Eye,
    CheckCircle,
    XCircle,
    Clock,
    Package,
    Truck,
    MoreVertical,
    RefreshCcw,
    AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

export default function OrdersPage() {
    const { tenant } = useTenantAdminAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const tenantId = tenant?.id;
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [activeTab, setActiveTab] = useState('all');

    // Fetch marketplace profile
    const { data: profile } = useQuery({
        queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenantId),
        queryFn: async () => {
            if (!tenantId) return null;

            const { data, error } = await supabase
                .from('marketplace_profiles')
                .select('id')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!tenantId,
    });

    // Fetch orders
    const { data: orders = [], isLoading } = useQuery({
        queryKey: queryKeys.marketplaceOrders.byTenant(tenantId, statusFilter, activeTab),
        queryFn: async () => {
            if (!tenantId || !profile?.id) return [];

            let query = supabase
                .from('marketplace_orders')
                .select(`
          *,
          marketplace_order_items (*)
        `)
                .eq('seller_tenant_id', tenantId)
                .order('created_at', { ascending: false });

            // Filter by status
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            // Filter by payment status for tabs
            if (activeTab === 'unpaid') {
                query = query.in('payment_status', ['pending', 'partial', 'overdue']);
            } else if (activeTab === 'paid') {
                query = query.eq('payment_status', 'paid');
            }

            const { data, error } = await query;

            if (error) {
                logger.error('Failed to fetch orders', error, { component: 'OrdersPage' });
                throw error;
            }

            return data ?? [];
        },
        enabled: !!tenantId && !!profile?.id,
    });

    // Filter orders by search query
    const filteredOrders = orders.filter((order) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            order.order_number?.toLowerCase().includes(query) ||
            ((order as unknown as Record<string, unknown>).buyer_business_name as string)?.toLowerCase().includes(query) ||
            order.tracking_number?.toLowerCase().includes(query)
        );
    });

    // Update order status
    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
            if (!tenantId) throw new Error('No tenant');
            const updateData: Record<string, unknown> = { status: newStatus };

            // Set timestamps based on status
            if (newStatus === 'shipped') {
                updateData.shipped_at = new Date().toISOString();
            } else if (newStatus === 'delivered') {
                updateData.delivered_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('marketplace_orders')
                .update(updateData)
                .eq('id', orderId)
                .eq('seller_tenant_id', tenantId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.byTenant(tenantId) });
            toast.success("Order status has been updated");
        },
        onError: (error: unknown) => {
            logger.error('Failed to update order status', error, { component: 'OrdersPage' });
            toast.error("Failed to update order status. Please try again.", { description: humanizeError(error) });
        },
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <Badge className="bg-warning/20 text-warning border-warning/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                    </Badge>
                );
            case 'accepted':
                return (
                    <Badge className="bg-info/20 text-info border-info/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Accepted
                    </Badge>
                );
            case 'processing':
                return (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                        <Package className="h-3 w-3 mr-1" />
                        Processing
                    </Badge>
                );
            case 'shipped':
                return (
                    <Badge className="bg-info/20 text-info border-info/30">
                        <Truck className="h-3 w-3 mr-1" />
                        Shipped
                    </Badge>
                );
            case 'delivered':
                return (
                    <Badge className="bg-success/20 text-success border-success/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Delivered
                    </Badge>
                );
            case 'cancelled':
                return (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancelled
                    </Badge>
                );
            case 'rejected':
                return (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejected
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getPaymentStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return (
                    <Badge className="bg-success/20 text-success border-success/30">
                        Paid
                    </Badge>
                );
            case 'pending':
                return (
                    <Badge className="bg-warning/20 text-warning border-warning/30">
                        Pending
                    </Badge>
                );
            case 'partial':
                return (
                    <Badge className="bg-info/20 text-info border-info/30">
                        Partial
                    </Badge>
                );
            case 'overdue':
                return (
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                        Overdue
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Calculate stats
    const stats = {
        total: filteredOrders.length,
        pending: filteredOrders.filter((o) => o.status === 'pending').length,
        processing: filteredOrders.filter((o) => o.status === 'processing').length,
        shipped: filteredOrders.filter((o) => o.status === 'shipped').length,
        unpaid: filteredOrders.filter((o) => ['pending', 'partial', 'overdue'].includes(o.payment_status ?? '')).length,
        totalRevenue: filteredOrders
            .filter((o) => o.payment_status === 'paid')
            .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
    };

    if (!profile) {
        return (
            <div className="space-y-4">
                <Card className="border-warning bg-warning/5">
                    <CardContent className="py-6">
                        <div className="text-center">
                            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
                            <h3 className="text-lg font-semibold mb-2">No Marketplace Profile</h3>
                            <p className="text-sm text-neutral-600 mb-4">
                                You need to create a marketplace profile to receive orders.
                            </p>
                            <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/settings`)}>
                                Create Profile
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <PageHeader
                title="Marketplace Orders"
                description="Manage orders from your storefront"
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.byTenant(tenantId, statusFilter, activeTab) })}
                        data-component="OrdersPage"
                        data-action="refresh-orders"
                    >
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                }
            />

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">Total Orders</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{stats.pending}</div>
                        <p className="text-xs text-muted-foreground">Pending Action</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{stats.unpaid}</div>
                        <p className="text-xs text-muted-foreground">Unpaid</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    aria-label="Search by order number, customer, or tracking"
                                    placeholder="Search by order number, customer, or tracking..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="accepted">Accepted</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
                <CardHeader>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="all">All Orders</TabsTrigger>
                            <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
                            <TabsTrigger value="paid">Paid</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-6">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="text-center py-6">
                            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
                            <p className="text-sm text-muted-foreground">
                                {searchQuery ? 'Try adjusting your search' : 'You haven\'t received any orders yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-lg border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Items</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Payment</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium">{order.order_number}</TableCell>
                                            <TableCell>{String((order as unknown as Record<string, unknown>).buyer_business_name || 'Guest')}</TableCell>
                                            <TableCell>
                                                {Array.isArray(order.marketplace_order_items)
                                                    ? order.marketplace_order_items.length
                                                    : 0} items
                                            </TableCell>
                                            <TableCell>{formatCurrency(Number(order.total_amount) || 0)}</TableCell>
                                            <TableCell>{getStatusBadge(order.status || 'pending')}</TableCell>
                                            <TableCell>{getPaymentStatusBadge(order.payment_status || 'pending')}</TableCell>
                                            <TableCell>{formatSmartDate(order.created_at as string)}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" aria-label="More options">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/orders/${order.id}`)}
                                                            disabled={updateStatusMutation.isPending}
                                                        >
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        {order.status === 'pending' && (
                                                            <>
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        if (updateStatusMutation.isPending) return;
                                                                        updateStatusMutation.mutate({ orderId: order.id, newStatus: 'accepted' });
                                                                    }}
                                                                    disabled={updateStatusMutation.isPending}
                                                                >
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Accept Order
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        if (updateStatusMutation.isPending) return;
                                                                        updateStatusMutation.mutate({ orderId: order.id, newStatus: 'rejected' });
                                                                    }}
                                                                    className="text-destructive"
                                                                    disabled={updateStatusMutation.isPending}
                                                                >
                                                                    <XCircle className="h-4 w-4 mr-2" />
                                                                    Reject Order
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {order.status === 'accepted' && (
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    if (updateStatusMutation.isPending) return;
                                                                    updateStatusMutation.mutate({ orderId: order.id, newStatus: 'processing' });
                                                                }}
                                                                disabled={updateStatusMutation.isPending}
                                                            >
                                                                <Package className="h-4 w-4 mr-2" />
                                                                Start Processing
                                                            </DropdownMenuItem>
                                                        )}
                                                        {order.status === 'processing' && (
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    if (updateStatusMutation.isPending) return;
                                                                    updateStatusMutation.mutate({ orderId: order.id, newStatus: 'shipped' });
                                                                }}
                                                                disabled={updateStatusMutation.isPending}
                                                            >
                                                                <Truck className="h-4 w-4 mr-2" />
                                                                Mark as Shipped
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

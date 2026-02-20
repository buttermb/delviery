import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { humanizeError } from '@/lib/humanizeError';
import {
    ShoppingBag,
    Search,
    Filter,
    Eye,
    CheckCircle,
    Truck,
    MoreVertical,
    RefreshCcw,
    Loader2
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
import { PageHeader } from '@/components/shared/PageHeader';

export default function MarketplacePurchasesPage() {
    const { tenant } = useTenantAdminAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Fetch purchases
    const { data: purchases = [], isLoading } = useQuery({
        queryKey: ['marketplace-purchases', tenant?.id, statusFilter],
        queryFn: async () => {
            if (!tenant?.id) return [];

            let query = supabase
                .from('marketplace_orders')
                .select(`
          *,
          marketplace_order_items (*),
          marketplace_profiles (
            business_name,
            contact_email
          )
        `)
                .eq('buyer_tenant_id', tenant.id)
                .order('created_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];
        },
        enabled: !!tenant?.id,
    });

    // Filter local search
    const filteredPurchases = purchases.filter((order) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const sellerName = order.marketplace_profiles?.business_name?.toLowerCase() || '';
        return (
            order.order_number?.toLowerCase().includes(query) ||
            sellerName.includes(query) ||
            order.tracking_number?.toLowerCase().includes(query)
        );
    });

    // Mark Received Mutation
    const markReceivedMutation = useMutation({
        mutationFn: async (orderId: string) => {
            const { error } = await supabase
                .from('marketplace_orders')
                .update({
                    status: 'delivered',
                    delivered_at: new Date().toISOString()
                })
                .eq('id', orderId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['marketplace-purchases'] });
            toast({ title: 'Order marked as received' });
        },
        onError: (error: Error) => {
            logger.error('Failed to mark order as received', { error });
            toast({ title: 'Failed to mark as received', description: humanizeError(error), variant: 'destructive' });
        },
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary">Pending</Badge>;
            case 'accepted': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Accepted</Badge>;
            case 'processing': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">Processing</Badge>;
            case 'shipped': return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200"><Truck className="h-3 w-3 mr-1" />Shipped</Badge>;
            case 'delivered': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
            case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="My Purchases"
                description="Track and manage your wholesale orders."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['marketplace-purchases'] })}
                    >
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                }
            />

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search orders, sellers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="accepted">Accepted</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredPurchases.length === 0 ? (
                        <div className="text-center py-12">
                            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No purchases yet</h3>
                            <Button onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/browse`)}>
                                Start Shopping
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order #</TableHead>
                                    <TableHead>Seller</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Payment</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPurchases.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.order_number}</TableCell>
                                        <TableCell>{order.marketplace_profiles?.business_name || 'Unknown Vendor'}</TableCell>
                                        <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                                        <TableCell>{getStatusBadge(order.status || 'pending')}</TableCell>
                                        <TableCell>
                                            <Badge variant={order.payment_status === 'paid' ? 'default' : 'outline'}>
                                                {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{formatSmartDate(order.created_at)}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => navigate(`/${tenant?.slug}/admin/marketplace/purchases/${order.id}`)}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                    {order.status === 'shipped' && (
                                                        <DropdownMenuItem onClick={() => markReceivedMutation.mutate(order.id)}>
                                                            <CheckCircle className="h-4 w-4 mr-2" />
                                                            Mark Received
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * ProductOrderHistory
 * Displays recent orders containing a specific product with sales statistics.
 * Shows order number, date, quantity ordered, customer name as clickable links.
 * Displays total units sold this week/month/all-time.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useProductOrders, type ProductOrder } from '@/hooks/useProduct';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Package from "lucide-react/dist/esm/icons/package";
import { getStatusVariant } from '@/lib/utils/statusColors';

interface ProductOrderHistoryProps {
    productId: string | undefined;
}

export function ProductOrderHistory({ productId }: ProductOrderHistoryProps) {
    const { navigateToAdmin } = useTenantNavigation();
    const { data, isLoading, error } = useProductOrders(productId);

    const columns = [
        {
            accessorKey: 'order_number',
            header: 'Order #',
            cell: ({ original }: { original: ProductOrder }) => (
                <button
                    onClick={() => navigateToAdmin(`orders/${original.id}`)}
                    className="text-primary hover:underline font-medium"
                >
                    {original.order_number}
                </button>
            ),
        },
        {
            accessorKey: 'created_at',
            header: 'Date',
            cell: ({ original }: { original: ProductOrder }) => (
                <span className="text-muted-foreground">
                    {format(new Date(original.created_at), 'MMM d, yyyy')}
                </span>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Qty Ordered',
            cell: ({ original }: { original: ProductOrder }) => (
                <span className="font-medium">{original.quantity}</span>
            ),
        },
        {
            accessorKey: 'contact_name',
            header: 'Customer',
            cell: ({ original }: { original: ProductOrder }) => {
                if (original.customer_id && original.contact_name) {
                    return (
                        <button
                            onClick={() => navigateToAdmin(`customers/${original.customer_id}`)}
                            className="text-primary hover:underline"
                        >
                            {original.contact_name}
                        </button>
                    );
                }
                return (
                    <span className="text-muted-foreground">
                        {original.contact_name || 'Unknown'}
                    </span>
                );
            },
        },
        {
            accessorKey: 'total_amount',
            header: 'Order Total',
            cell: ({ original }: { original: ProductOrder }) => (
                <span className="font-medium">{formatCurrency(original.total_amount)}</span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ original }: { original: ProductOrder }) => (
                <Badge variant={getStatusVariant(original.status)} className="capitalize">
                    {original.status.replace(/_/g, ' ')}
                </Badge>
            ),
        },
    ];

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardContent className="pt-6">
                                <div className="animate-pulse space-y-2">
                                    <div className="h-4 w-20 bg-muted rounded" />
                                    <div className="h-8 w-16 bg-muted rounded" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Card>
                    <CardContent className="pt-6 flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <p className="text-center text-destructive">
                        Failed to load order history: {(error as Error).message}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const { orders = [], stats = { totalSoldWeek: 0, totalSoldMonth: 0, totalSoldAllTime: 0 } } = data ?? {};

    return (
        <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sold This Week</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSoldWeek}</div>
                        <p className="text-xs text-muted-foreground">units</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sold This Month</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSoldMonth}</div>
                        <p className="text-xs text-muted-foreground">units</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Sold (All Time)</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSoldAllTime}</div>
                        <p className="text-xs text-muted-foreground">units</p>
                    </CardContent>
                </Card>
            </div>

            {/* Orders Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Recent Orders
                    </CardTitle>
                    <CardDescription>
                        Orders containing this product
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {orders.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No orders found for this product</p>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={orders}
                            searchable={true}
                            searchPlaceholder="Search orders..."
                            searchColumn="order_number"
                            pagination={true}
                            pageSize={10}
                            emptyMessage="No orders found"
                            enableColumnVisibility={false}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

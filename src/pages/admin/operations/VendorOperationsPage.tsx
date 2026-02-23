/**
 * Vendor Operations Page
 * Shows vendor list with order statistics and order history details
 */

import { useState } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useVendorsWithStats, useVendorOrders, type VendorWithStats, type VendorOrder } from '@/hooks/useVendorOrders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Search,
    Building2,
    Phone,
    Mail,
    MapPin,
    DollarSign,
    FileText,
    Calendar,
    Loader2,
    ShoppingCart,
    Package,
    TrendingUp,
    Clock,
    CheckCircle2,
    XCircle,
    X,
} from 'lucide-react';
import { formatSmartDate } from '@/lib/formatters';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-gray-500 dark:bg-gray-600',
    submitted: 'bg-blue-500',
    approved: 'bg-green-500',
    received: 'bg-emerald-500',
    cancelled: 'bg-red-500',
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    draft: FileText,
    submitted: Clock,
    approved: CheckCircle2,
    received: CheckCircle2,
    cancelled: XCircle,
};

interface VendorDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vendor: VendorWithStats | null;
}

function VendorDetailDialog({ open, onOpenChange, vendor }: VendorDetailDialogProps) {
    const { data: orders, isLoading: ordersLoading } = useVendorOrders(vendor?.id || null);

    if (!vendor) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {vendor.name}
                        </DialogTitle>
                        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Contact Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {vendor.contact_name && (
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">Contact:</span>
                                    <span className="text-sm">{vendor.contact_name}</span>
                                </div>
                            )}
                            {vendor.contact_email && (
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{vendor.contact_email}</span>
                                </div>
                            )}
                            {vendor.contact_phone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{vendor.contact_phone}</span>
                                </div>
                            )}
                            {vendor.address && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <span className="text-sm flex-1">{vendor.address}</span>
                                </div>
                            )}
                            {vendor.license_number && (
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">License: {vendor.license_number}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Order Summary Stats */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Order Summary</CardTitle>
                            <CardDescription>Purchase order statistics for this vendor</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-muted rounded-lg">
                                    <ShoppingCart className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                                    <div className="text-2xl font-bold">{vendor.total_orders}</div>
                                    <div className="text-xs text-muted-foreground">Total Orders</div>
                                </div>
                                <div className="text-center p-4 bg-muted rounded-lg">
                                    <DollarSign className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                                    <div className="text-2xl font-bold">
                                        ${vendor.total_spent.toLocaleString('en-US', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0,
                                        })}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Total Spent</div>
                                </div>
                                <div className="text-center p-4 bg-muted rounded-lg">
                                    <Calendar className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                                    <div className="text-2xl font-bold">
                                        {vendor.last_order_date
                                            ? new Date(vendor.last_order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                            : '-'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Last Order</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Order History */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Order History</CardTitle>
                            <CardDescription>All purchase orders from this vendor</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {ordersLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : orders && orders.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>PO Number</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead>Expected Delivery</TableHead>
                                                <TableHead>Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {orders.map((order: VendorOrder) => {
                                                const StatusIcon = STATUS_ICONS[order.status || 'draft'] || FileText;
                                                return (
                                                    <TableRow key={order.id}>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                                {order.po_number || '-'}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant="outline"
                                                                className={`${STATUS_COLORS[order.status || 'draft']} text-white border-0`}
                                                            >
                                                                <StatusIcon className="h-3 w-3 mr-1" />
                                                                {(order.status || 'draft').charAt(0).toUpperCase() + (order.status || 'draft').slice(1)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1">
                                                                <DollarSign className="h-3 w-3 text-muted-foreground" />
                                                                {Number(order.total || 0).toLocaleString('en-US', {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                })}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {order.expected_delivery_date ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                                                    {formatSmartDate(order.expected_delivery_date)}
                                                                </div>
                                                            ) : (
                                                                '-'
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {order.created_at
                                                                ? formatSmartDate(order.created_at)
                                                                : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>No orders found for this vendor</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    {vendor.notes && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vendor.notes}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function VendorOperationsPage() {
    const { loading: accountLoading } = useTenantAdminAuth();
    const { data: vendors, isLoading } = useVendorsWithStats();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [selectedVendor, setSelectedVendor] = useState<VendorWithStats | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const filteredVendors = vendors?.filter((vendor) => {
        const matchesSearch =
            vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vendor.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vendor.contact_email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter =
            filter === 'all' ||
            (filter === 'active' && vendor.status === 'active') ||
            (filter === 'inactive' && vendor.status === 'inactive');

        return matchesSearch && matchesFilter;
    }) || [];

    const handleView = (vendor: VendorWithStats) => {
        setSelectedVendor(vendor);
        setIsDetailOpen(true);
    };

    if (accountLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Calculate summary stats
    const totalVendors = vendors?.length || 0;
    const totalOrders = vendors?.reduce((sum, v) => sum + v.total_orders, 0) || 0;
    const totalSpent = vendors?.reduce((sum, v) => sum + v.total_spent, 0) || 0;

    return (
        <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-foreground">
                        Vendors
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        View vendor order history and purchasing statistics
                    </p>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Vendors</p>
                                <p className="text-2xl font-bold">{totalVendors}</p>
                            </div>
                            <Building2 className="h-8 w-8 text-muted-foreground opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                                <p className="text-2xl font-bold">{totalOrders}</p>
                            </div>
                            <ShoppingCart className="h-8 w-8 text-muted-foreground opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                                <p className="text-2xl font-bold">
                                    ${totalSpent.toLocaleString('en-US', {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0,
                                    })}
                                </p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-muted-foreground opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4 sm:p-6">
                <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                aria-label="Search vendors"
                                placeholder="Search vendors..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 min-h-[44px] touch-manipulation"
                            />
                        </div>
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex gap-2">
                        <Button
                            variant={filter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('all')}
                            className="min-h-[44px] touch-manipulation"
                        >
                            All
                        </Button>
                        <Button
                            variant={filter === 'active' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('active')}
                            className="min-h-[44px] touch-manipulation"
                        >
                            Active
                        </Button>
                        <Button
                            variant={filter === 'inactive' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('inactive')}
                            className="min-h-[44px] touch-manipulation"
                        >
                            Inactive
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Vendors Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Vendors ({filteredVendors.length})</CardTitle>
                    <CardDescription>
                        Click on a vendor to view their order history
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredVendors.length === 0 ? (
                        <EnhancedEmptyState
                            icon={Building2}
                            title={searchTerm ? 'No Vendors Found' : 'No Vendors Yet'}
                            description={
                                searchTerm
                                    ? 'No vendors match your search criteria.'
                                    : 'Add vendors through Vendor Management to start tracking orders.'
                            }
                            secondaryAction={
                                searchTerm
                                    ? {
                                          label: 'Clear Search',
                                          onClick: () => setSearchTerm(''),
                                      }
                                    : undefined
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vendor Name</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Orders</TableHead>
                                        <TableHead className="text-right">Total Spent</TableHead>
                                        <TableHead>Last Order</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredVendors.map((vendor) => (
                                        <TableRow
                                            key={vendor.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleView(vendor)}
                                        >
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                                    {vendor.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    {vendor.contact_name || '-'}
                                                    {vendor.contact_email && (
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Mail className="h-3 w-3" />
                                                            {vendor.contact_email}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'}>
                                                    {vendor.status || 'active'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                                                    {vendor.total_orders}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                                                    {vendor.total_spent.toLocaleString('en-US', {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {vendor.last_order_date ? (
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                                        {formatSmartDate(vendor.last_order_date)}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Vendor Detail Dialog */}
            <VendorDetailDialog
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                vendor={selectedVendor}
            />
        </div>
    );
}

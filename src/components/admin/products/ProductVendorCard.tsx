/**
 * ProductVendorCard - Shows vendor information for a product
 *
 * Displays:
 * - Vendor name (clickable link to vendor detail)
 * - Contact info (email, phone)
 * - Last restock date
 * - Average lead time
 * - Vendor reliability score
 * - Quick action to reorder from vendor
 *
 * Connects product view directly to vendor module.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import Building2 from 'lucide-react/dist/esm/icons/building-2';
import Mail from 'lucide-react/dist/esm/icons/mail';
import Phone from 'lucide-react/dist/esm/icons/phone';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Star from 'lucide-react/dist/esm/icons/star';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import _Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useEntityNavigation } from '@/hooks/useEntityNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];

interface ProductVendorInfo {
    vendor: Vendor;
    lastRestockDate: string | null;
    averageLeadTimeDays: number | null;
    totalPurchaseOrders: number;
    reliabilityScore: number | null;
}

interface ProductVendorCardProps {
    productId: string | undefined;
    vendorName: string | null | undefined;
}

/**
 * Calculate reliability score based on on-time deliveries
 */
function calculateReliabilityScore(purchaseOrders: PurchaseOrder[]): number | null {
    if (purchaseOrders.length === 0) return null;

    const completedOrders = purchaseOrders.filter(po =>
        po.status === 'received' && po.received_date && po.expected_delivery_date
    );

    if (completedOrders.length === 0) return null;

    const onTimeOrders = completedOrders.filter(po => {
        const received = new Date(po.received_date!);
        const expected = new Date(po.expected_delivery_date!);
        return received <= expected;
    });

    return Math.round((onTimeOrders.length / completedOrders.length) * 100);
}

/**
 * Calculate average lead time in days
 */
function calculateAverageLeadTime(purchaseOrders: PurchaseOrder[]): number | null {
    const ordersWithDates = purchaseOrders.filter(po =>
        po.status === 'received' && po.received_date && po.created_at
    );

    if (ordersWithDates.length === 0) return null;

    const totalDays = ordersWithDates.reduce((sum, po) => {
        const created = new Date(po.created_at!);
        const received = new Date(po.received_date!);
        const diffTime = received.getTime() - created.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return sum + diffDays;
    }, 0);

    return Math.round(totalDays / ordersWithDates.length);
}

/**
 * Hook to fetch product vendor information
 */
function useProductVendors(productId: string | undefined, vendorName: string | null | undefined) {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: [...queryKeys.products.all, 'vendors', productId],
        queryFn: async (): Promise<ProductVendorInfo[]> => {
            if (!productId || !tenant?.id) {
                return [];
            }

            // First, find vendors that match by name or have purchase orders for this product
            const vendorInfos: ProductVendorInfo[] = [];

            // Get all vendors for this tenant
            const { data: vendors, error: vendorsError } = await supabase
                .from('vendors')
                .select('*')
                .eq('account_id', tenant.id);

            if (vendorsError) {
                logger.error('Failed to fetch vendors', vendorsError, { component: 'ProductVendorCard' });
                throw vendorsError;
            }

            if (!vendors || vendors.length === 0) {
                return [];
            }

            // For each vendor, get their purchase orders to calculate stats
            for (const vendor of vendors) {
                // Check if this vendor matches by name or has supplied this product
                const isMatchByName = vendorName &&
                    vendor.name.toLowerCase().includes(vendorName.toLowerCase());

                // Get purchase orders for this vendor
                const { data: purchaseOrders, error: poError } = await supabase
                    .from('purchase_orders')
                    .select('*')
                    .eq('vendor_id', vendor.id)
                    .eq('account_id', tenant.id)
                    .order('created_at', { ascending: false });

                if (poError) {
                    logger.error('Failed to fetch purchase orders', poError, {
                        component: 'ProductVendorCard',
                        vendorId: vendor.id
                    });
                    continue;
                }

                // Check if any PO contains this product (via purchase_order_items)
                const { data: poItems, error: poItemsError } = await supabase
                    .from('purchase_order_items')
                    .select('purchase_order_id')
                    .eq('product_id', productId);

                if (poItemsError) {
                    logger.error('Failed to fetch PO items for vendor', poItemsError, {
                        component: 'ProductVendorCard',
                        productId,
                        vendorId: vendor.id,
                    });
                    continue;
                }

                const hasSuppliedProduct = poItems && poItems.length > 0 &&
                    purchaseOrders?.some(po =>
                        poItems.some(item => item.purchase_order_id === po.id)
                    );

                // Only include vendor if matched by name or has supplied this product
                if (!isMatchByName && !hasSuppliedProduct) {
                    continue;
                }

                // Find the last restock (received PO) date
                const receivedOrders = purchaseOrders?.filter(po =>
                    po.status === 'received' && po.received_date
                ) ?? [];
                const lastRestock = receivedOrders.length > 0
                    ? receivedOrders[0].received_date
                    : null;

                vendorInfos.push({
                    vendor,
                    lastRestockDate: lastRestock,
                    averageLeadTimeDays: calculateAverageLeadTime(purchaseOrders ?? []),
                    totalPurchaseOrders: purchaseOrders?.length ?? 0,
                    reliabilityScore: calculateReliabilityScore(purchaseOrders ?? []),
                });
            }

            return vendorInfos;
        },
        enabled: !!productId && !!tenant?.id,
        staleTime: 60_000, // 1 minute
    });
}

/**
 * Single vendor info display
 */
function VendorInfoItem({ info, productId }: { info: ProductVendorInfo; productId: string }) {
    const { navigateToAdmin } = useTenantNavigation();
    const { getEntityUrl } = useEntityNavigation();
    const vendorUrl = getEntityUrl('VENDOR', info.vendor.id);

    const handleReorder = () => {
        // Navigate to new purchase order page with vendor pre-selected
        navigateToAdmin(`purchase-orders/new?vendor=${info.vendor.id}&product=${productId}`);
    };

    return (
        <div className="p-4 border rounded-lg space-y-3">
            {/* Vendor Name - Clickable */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    {vendorUrl ? (
                        <Link
                            to={vendorUrl}
                            className="font-medium text-lg hover:text-primary hover:underline underline-offset-2 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {info.vendor.name}
                        </Link>
                    ) : (
                        <span className="font-medium text-lg">{info.vendor.name}</span>
                    )}
                </div>
                <Badge variant={info.vendor.status === 'active' ? 'default' : 'secondary'}>
                    {info.vendor.status ?? 'active'}
                </Badge>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {info.vendor.contact_email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <a
                            href={`mailto:${info.vendor.contact_email}`}
                            className="hover:text-primary hover:underline"
                        >
                            {info.vendor.contact_email}
                        </a>
                    </div>
                )}
                {info.vendor.contact_phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <a
                            href={`tel:${info.vendor.contact_phone}`}
                            className="hover:text-primary hover:underline"
                        >
                            {info.vendor.contact_phone}
                        </a>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {/* Last Restock */}
                <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-xs">Last Restock</span>
                    </div>
                    <p className="font-medium text-sm">
                        {info.lastRestockDate
                            ? formatDistanceToNow(new Date(info.lastRestockDate), { addSuffix: true })
                            : 'Never'}
                    </p>
                </div>

                {/* Average Lead Time */}
                <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs">Avg Lead Time</span>
                    </div>
                    <p className="font-medium text-sm">
                        {info.averageLeadTimeDays !== null
                            ? `${info.averageLeadTimeDays} days`
                            : 'N/A'}
                    </p>
                </div>

                {/* Reliability Score */}
                <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Star className="h-3 w-3" />
                        <span className="text-xs">Reliability</span>
                    </div>
                    <p className={`font-medium text-sm ${
                        info.reliabilityScore !== null
                            ? info.reliabilityScore >= 80
                                ? 'text-green-600'
                                : info.reliabilityScore >= 60
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                            : ''
                    }`}>
                        {info.reliabilityScore !== null
                            ? `${info.reliabilityScore}%`
                            : 'N/A'}
                    </p>
                </div>

                {/* Total Orders */}
                <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <ShoppingCart className="h-3 w-3" />
                        <span className="text-xs">Total POs</span>
                    </div>
                    <p className="font-medium text-sm">
                        {info.totalPurchaseOrders}
                    </p>
                </div>
            </div>

            {/* Reorder Action */}
            <div className="pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleReorder}
                >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Create Purchase Order
                </Button>
            </div>
        </div>
    );
}

/**
 * ProductVendorCard Component
 */
export function ProductVendorCard({ productId, vendorName }: ProductVendorCardProps) {
    const { data: vendorInfos, isLoading, error } = useProductVendors(productId, vendorName);

    // Loading state
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Vendor Information
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <div className="grid grid-cols-4 gap-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Error state
    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Vendor Information
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>Failed to load vendor information</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // No vendors found
    if (!vendorInfos || vendorInfos.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Vendor Information
                    </CardTitle>
                    <CardDescription>
                        Supplier and reorder information
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No vendor linked to this product</p>
                        {vendorName && (
                            <p className="text-sm mt-1">
                                Vendor name on product: <span className="font-medium">{vendorName}</span>
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Vendor Information
                </CardTitle>
                <CardDescription>
                    {vendorInfos.length === 1
                        ? 'Supplier and reorder information'
                        : `${vendorInfos.length} vendors supply this product`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {vendorInfos.map((info) => (
                    <VendorInfoItem
                        key={info.vendor.id}
                        info={info}
                        productId={productId!}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

export default ProductVendorCard;

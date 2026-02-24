import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    RefreshCcw,
    ArrowRightLeft,
    AlertCircle,
    Clock,
    Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductSyncStatus {
    id: string; // sync record id
    sync_status: 'synced' | 'pending' | 'error';
    last_synced_at: string;
    last_attempt_at: string;
    sync_errors: Record<string, unknown> | null;
    listing_id: string;
}

interface ProductWithSync {
    id: string;
    name: string;
    category: string;
    wholesale_price: number | null;
    retail_price: number | null;
    available_quantity: number;
    image_url: string | null;
    marketplace_product_sync: ProductSyncStatus[]; // Array due to left join structure in Supabase
}

export default function ProductSyncPage() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

    // 1. Fetch Store (Needed for store_id)
    const { data: store, isLoading: isLoadingStore } = useQuery({
        queryKey: queryKeys.marketplaceStore.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return null;
            const { data, error } = await supabase
                .from('marketplace_stores')
                .select('id, store_name')
                .eq('tenant_id', tenant.id)
                .maybeSingle();

            if (error) {
                logger.error('Failed to fetch marketplace store', error);
                return null;
            }
            return data as { id: string; store_name: string } | null;
        },
        enabled: !!tenant?.id
    });

    // 2. Fetch Products with Sync Status
    const { data: products, isLoading: isLoadingProducts, refetch } = useQuery({
        queryKey: queryKeys.marketplaceProductSettings.sync(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];

            // Fetch products and their sync status
            const { data, error } = await supabase
                .from('products')
                .select(`
                    id, 
                    name, 
                    category, 
                    wholesale_price, 
                    retail_price, 
                    available_quantity, 
                    image_url,
                    marketplace_product_sync(
                        id,
                        sync_status,
                        last_synced_at,
                        last_attempt_at,
                        sync_errors,
                        listing_id
                    )
                `)
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false });

            if (error) {
                logger.error('Failed to fetch products for sync', error);
                throw error;
            }
            return data as unknown as ProductWithSync[];
        },
        enabled: !!tenant?.id
    });

    // 3. Sync Mutation
    // 3. Sync Mutation
    const syncMutation = useMutation({
        mutationFn: async (productId: string) => {
            if (!store?.id) throw new Error("No marketplace store found");

            const { data, error } = await supabase.rpc('sync_product_to_marketplace', {
                p_product_id: productId,
                p_store_id: store.id
            });

            if (error) throw error;
            return data;
        },
        onMutate: (productId) => {
            setSyncingIds(prev => new Set(prev).add(productId));
        },
        onSettled: (data, error, productId) => {
            setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete(productId);
                return next;
            });
            if (!error) {
                toast.success("Product synced successfully");
                queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProductSettings.sync() });
                queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceListings.all });
                // Invalidate storefront product caches for instant sync
                queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
            } else {
                toast.error(`Sync failed: ${(error as Error).message}`);
            }
        }
    });

    const handleSync = (productId: string) => {
        if (!store) {
            toast.error("You must create a Marketplace Store first.");
            return;
        }
        syncMutation.mutate(productId);
    };

    const handleBulkSync = async () => {
        if (!products || !store) return;

        // rudimentary bulk sync - just loop (better to have a bulk RPC but this works for MVP)
        const unsynced = products.filter(p => !getSyncStatus(p));
        if (unsynced.length === 0) {
            toast.info("All products are already synced.");
            return;
        }

        toast.info(`Starting sync for ${unsynced.length} products...`);

        // Process in chunks or one by one
        let successCount = 0;
        let failCount = 0;

        for (const p of unsynced) {
            try {
                await syncMutation.mutateAsync(p.id);
                successCount++;
            } catch {
                failCount++;
            }
        }
        toast.success(`Bulk sync complete. Success: ${successCount}, Failed: ${failCount}`);
    };

    // Helper to get sync record safely
    const getSyncStatus = (product: ProductWithSync) => {
        return product.marketplace_product_sync?.[0];
    };

    // Filtering
    const filteredProducts = products?.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoadingStore || isLoadingProducts) {
        return <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-[400px] w-full" />
        </div>;
    }

    if (!store) {
        return (
            <div className="p-6">
                <Card className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                            <AlertCircle className="h-5 w-5" />
                            Marketplace Store Required
                        </CardTitle>
                        <CardDescription className="text-amber-700 dark:text-amber-500">
                            You need to set up your Marketplace Store before you can sync products.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate(`/${tenant?.slug}/admin/storefront`)}>
                            Create Store
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <ArrowRightLeft className="h-8 w-8 text-primary" />
                        Product Sync
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Synchronize your B2B products to the Marketplace listings.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => refetch()} disabled={isLoadingProducts}>
                        <RefreshCcw className={`mr-2 h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={handleBulkSync}>
                        Sync New Products
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Products</CardTitle>
                    <CardDescription>
                        Manage which products are visible on the marketplace.
                    </CardDescription>
                    <div className="flex items-center pt-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                aria-label="Search products"
                                placeholder="Search products..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Price (Wholesale)</TableHead>
                                    <TableHead className="text-center">Stock</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Synced</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No products found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProducts?.map((product) => {
                                        const syncStatus = getSyncStatus(product);
                                        const isSyncing = syncingIds.has(product.id);
                                        const isSynced = syncStatus?.sync_status === 'synced';

                                        return (
                                            <TableRow key={product.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        {product.image_url && (
                                                            <div className="h-10 w-10 rounded-md overflow-hidden bg-muted">
                                                                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                                            </div>
                                                        )}
                                                        <span>{product.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {product.category || 'Uncategorized'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(product.wholesale_price || product.retail_price || 0)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {product.available_quantity}
                                                </TableCell>
                                                <TableCell>
                                                    {syncStatus ? (
                                                        <div className="flex items-center gap-2">
                                                            {syncStatus.sync_status === 'synced' ? (
                                                                <Badge className="bg-green-500 hover:bg-green-600">Synced</Badge>
                                                            ) : syncStatus.sync_status === 'error' ? (
                                                                <Badge variant="destructive">Error</Badge>
                                                            ) : (
                                                                <Badge variant="secondary">Pending</Badge>
                                                            )}
                                                            {syncStatus.sync_errors && (
                                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground">Not Synced</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {syncStatus?.last_synced_at ? (
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {format(new Date(syncStatus.last_synced_at), 'MMM d, h:mm a')}
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant={isSynced ? "outline" : "default"}
                                                        onClick={() => handleSync(product.id)}
                                                        disabled={isSyncing}
                                                    >
                                                        {isSyncing ? (
                                                            <RefreshCcw className="h-4 w-4 animate-spin" />
                                                        ) : isSynced ? (
                                                            "Update"
                                                        ) : (
                                                            "Sync"
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

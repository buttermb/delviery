import { useState, useMemo } from "react";
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
    Search,
    CheckCircle2,
    Database,
    Store
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
        enabled: !!tenant?.id,
        retry: 2,
    });

    // 2. Fetch Products with Sync Status
    const { data: products, isLoading: isLoadingProducts, refetch } = useQuery({
        queryKey: queryKeys.marketplaceProductSettings.sync(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];

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
        enabled: !!tenant?.id,
        retry: 2,
    });

    // Helper to get sync record safely
    const getSyncStatus = (product: ProductWithSync) => {
        return product.marketplace_product_sync?.[0];
    };

    // 3. Single Sync Mutation
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
            } else {
                toast.error(`Sync failed: ${(error as Error).message}`);
            }
        }
    });

    // 4. Bulk Sync Mutation
    const bulkSyncMutation = useMutation({
        mutationFn: async (productIds: string[]) => {
            if (!store?.id) throw new Error("No marketplace store found");

            const { data, error } = await supabase.rpc('sync_products_to_marketplace_bulk', {
                p_product_ids: productIds,
                p_store_id: store.id
            });

            if (error) throw error;
            
            // The RPC returns { success: boolean, synced: number, failed: number, errors: [] }
            // Let's typecast it since we just defined it in SQL
            return data as unknown as { success: boolean, synced: number, failed: number, errors: unknown[] };
        },
        onSettled: (data, error) => {
            if (!error && data) {
                if (data.failed > 0) {
                    toast.warning(`Synced ${data.synced} products, but ${data.failed} failed.`);
                    logger.warn('Bulk sync had failures', { errors: data.errors });
                } else {
                    toast.success(`Successfully synced ${data.synced} products to marketplace!`);
                }
                queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProductSettings.sync() });
                queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceListings.all });
            } else {
                toast.error(`Bulk sync failed: ${(error as Error).message}`);
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

        const unsynced = products.filter(p => !getSyncStatus(p));
        if (unsynced.length === 0) {
            toast.info("All products are already synced.");
            return;
        }

        toast.loading(`Syncing ${unsynced.length} products...`, { id: 'bulk-sync' });
        
        await bulkSyncMutation.mutateAsync(unsynced.map(p => p.id));
        
        toast.dismiss('bulk-sync');
    };

    // Derived Metrics
    const metrics = useMemo(() => {
        if (!products) return { total: 0, synced: 0, pending: 0, errors: 0 };
        return products.reduce((acc, p) => {
            acc.total++;
            const status = getSyncStatus(p)?.sync_status;
            if (status === 'synced') acc.synced++;
            else if (status === 'error') acc.errors++;
            else acc.pending++;
            return acc;
        }, { total: 0, synced: 0, pending: 0, errors: 0 });
    }, [products]);

    // Filtering
    const filteredProducts = products?.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoadingStore || isLoadingProducts) {
        return <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
            </div>
            <Skeleton className="h-[500px] w-full rounded-2xl" />
        </div>;
    }

    if (!store) {
        return (
            <div className="p-6 max-w-3xl mx-auto mt-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/10 dark:to-background border-amber-200 dark:border-amber-800 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/10 blur-3xl w-64 h-64" />
                        <CardHeader className="relative z-10 pb-2">
                            <CardTitle className="text-2xl font-bold flex items-center gap-3 text-amber-900 dark:text-amber-500">
                                <Store className="h-8 w-8 text-amber-500" />
                                Store Setup Required
                            </CardTitle>
                            <CardDescription className="text-amber-800/80 dark:text-amber-500/80 text-base max-w-lg mt-2">
                                You need to set up your digital storefront profile before you can publish products to the B2B marketplace.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-6">
                            <Button size="lg" className="bg-amber-600 hover:bg-amber-700 shadow-md" onClick={() => navigate(`/${tenant?.slug}/admin/storefront`)}>
                                Configure Storefront <ArrowRightLeft className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto pb-20">
            {/* Header Area */}
            <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-emerald-500/10 via-primary/5 to-blue-500/10 p-6 md:p-8 shadow-sm">
                <div className="absolute top-0 right-0 p-8 translate-x-1/3 -translate-y-1/3">
                    <div className="w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-end justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                            <ArrowRightLeft className="h-5 w-5" />
                            <span>Marketplace Sync</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Product Publishing
                        </h1>
                        <p className="text-muted-foreground mt-2 max-w-xl">
                            Synchronize your internal B2B inventory to your public marketplace storefront. Keep pricing, availability, and descriptions perfectly aligned in real-time.
                        </p>
                    </div>
                    
                    <div className="flex gap-3">
                        <Button 
                            variant="outline" 
                            size="lg"
                            className="bg-background/50 backdrop-blur-md rounded-xl shadow-sm"
                            onClick={() => refetch()} 
                            disabled={isLoadingProducts}
                        >
                            <RefreshCcw className={`mr-2 h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button 
                            size="lg"
                            className="bg-primary hover:bg-primary/90 rounded-xl shadow-md"
                            onClick={handleBulkSync}
                            disabled={metrics.pending === 0 || bulkSyncMutation.isPending}
                        >
                            {bulkSyncMutation.isPending ? (
                                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Database className="mr-2 h-4 w-4" />
                            )}
                            Sync {metrics.pending} Pending
                        </Button>
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="bg-card/50 backdrop-blur-sm shadow-sm border-muted">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">Available products</p>
                        </CardContent>
                    </Card>
                </motion.div>
                
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <Card className="bg-emerald-500/5 dark:bg-emerald-500/10 backdrop-blur-sm shadow-sm border-emerald-200 dark:border-emerald-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Live on Market</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{metrics.synced}</div>
                            <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1">Successfully synced</p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="bg-amber-500/5 dark:bg-amber-500/10 backdrop-blur-sm shadow-sm border-amber-200 dark:border-amber-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-400">Pending Sync</CardTitle>
                            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{metrics.pending}</div>
                            <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">Waiting to publish</p>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <Card className={cn(
                        "backdrop-blur-sm shadow-sm transition-colors",
                        metrics.errors > 0 
                            ? "bg-red-500/5 border-red-200 dark:bg-red-500/10 dark:border-red-800"
                            : "bg-card/50 border-muted"
                    )}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className={cn("text-sm font-medium", metrics.errors > 0 ? "text-red-800 dark:text-red-400" : "")}>
                                Sync Errors
                            </CardTitle>
                            <AlertCircle className={cn("h-4 w-4", metrics.errors > 0 ? "text-red-600 dark:text-red-500" : "text-muted-foreground")} />
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-2xl font-bold", metrics.errors > 0 ? "text-red-700 dark:text-red-400" : "")}>{metrics.errors}</div>
                            <p className={cn("text-xs mt-1", metrics.errors > 0 ? "text-red-600/70 dark:text-red-500/70" : "text-muted-foreground")}>
                                Needs attention
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Table Area */}
            <Card className="shadow-sm border-muted overflow-hidden">
                <CardHeader className="bg-muted/20 border-b pb-4">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div>
                            <CardTitle>Catalog Sync Status</CardTitle>
                            <CardDescription>
                                Individual product mapping and current visibility status.
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by name or category..."
                                className="pl-9 bg-background/50 backdrop-blur-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/10">
                            <TableRow>
                                <TableHead className="w-[300px]">Product</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-center">Stock</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Updated</TableHead>
                                <TableHead className="text-right pr-6">Manual Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <AnimatePresence>
                                {filteredProducts?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            No products matched your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProducts?.map((product) => {
                                        const syncStatus = getSyncStatus(product);
                                        const isSyncing = syncingIds.has(product.id) || bulkSyncMutation.isPending;
                                        const isSynced = syncStatus?.sync_status === 'synced';
                                        const hasError = syncStatus?.sync_status === 'error';

                                        return (
                                            <TableRow key={product.id} className="group hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        {product.image_url ? (
                                                            <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border shadow-sm">
                                                                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" loading="lazy" />
                                                            </div>
                                                        ) : (
                                                            <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center border shadow-sm text-muted-foreground">
                                                                <Package className="h-4 w-4" />
                                                            </div>
                                                        )}
                                                        <span className="truncate max-w-[200px]" title={product.name}>{product.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize bg-background">
                                                        {product.category || 'Draft'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(product.wholesale_price || product.retail_price || 0)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-semibold",
                                                        product.available_quantity > 10 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                                        product.available_quantity > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                    )}>
                                                        {product.available_quantity}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {syncStatus ? (
                                                        <div className="flex items-center gap-2">
                                                            {isSynced ? (
                                                                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200 dark:border-emerald-800">Synced</Badge>
                                                            ) : hasError ? (
                                                                <Badge variant="destructive" className="shadow-sm">Error</Badge>
                                                            ) : (
                                                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20">Pending</Badge>
                                                            )}
                                                            {hasError && syncStatus.sync_errors && (
                                                                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" title={JSON.stringify(syncStatus.sync_errors)} />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground bg-background">Not Published</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {syncStatus?.last_synced_at ? (
                                                        <div className="flex items-center gap-1.5 opacity-80">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {format(new Date(syncStatus.last_synced_at), 'MMM d, h:mm a')}
                                                        </div>
                                                    ) : <span className="text-muted-foreground/50">-</span>}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Button
                                                        size="sm"
                                                        variant={isSynced ? "ghost" : "default"}
                                                        className={cn(
                                                            "transition-all",
                                                            isSynced ? "opacity-0 group-hover:opacity-100" : "shadow-sm"
                                                        )}
                                                        onClick={() => handleSync(product.id)}
                                                        disabled={isSyncing}
                                                    >
                                                        {isSyncing ? (
                                                            <RefreshCcw className="h-4 w-4 animate-spin" />
                                                        ) : isSynced ? (
                                                            "Force Re-sync"
                                                        ) : (
                                                            "Publish"
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </AnimatePresence>
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}

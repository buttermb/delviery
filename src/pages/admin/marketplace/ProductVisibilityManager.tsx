
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { humanizeError } from "@/lib/humanizeError";
import { Loader2, Plus, Search, Filter, MoreHorizontal } from "lucide-react";
import { MarketplaceListing } from "@/types/marketplace-extended";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { queryKeys } from '@/lib/queryKeys';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ProductVisibilityManager() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const navigateTenant = useTenantNavigate();
    const [searchTerm, setSearchTerm] = useState("");

    // Fetch listings
    const { data: listings, isLoading } = useQuery<MarketplaceListing[]>({
        queryKey: queryKeys.marketplaceListings.byTenant(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];

            const { data, error } = await supabase
                .from('marketplace_listings')
                .select('id, tenant_id, product_name, product_type, strain_type, base_price, unit_type, quantity_available, images, status, visibility, created_at')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as MarketplaceListing[];
        },
        enabled: !!tenant?.id
    });

    // Toggle visibility mutation
    const toggleVisibility = useMutation({
        mutationFn: async ({ id, currentVisibility }: { id: string, currentVisibility: string }) => {
            if (!tenant?.id) throw new Error("No tenant");
            const newVisibility = currentVisibility === 'public' ? 'hidden' : 'public';
            const { error } = await supabase
                .from('marketplace_listings')
                .update({ visibility: newVisibility })
                .eq('id', id)
                .eq('tenant_id', tenant.id);

            if (error) throw error;
            return newVisibility;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceListings.all });
            toast.success("Visibility updated");
        },
        onError: (error) => {
            toast.error(humanizeError(error, "Failed to update visibility"));
        }
    });

    // Toggle active status mutation
    const toggleStatus = useMutation({
        mutationFn: async ({ id, currentStatus }: { id: string, currentStatus: string }) => {
            if (!tenant?.id) throw new Error("No tenant");
            const newStatus = currentStatus === 'active' ? 'draft' : 'active';
            const { error } = await supabase
                .from('marketplace_listings')
                .update({ status: newStatus })
                .eq('id', id)
                .eq('tenant_id', tenant.id);

            if (error) throw error;
            return newStatus;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceListings.all });
            toast.success("Status updated");
        },
        onError: (error) => {
            toast.error(humanizeError(error, "Failed to update status"));
        }
    });

    const filteredListings = listings?.filter(listing =>
        listing.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    ) ?? [];

    if (isLoading) {
        return <EnhancedLoadingState variant="table" message="Loading products..." />;
    }

    return (
        <div className="space-y-4 h-full p-4 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Product Visibility</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage which products are visible in your marketplace store.
                    </p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                </Button>
            </div>

            <Card>
                <CardHeader className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                aria-label="Search products"
                                placeholder="Search products..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                                <Filter className="mr-2 h-4 w-4" />
                                Filter
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Image</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Stock</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Visible</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredListings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        No listings found. Click "Add Product" to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredListings.map((listing) => (
                                    <TableRow key={listing.id}>
                                        <TableCell>
                                            <div className="h-10 w-10 rounded bg-muted overflow-hidden flex items-center justify-center">
                                                {listing.images && listing.images[0] ? (
                                                    <img src={listing.images[0]} alt={listing.product_name} className="h-full w-full object-cover" loading="lazy" />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">No Img</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {listing.product_name}
                                            {listing.strain_type && (
                                                <div className="text-xs text-muted-foreground capitalize">{listing.strain_type}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="capitalize">{listing.product_type}</TableCell>
                                        <TableCell>${listing.base_price?.toFixed(2)} / {listing.unit_type}</TableCell>
                                        <TableCell>
                                            <Badge variant={listing.quantity_available && listing.quantity_available > 0 ? "outline" : "destructive"}>
                                                {listing.quantity_available ?? 0}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={
                                                listing.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-900' :
                                                    listing.status === 'draft' ? 'bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-800' :
                                                        'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-900'
                                            }>
                                                {listing.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Switch
                                                checked={listing.visibility === 'public'}
                                                disabled={toggleVisibility.isPending}
                                                onCheckedChange={() => toggleVisibility.mutate({
                                                    id: listing.id,
                                                    currentVisibility: listing.visibility || 'hidden'
                                                })}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-11 w-11 p-0" aria-label="Listing actions">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => navigateTenant(`/admin/marketplace/listings/${listing.id}/edit`)}>Edit Details</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => navigateTenant(`/admin/marketplace/listings/${listing.id}`)}>Manage Bulk Pricing</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        disabled={toggleStatus.isPending}
                                                        onClick={() => toggleStatus.mutate({
                                                            id: listing.id,
                                                            currentStatus: listing.status
                                                        })}
                                                    >
                                                        {toggleStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                        {listing.status === 'active' ? 'Deactivate' : 'Activate'}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

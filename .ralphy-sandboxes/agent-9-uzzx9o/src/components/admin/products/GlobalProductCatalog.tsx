import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import {
    Search,
    Loader2,
    Download,
    CheckCircle,
    Package,
    Sparkles,
    Filter
} from 'lucide-react';

interface GlobalProduct {
    id: string;
    sku: string;
    name: string;
    brand: string;
    category: string;
    description: string;
    images: string[];
    thc_percent: number;
    cbd_percent: number;
    strain_type: string;
    effects: string[];
    is_verified: boolean;
}

const CATEGORIES = ['flower', 'vape', 'edible', 'concentrate', 'pre-roll', 'topical', 'tincture'];

export function GlobalProductCatalog() {
    const { tenant } = useTenant();
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('__all__');
    const [brandFilter, setBrandFilter] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 300);
    const debouncedBrand = useDebounce(brandFilter, 300);

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<GlobalProduct | null>(null);
    const [importPrice, setImportPrice] = useState('');
    const [autoSync, setAutoSync] = useState(false);

    // Fetch Global Products
    const { data: products = [], isLoading } = useQuery({
        queryKey: queryKeys.globalProducts.list(debouncedSearch, categoryFilter, debouncedBrand),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('search_global_products', {
                p_query: debouncedSearch || null,
                p_category: categoryFilter === '__all__' ? null : categoryFilter || null,
                p_brand: debouncedBrand || null,
                p_limit: 50,
                p_offset: 0
            });

            if (error) throw error;
            return (data ?? []) as GlobalProduct[];
        },
    });

    // Fetch already imported products
    const { data: imports = [] } = useQuery({
        queryKey: queryKeys.globalProducts.imports(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];
            const { data, error } = await supabase
                .from('global_product_imports')
                .select('global_product_id')
                .eq('tenant_id', tenant.id);

            if (error) throw error;
            return (data ?? []).map((i: Record<string, unknown>) => i.global_product_id);
        },
        enabled: !!tenant?.id,
    });

    // Import Mutation
    const importMutation = useMutation({
        mutationFn: async () => {
            if (!selectedProduct || !tenant?.id) throw new Error('Missing data');

            // Get marketplace profile ID
            const { data: profile } = await supabase
                .from('marketplace_profiles')
                .select('id')
                .eq('tenant_id', tenant.id)
                .maybeSingle();

            if (!profile) throw new Error('No marketplace profile found');

            const { data, error } = await supabase.rpc('import_global_product', {
                p_tenant_id: tenant.id,
                p_global_product_id: selectedProduct.id,
                p_price: Number(importPrice),
                p_marketplace_profile_id: profile.id,
                p_auto_sync: autoSync
            });

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.globalProducts.imports() });
            toast.success("Check your Products tab to set pricing and publish.");
            setIsImportDialogOpen(false);
            setSelectedProduct(null);
            setImportPrice('');
            setAutoSync(false);
        },
        onError: (err) => {
            toast.error("Import failed", { description: humanizeError(err) });
        },
    });

    const handleImportClick = (product: GlobalProduct) => {
        setSelectedProduct(product);
        setIsImportDialogOpen(true);
    };

    const isImported = (productId: string) => imports.includes(productId);

    return (
        <div className="space-y-6">
            {/* Search & Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Global Product Catalog
                    </CardTitle>
                    <CardDescription>
                        Browse verified products and import them to your store with one click
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                aria-label="Search products"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[150px]" aria-label="Filter by category">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Brand..."
                            aria-label="Filter by brand"
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                            className="w-[150px]"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Products Grid */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : products.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-medium">No products found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map(product => (
                        <Card key={product.id} className="overflow-hidden">
                            {/* Image */}
                            <div className="aspect-square bg-muted relative">
                                {product.images?.[0] ? (
                                    <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Package className="h-12 w-12 text-muted-foreground/50" />
                                    </div>
                                )}
                                {product.is_verified && (
                                    <Badge className="absolute top-2 right-2 bg-emerald-500">
                                        <CheckCircle className="h-3 w-3 mr-1" /> Verified
                                    </Badge>
                                )}
                            </div>

                            <CardContent className="p-4">
                                <div className="mb-2">
                                    {product.brand && (
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{product.brand}</p>
                                    )}
                                    <h3 className="font-semibold truncate">{product.name}</h3>
                                </div>

                                <div className="flex flex-wrap gap-1 mb-3">
                                    <Badge variant="outline" className="text-xs capitalize">{product.category}</Badge>
                                    {product.strain_type && (
                                        <Badge variant="secondary" className="text-xs capitalize">{product.strain_type}</Badge>
                                    )}
                                    {product.thc_percent && (
                                        <Badge variant="secondary" className="text-xs">THC {product.thc_percent}%</Badge>
                                    )}
                                </div>

                                {isImported(product.id) ? (
                                    <Button variant="secondary" disabled className="w-full">
                                        <CheckCircle className="h-4 w-4 mr-2" /> Already Imported
                                    </Button>
                                ) : (
                                    <Button onClick={() => handleImportClick(product)} className="w-full">
                                        <Download className="h-4 w-4 mr-2" /> Import to Store
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Product</DialogTitle>
                        <DialogDescription>
                            Import "{selectedProduct?.name}" to your store
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Your Price ($)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={importPrice}
                                onChange={(e) => setImportPrice(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Set the price you want to sell at. This won't be affected by syncs.
                            </p>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="auto-sync"
                                checked={autoSync}
                                onCheckedChange={(checked) => setAutoSync(checked as boolean)}
                            />
                            <Label htmlFor="auto-sync" className="text-sm">
                                Enable auto-sync (updates name, description, images when source changes)
                            </Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => importMutation.mutate()}
                            disabled={!importPrice || importMutation.isPending}
                        >
                            {importMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            Import Product
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

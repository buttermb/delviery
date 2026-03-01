import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Leaf, Cookie, Cigarette, Droplets, Wind, Package, Grid3X3, List, ArrowUpDown } from "lucide-react";
import { useInventoryBatch } from "@/hooks/useInventoryBatch";
import { useShopCart } from "@/hooks/useShopCart";
import { toast } from 'sonner';
import { logger } from "@/lib/logger";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { StorefrontProductCard } from "@/components/shop/StorefrontProductCard";
import ProductImage from "@/components/ProductImage";

// Local product type for data from RPC/queries that gets normalized
interface LocalProduct {
    id?: string;
    product_id?: string;
    name?: string;
    product_name?: string;
    price?: number;
    base_price?: number;
    description?: string;
    images?: string[];
    category?: string;
    in_stock?: boolean;
    strain_type?: string;
    quantity_available?: number;
}

type SortOption = 'default' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest';
type ViewMode = 'grid' | 'list';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'default', label: 'Featured' },
    { value: 'newest', label: 'Newest' },
    { value: 'name_asc', label: 'Name A–Z' },
    { value: 'name_desc', label: 'Name Z–A' },
    { value: 'price_asc', label: 'Price: Low → High' },
    { value: 'price_desc', label: 'Price: High → Low' },
];

export interface ProductGridSectionProps {
    content: {
        heading: string;
        subheading: string;
        columns: number;
        max_products: number;
        sort_order: string;
        show_view_all_link: boolean;
        category_filter: string;
        show_search: boolean;
        show_categories: boolean;
        initial_categories_shown: number;
        show_premium_filter: boolean;
        // Feature toggles from Easy Mode
        show_sale_badges?: boolean;
        show_new_badges?: boolean;
        show_strain_badges?: boolean;
        show_stock_warnings?: boolean;
    };
    styles: {
        background_color: string;
        text_color: string;
        accent_color: string;
    };
    storeId?: string;
}

export function ProductGridSection({ content, styles, storeId }: ProductGridSectionProps) {
    const { storeSlug } = useParams<{ storeSlug: string }>();
    const {
        heading = "Shop Premium Flower",
        subheading = "Premium indoor-grown flower from licensed NYC cultivators",
        columns = 4,
        max_products = 20,
        sort_order = 'newest',
        show_view_all_link = true,
        category_filter = 'all',
        show_search = true,
        show_categories: _show_categories = true,
        initial_categories_shown = 2,
        show_premium_filter = true,
        // Feature toggles - default to true if not specified
        show_sale_badges = true,
        show_new_badges = true,
        show_strain_badges = true,
        show_stock_warnings = true,
    } = content || {};

    const {
        background_color = "#f4f4f5", // zinc-100/muted
        text_color = "#000000",
        accent_color = "#10b981" // emerald-500
    } = styles || {};

    const [showAllCategories, setShowAllCategories] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [premiumFilter, setPremiumFilter] = useState(false);
    const [userSort, setUserSort] = useState<SortOption>('default');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    // Cart integration
    const { addItem } = useShopCart({
        storeId: storeId,
        onCartChange: () => { },
    });

    const handleQuickAdd = (e: React.MouseEvent, product: LocalProduct & { id: string }) => {
        e.preventDefault();

        addItem({
            productId: product.id,
            name: product.name ?? '',
            price: product.price ?? 0,
            quantity: 1,
            imageUrl: product.images?.[0],
        });
        toast.success('Added to cart', {
            description: `${product.name} has been added to your cart.`
        });
    };

    // Fetch products - normalized to LocalProduct[]
    const { data: allProducts = [], isLoading, error } = useQuery<LocalProduct[]>({
        queryKey: queryKeys.shopProducts.list(storeId),
        queryFn: async () => {
            if (storeId) {
                // Public Storefront View - try RPC first, fallback to direct query
                try {
                    const { data, error } = await supabase
                        .rpc('get_marketplace_products', { p_store_id: storeId });

                    if (error) {
                        // RPC might not exist, fallback to direct query
                        logger.warn('RPC get_marketplace_products failed, using fallback', { message: error.message });
                        const { data: fallbackData, error: fallbackError } = await supabase
                            .from('marketplace_product_settings')
                            .select(`
                                product_id,
                                is_visible,
                                custom_price,
                                products:product_id (
                                    id, name, description, price, category, images, in_stock
                                )
                            `)
                            .eq('store_id', storeId)
                            .eq('is_visible', true);

                        if (fallbackError) throw fallbackError;

                        return ((fallbackData as unknown[]) ?? []).map((item: unknown) => {
                            const row = item as Record<string, unknown>;
                            const products = row.products as Record<string, unknown> | null;
                            return {
                                id: row.product_id as string,
                                name: products?.name as string | undefined,
                                price: (row.custom_price as number) || (products?.price as number) || 0,
                                images: (products?.images as string[]) ?? [],
                                category: products?.category as string | undefined,
                                description: products?.description as string | undefined,
                                in_stock: products?.in_stock as boolean | undefined,
                            };
                        }) as LocalProduct[];
                    }

                    // Normalize RPC data to LocalProduct interface
                    return ((data as unknown[]) ?? []).map((item: unknown) => {
                        const p = item as Record<string, unknown>;
                        return {
                            id: (p.product_id || p.id) as string,
                            name: (p.product_name || p.name) as string,
                            price: (p.base_price || p.price || 0) as number,
                            description: p.description as string | undefined,
                            images: (p.images as string[]) ?? [],
                            category: p.category as string | undefined,
                            in_stock: ((p.quantity_available as number) ?? 0) > 0,
                            strain_type: (p.strain_type as string) ?? '',
                        };
                    }) as LocalProduct[];
                } catch (err) {
                    logger.error('Error fetching marketplace products', err);
                    return [];
                }
            } else {
                // Admin Builder Preview — return empty so the preview shows the
                // "Coming soon" empty state instead of hitting RLS errors.
                return [];
            }
        },
        retry: 1,
    });

    const productIds = allProducts.map(p => p.id).filter((id): id is string => !!id);
    const { data: _inventoryMap = {} } = useInventoryBatch(productIds);

    // Dynamic Categories
    const uniqueCategories = Array.from(new Set(allProducts.map((p) => p.category))).filter((c): c is string => !!c);

    // Icon Mapping Helper
    const getCategoryIcon = (category: string) => {
        const lower = category.toLowerCase();
        if (lower.includes('flower')) return Leaf;
        if (lower.includes('edible')) return Cookie;
        if (lower.includes('pre-roll')) return Cigarette;
        if (lower.includes('concentrate') || lower.includes('extract')) return Droplets;
        if (lower.includes('vape') || lower.includes('cart')) return Wind;
        return Leaf; // Default
    };

    const categories = uniqueCategories.map(cat => ({
        key: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        icon: getCategoryIcon(cat),
        desc: "" // Could map descriptions if needed
    }));

    // Apply category filter from section config
    let filteredProducts: LocalProduct[] = category_filter && category_filter !== 'all'
        ? allProducts.filter((p) => (p.category ?? '').toLowerCase() === category_filter.toLowerCase())
        : allProducts;

    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter((p) =>
            (p.name ?? '').toLowerCase().includes(query) ||
            (p.description ?? '').toLowerCase().includes(query)
        );
    }

    if (premiumFilter) {
        filteredProducts = filteredProducts.filter((p) => {
            const price = p.price ?? 0;
            return price >= 40 || p.description?.toLowerCase().includes('premium');
        });
    }

    // Apply sort order: user selection overrides admin default
    const activeSortOrder = userSort === 'default' ? sort_order : userSort;
    filteredProducts = [...filteredProducts].sort((a, b) => {
        switch (activeSortOrder) {
            case 'price_asc': return (a.price ?? 0) - (b.price ?? 0);
            case 'price_desc': return (b.price ?? 0) - (a.price ?? 0);
            case 'name_asc': return (a.name ?? '').localeCompare(b.name ?? '');
            case 'name_desc': return (b.name ?? '').localeCompare(a.name ?? '');
            case 'newest':
            default: return 0; // Keep original order (newest from DB)
        }
    });

    // Apply max products limit
    const limitedProducts = filteredProducts.slice(0, max_products);

    // Grid column class mapping
    const gridColsClass = columns === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : columns === 3
            ? 'grid-cols-2 md:grid-cols-3'
            : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';


    return (
        <section className="py-16 md:py-32 overflow-hidden" style={{ backgroundColor: background_color, color: text_color }}>
            <div className="container px-4 mx-auto max-w-full">
                <div className="text-center space-y-4 md:space-y-6 mb-12 md:mb-20">
                    <h2 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-wider">{heading}</h2>
                    <p className="text-lg md:text-2xl max-w-3xl mx-auto font-medium opacity-70">
                        {subheading}
                    </p>
                </div>

                {show_search && (
                    <div className="max-w-2xl mx-auto mb-12">
                        <label htmlFor="product-grid-search" className="sr-only">Search products</label>
                        <input
                            id="product-grid-search"
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 rounded-full border border-neutral-200 focus-visible:outline-none focus-visible:ring-2"
                            style={{ borderColor: `${text_color}20`, backgroundColor: `${text_color}05` }}
                        />
                    </div>
                )}

                {show_premium_filter && (
                    <div className="flex justify-center mb-8">
                        <Button
                            variant={premiumFilter ? "default" : "outline"}
                            onClick={() => setPremiumFilter(!premiumFilter)}
                            className={premiumFilter ? "text-white" : ""}
                            style={{
                                backgroundColor: premiumFilter ? accent_color : 'transparent',
                                borderColor: premiumFilter ? accent_color : `${text_color}30`,
                                color: premiumFilter ? '#ffffff' : text_color
                            }}
                        >
                            {premiumFilter ? "✓ Premium Only" : "Show Premium Only"}
                        </Button>
                    </div>
                )}

                {/* Sort & View Toggle Toolbar */}
                {allProducts.length > 0 && (
                    <div className="flex items-center justify-between gap-4 mb-8">
                        <p className="text-sm font-medium opacity-60 hidden sm:block">
                            {limitedProducts.length} product{limitedProducts.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center gap-2 ml-auto">
                            <ArrowUpDown className="w-4 h-4 opacity-50 hidden sm:block" />
                            <Select value={userSort} onValueChange={(val) => setUserSort(val as SortOption)}>
                                <SelectTrigger className="w-[180px] h-9 text-sm" style={{ borderColor: `${text_color}20` }}>
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1 border rounded-lg p-1" style={{ borderColor: `${text_color}20` }}>
                                <Button
                                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setViewMode('grid')}
                                    aria-label="Grid view"
                                >
                                    <Grid3X3 className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setViewMode('list')}
                                    aria-label="List view"
                                >
                                    <List className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent_color }} />
                    </div>
                ) : error ? (
                    <div className="text-center py-20">
                        <p>Unable to load products.</p>
                    </div>
                ) : allProducts.length === 0 ? (
                    <div className="text-center py-20" data-testid="empty-product-grid">
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-40" style={{ color: text_color }} />
                        <h3 className="text-xl font-semibold mb-2 opacity-70">Coming soon</h3>
                        <p className="opacity-50">Check back soon for new arrivals</p>
                    </div>
                ) : limitedProducts.length === 0 ? (
                    <div className="text-center py-20 opacity-50">
                        <p>No products match your search.</p>
                    </div>
                ) : viewMode === 'list' ? (
                    /* ── List View ──────────────────────────────────────── */
                    <div className="space-y-12 md:space-y-16">
                        {categories
                            .slice(0, showAllCategories ? categories.length : (initial_categories_shown || 2))
                            .map((category) => {
                                const products = limitedProducts.filter(p => p.category === category.key);
                                if (products.length === 0) return null;

                                const Icon = category.icon;

                                return (
                                    <div key={category.key} className="space-y-4 md:space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accent_color}1a` }}>
                                                <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: accent_color }} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl md:text-3xl font-bold">{category.label}</h3>
                                                {category.desc && <p className="text-sm opacity-70">{category.desc}</p>}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {products.map((product) => (
                                                <ProductGridListItem
                                                    key={product.id}
                                                    product={product}
                                                    accentColor={accent_color}
                                                    onQuickAdd={(e) => handleQuickAdd(e, { ...product, id: product.id || '' })}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        {!showAllCategories && categories.length > (initial_categories_shown || 2) && (
                            <div className="flex justify-center pt-8">
                                <Button size="lg" onClick={() => setShowAllCategories(true)}>Show More Categories</Button>
                            </div>
                        )}
                        {show_view_all_link && filteredProducts.length > max_products && (
                            <div className="flex justify-center pt-8">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    style={{ borderColor: accent_color, color: accent_color }}
                                >
                                    View All Products
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Grid View (default) ───────────────────────────── */
                    <div className="space-y-12 md:space-y-16">
                        {categories
                            .slice(0, showAllCategories ? categories.length : (initial_categories_shown || 2))
                            .map((category) => {
                                const products = limitedProducts.filter(p => p.category === category.key);
                                if (products.length === 0) return null;

                                const Icon = category.icon;

                                return (
                                    <div key={category.key} className="space-y-4 md:space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accent_color}1a` }}>
                                                <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: accent_color }} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl md:text-3xl font-bold">{category.label}</h3>
                                                {category.desc && <p className="text-sm opacity-70">{category.desc}</p>}
                                            </div>
                                        </div>

                                        <div className={`grid ${gridColsClass} gap-3 md:gap-6`}>
                                            {products.map((product, index) => (
                                                <div key={product.id || index} className="h-full">
                                                    <StorefrontProductCard
                                                        product={{
                                                            product_id: product.id ?? '',
                                                            product_name: product.name ?? '',
                                                            category: product.category ?? '',
                                                            strain_type: product.strain_type ?? '',
                                                            price: Number(product.price) || 0,
                                                            description: product.description ?? '',
                                                            image_url: product.images?.[0] || null,
                                                            images: product.images ?? [],
                                                            thc_content: null,
                                                            cbd_content: null,
                                                            is_visible: true,
                                                            display_order: 0,
                                                            stock_quantity: product.in_stock ? 100 : 0
                                                        }}
                                                        storeSlug=""
                                                        isPreviewMode={false}
                                                        onQuickAdd={(e) => handleQuickAdd(e, { ...product, id: product.id || '' })}
                                                        isAdded={false}
                                                        onToggleWishlist={() => { }}
                                                        isInWishlist={false}
                                                        onQuickView={() => { }}
                                                        index={index}
                                                        accentColor={accent_color}
                                                        showSaleBadge={show_sale_badges}
                                                        showNewBadge={show_new_badges}
                                                        showStrainBadge={show_strain_badges}
                                                        showStockWarning={show_stock_warnings}
                                                    />
                                                </div>
                                            ))}
                                                {products.map((product, index) => (
                                                    <div key={product.id || index}>
                                                        <StorefrontProductCard
                                                            product={{
                                                                product_id: product.id ?? '',
                                                                product_name: product.name ?? '',
                                                                category: product.category ?? '',
                                                                strain_type: product.strain_type ?? '',
                                                                price: Number(product.price) || 0,
                                                                description: product.description ?? '',
                                                                image_url: product.images?.[0] || null,
                                                                images: product.images ?? [],
                                                                thc_content: null,
                                                                cbd_content: null,
                                                                is_visible: true,
                                                                display_order: 0,
                                                                stock_quantity: product.in_stock ? 100 : 0
                                                            }}
                                                            storeSlug={storeSlug}
                                                            isPreviewMode={false}
                                                            onQuickAdd={(e) => handleQuickAdd(e, { ...product, id: product.id || '' })}
                                                            isAdded={false}
                                                            onToggleWishlist={() => { }}
                                                            isInWishlist={false}
                                                            onQuickView={() => { }}
                                                            index={index}
                                                            accentColor={accent_color}
                                                            showSaleBadge={show_sale_badges}
                                                            showNewBadge={show_new_badges}
                                                            showStrainBadge={show_strain_badges}
                                                            showStockWarning={show_stock_warnings}
                                                        />
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                );
                            })}
                        {!showAllCategories && categories.length > (initial_categories_shown || 2) && (
                            <div className="flex justify-center pt-8">
                                <Button size="lg" onClick={() => setShowAllCategories(true)}>Show More Categories</Button>
                            </div>
                        )}
                        {show_view_all_link && filteredProducts.length > max_products && (
                            <div className="flex justify-center pt-8">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    style={{ borderColor: accent_color, color: accent_color }}
                                >
                                    View All Products
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

/* ── List Item for List View ─────────────────────────────────────────────── */

interface ProductGridListItemProps {
    product: LocalProduct;
    accentColor: string;
    onQuickAdd: (e: React.MouseEvent) => void;
}

function ProductGridListItem({ product, accentColor, onQuickAdd }: ProductGridListItemProps) {
    const isOutStock = product.in_stock === false;

    return (
        <Card className="flex overflow-hidden hover:shadow-lg transition-shadow">
            <div className="w-24 h-24 md:w-36 md:h-36 flex-shrink-0 bg-neutral-50">
                <ProductImage
                    src={product.images?.[0]}
                    alt={product.name ?? ''}
                    className="w-full h-full object-cover"
                />
            </div>
            <CardContent className="flex-1 p-3 md:p-4 flex flex-col justify-between min-w-0">
                <div>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                        {product.category}
                    </p>
                    <h3 className="font-bold text-sm md:text-base line-clamp-1" style={{ color: accentColor }}>
                        {product.name}
                    </h3>
                    {product.description && (
                        <p className="text-xs text-neutral-500 line-clamp-2 mt-1 hidden sm:block">
                            {product.description}
                        </p>
                    )}
                </div>
                <div className="flex items-center justify-between mt-2">
                    <span className="text-base md:text-lg font-extrabold" style={{ color: accentColor }}>
                        {formatCurrency(product.price)}
                    </span>
                    <Button
                        size="sm"
                        className="rounded-full h-8 px-4 text-xs font-bold text-white"
                        style={{ backgroundColor: accentColor }}
                        onClick={onQuickAdd}
                        disabled={isOutStock}
                    >
                        {isOutStock ? 'Sold Out' : 'Add'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

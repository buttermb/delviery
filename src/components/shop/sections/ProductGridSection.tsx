
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Leaf, Cookie, Cigarette, Droplets, Wind, ChevronRight, ChevronLeft, AlertTriangle, LucideIcon } from "lucide-react";
import { useInventoryBatch } from "@/hooks/useInventoryBatch";
import { useIsMobile } from "@/hooks/use-mobile";
// Actually ProductCatalog imported MobileSearch from "./MobileSearch" which was in same dir. I need to check where that is or use simple input.
// Note: MobileSearch is likely just a wrapper around Input.

export interface ProductGridSectionProps {
    content: {
        heading: string;
        subheading: string;
        show_search: boolean;
        show_categories: boolean;
        initial_categories_shown: number;
        show_premium_filter: boolean;
    };
    styles: {
        background_color: string;
        text_color: string;
        accent_color: string;
    };
    storeId?: string;
}

export function ProductGridSection({ content, styles, storeId }: ProductGridSectionProps) {
    const {
        heading = "Shop Premium Flower",
        subheading = "Premium indoor-grown flower from licensed NYC cultivators",
        show_search = true,
        show_categories = true,
        initial_categories_shown = 2,
        show_premium_filter = true
    } = content || {};

    const {
        background_color = "#f4f4f5", // zinc-100/muted
        text_color = "#000000",
        accent_color = "#10b981" // emerald-500
    } = styles || {};

    const queryClient = useQueryClient();
    const [showAllCategories, setShowAllCategories] = useState(false);
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState("");
    const [premiumFilter, setPremiumFilter] = useState(false);

    // Fetch products
    const { data: allProducts = [], isLoading, error } = useQuery<any[]>({
        queryKey: ["products", storeId],
        queryFn: async () => {
            if (storeId) {
                // Public Storefront View - try RPC first, fallback to direct query
                try {
                    const { data, error } = await (supabase as any)
                        .rpc('get_marketplace_products', { p_store_id: storeId });

                    if (error) {
                        // RPC might not exist, fallback to direct query
                        console.warn('RPC get_marketplace_products failed, using fallback:', error.message);
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
                        
                        return ((fallbackData as any[]) || []).map((item: any) => ({
                            ...item.products,
                            id: item.product_id,
                            price: item.custom_price || item.products?.price || 0,
                            images: item.products?.images || [],
                        }));
                    }

                    // Normalize RPC data to match Product interface
                    return ((data as any[]) || []).map((p: any) => ({
                        ...p,
                        id: p.product_id || p.id,
                        name: p.product_name || p.name,
                        price: p.base_price || p.price || 0,
                        description: p.description,
                        images: p.images || [],
                        category: p.category,
                        in_stock: (p.quantity_available || 0) > 0,
                        vendor_name: ''
                    }));
                } catch (err) {
                    console.error('Error fetching marketplace products:', err);
                    return [];
                }
            } else {
                // Admin Builder Preview (uses generic products)
                const { data, error } = await supabase
                    .from("products")
                    .select("*")
                    .eq("in_stock", true)
                    .limit(20);
                if (error) throw error;
                return (data || []) as any[];
            }
        },
        retry: 1,
    });

    const productIds = allProducts.map(p => p.id);
    const { data: inventoryMap = {} } = useInventoryBatch(productIds);

    // Dynamic Categories
    const uniqueCategories = Array.from(new Set(allProducts.map((p: any) => p.category))).filter((c): c is string => !!c);

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

    let filteredProducts = searchQuery
        ? allProducts.filter((p) => {
            const query = searchQuery.toLowerCase();
            return (
                p.name?.toLowerCase().includes(query) ||
                p.description?.toLowerCase().includes(query)
            );
        })
        : allProducts;

    if (premiumFilter) {
        filteredProducts = filteredProducts.filter((p) => {
            const price = typeof p.price === 'number' ? p.price : parseFloat(p.price);
            return price >= 40 || p.description?.toLowerCase().includes('premium');
        });
    }

    const scrollContainerRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const scroll = (categoryKey: string, direction: 'left' | 'right') => {
        const container = scrollContainerRef.current[categoryKey];
        if (!container) return;
        const scrollAmount = direction === 'left' ? -400 : 400;
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    };

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
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 rounded-full border border-neutral-200 focus:outline-none focus:ring-2"
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

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent_color }} />
                    </div>
                ) : error ? (
                    <div className="text-center py-20">
                        <p>Unable to load products.</p>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="text-center py-20 opacity-50">
                        <p>No products found in this collection.</p>
                    </div>
                ) : (
                    <div className="space-y-12 md:space-y-16">
                        {categories
                            .slice(0, showAllCategories ? categories.length : (initial_categories_shown || 2))
                            .map((category) => {
                                const products = filteredProducts.filter(p => p.category === category.key);
                                if (products.length === 0) return null;

                                const Icon = category.icon;

                                return (
                                    <div key={category.key} className="space-y-4 md:space-y-6">
                                        {/* Category Header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accent_color}1a` }}>
                                                    <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: accent_color }} />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl md:text-3xl font-bold">{category.label}</h3>
                                                    {category.desc && <p className="text-sm opacity-70">{category.desc}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="icon" onClick={() => scroll(category.key, 'left')} className="rounded-full hidden md:flex">
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" onClick={() => scroll(category.key, 'right')} className="rounded-full hidden md:flex">
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Horizontal Scrollable Row */}
                                        <div className="relative group">
                                            <div
                                                ref={(el) => scrollContainerRef.current[category.key] = el}
                                                className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4 px-4 md:px-0"
                                            >
                                                {products.map((product) => (
                                                    <div key={product.id} className="w-[280px] md:w-[320px] flex-shrink-0">
                                                        {/* Simplified Card for Grid Preview */}
                                                        <div className="rounded-xl overflow-hidden border bg-white shadow-sm h-full flex flex-col">
                                                            <div className="aspect-square bg-neutral-100 relative">
                                                                {(product.images && product.images[0]) ? (
                                                                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-neutral-300">No Image</div>
                                                                )}
                                                            </div>
                                                            <div className="p-4 flex-1 flex flex-col">
                                                                <h4 className="font-bold text-lg mb-1 line-clamp-1 text-black">{product.name}</h4>
                                                                <p className="text-sm text-neutral-500 mb-2">{product.strain_name || product.category || 'Product'}</p>
                                                                <div className="mt-auto flex justify-between items-center">
                                                                    <span className="font-semibold text-black">${Number(product.price).toFixed(2)}</span>
                                                                    <Button size="sm" style={{ backgroundColor: accent_color }}>Add</Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        {!showAllCategories && categories.length > (initial_categories_shown || 2) && (
                            <div className="flex justify-center pt-8">
                                <Button size="lg" onClick={() => setShowAllCategories(true)}>Show More Categories</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

/**
 * Product Catalog Page
 * Browse all products with search and filters
 */

import { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Package,
  Filter,
  Grid3X3,
  List,
  X,
  SlidersHorizontal,
  RefreshCw,
  Eye
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FilterDrawer, FilterTriggerButton, type FilterState } from '@/components/shop/FilterDrawer';
import { WishlistButton } from '@/components/shop/WishlistButton';
import { useWishlist } from '@/hooks/useWishlist';
import { ProductQuickViewModal } from '@/components/shop/ProductQuickViewModal';
import { EnhancedPriceSlider } from '@/components/shop/EnhancedPriceSlider';
import { EnhancedPriceSlider } from '@/components/shop/EnhancedPriceSlider';
import { StockWarning } from '@/components/shop/StockWarning';
import { useShopCart } from '@/hooks/useShopCart';
import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';
import { useToast } from '@/hooks/use-toast';

interface RpcProduct {
  product_id: string;
  product_name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  sku: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  images: string[] | null;
  is_featured: boolean;
  is_on_sale: boolean;
  stock_quantity: number;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  sort_order: number;
  created_at: string;
}

interface ProductWithSettings {
  product_id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  category: string | null;
  price: number;
  display_price: number;
  compare_at_price: number | null;
  image_url: string | null;
  images: string[];
  in_stock: boolean;
  is_featured: boolean;
  marketplace_category_id: string | null;
  marketplace_category_name: string | null;
  tags: string[];
  // New fields from RPC
  brand: string | null;
  sku: string | null;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
}

// Transform RPC response to component interface
function transformProduct(rpc: RpcProduct): ProductWithSettings {
  return {
    product_id: rpc.product_id,
    name: rpc.product_name,
    description: rpc.description,
    short_description: rpc.description?.substring(0, 150) || null,
    category: rpc.category,
    price: rpc.price,
    display_price: rpc.sale_price || rpc.price,
    compare_at_price: rpc.sale_price ? rpc.price : null,
    image_url: rpc.image_url,
    images: rpc.images || [],
    in_stock: rpc.stock_quantity > 0,
    is_featured: rpc.is_featured,
    marketplace_category_id: null,
    marketplace_category_name: rpc.category,
    tags: [],
    brand: rpc.brand,
    sku: rpc.sku,
    strain_type: rpc.strain_type,
    thc_content: rpc.thc_content,
    cbd_content: rpc.cbd_content,
  };
}

export default function ProductCatalogPage() {
  const { storeSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { store } = useShop();
  const { isLuxuryTheme, accentColor, cardBg, cardBorder, textMuted } = useLuxuryTheme();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'name');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [quickViewProductId, setQuickViewProductId] = useState<string | null>(null);

  // Wishlist integration
  const { items: wishlistItems, toggleItem: toggleWishlist, isInWishlist } = useWishlist({ storeId: store?.id });
  const { toast } = useToast();
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Cart integration for Quick Add
  const { addItem, cartItems } = useShopCart({
    storeId: store?.id,
    onCartChange: () => { },
  });

  const handleQuickAdd = (e: React.MouseEvent, product: ProductWithSettings) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      addItem({
        productId: product.product_id,
        name: product.name,
        price: product.display_price,
        imageUrl: product.image_url,
        quantity: 1,
        variant: product.strain_type || undefined,
        metrcRetailId: undefined, // Not available in ProductWithSettings, defaulting
        excludeFromDiscounts: false,
      });

      setAddedProducts(prev => new Set(prev).add(product.product_id));
      toast({ title: "Added to cart", duration: 2000 });

      setTimeout(() => {
        setAddedProducts(prev => {
          const next = new Set(prev);
          next.delete(product.product_id);
          return next;
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Failed to add",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Helper to map ProductWithSettings to MarketplaceProduct
  const mapToMarketplaceProduct = (p: ProductWithSettings): MarketplaceProduct => ({
    product_id: p.product_id,
    product_name: p.name,
    category: p.marketplace_category_name || p.category || 'Uncategorized',
    strain_type: p.strain_type || '', // Default to empty string if null
    price: p.display_price,
    description: p.description || '',
    image_url: p.image_url,
    images: p.images,
    thc_content: p.thc_content,
    cbd_content: p.cbd_content,
    is_visible: true,
    display_order: 0,
    stock_quantity: p.in_stock ? 100 : 0, // Mock stock if boolean is used
    unit_type: undefined // Not in ProductWithSettings
  });

  // Fetch products with error handling
  const { data: products = [], isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useQuery({
    queryKey: ['shop-products', store?.id],
    queryFn: async () => {
      logger.info('ProductCatalogPage: Fetching products', { storeId: store?.id, type: typeof store?.id });

      if (!store?.id) {
        logger.warn('ProductCatalogPage: No storeId available');
        return [];
      }

      // Validation
      if (store.id.length < 32) {
        logger.warn('ProductCatalogPage: Invalid storeId format', { storeId: store.id });
        return [];
      }

      try {
        const { data, error } = await supabase
          .rpc('get_marketplace_products', { p_store_id: store.id });

        // Handle missing RPC function gracefully
        if (error) {
          if (error.code === 'PGRST202' || error.message?.includes('does not exist') || error.code === '42883') {
            logger.warn('get_marketplace_products RPC not found or signature mismatch', { storeId: store.id, error });
            return [];
          }
          if (error.code === '22P02') { // Invalid text representation
            logger.warn('ProductCatalogPage: Invalid UUID input', { storeId: store.id });
            return [];
          }
          logger.error('Products fetch failed', error, { storeId: store.id });
          throw error;
        }
        return (data || []).map((item: RpcProduct) => transformProduct(item));
      } catch (err) {
        logger.error('Error fetching products', err, { storeId: store.id });
        throw err;
      }
    },
    enabled: !!store?.id,
    retry: 1,
  });

  // Fetch categories with error handling
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: ['shop-categories', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];

      try {
        const { data, error } = await supabase
          .from('marketplace_categories')
          .select('*')
          .eq('store_id', store.id)
          .eq('is_active', true)
          .order('display_order');

        if (error) {
          logger.error('Categories fetch failed', error, { storeId: store.id });
          throw error;
        }
        return data;
      } catch (err) {
        logger.error('Error fetching categories', err);
        return [];
      }
    },
    enabled: !!store?.id,
    retry: 2,
  });

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory) {
      result = result.filter(
        (p) =>
          p.marketplace_category_name === selectedCategory ||
          p.category === selectedCategory
      );
    }

    // In-stock filter
    if (inStockOnly) {
      result = result.filter((p) => p.in_stock);
    }

    // Price range filter
    result = result.filter(
      (p) => p.display_price >= priceRange[0] && p.display_price <= priceRange[1]
    );

    // Sort
    switch (sortBy) {
      case 'price_asc':
        result.sort((a, b) => a.display_price - b.display_price);
        break;
      case 'price_desc':
        result.sort((a, b) => b.display_price - a.display_price);
        break;
      case 'name':
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [products, searchQuery, selectedCategory, inStockOnly, priceRange, sortBy]);

  // Get unique categories from products
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.marketplace_category_name) cats.add(p.marketplace_category_name);
      else if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setInStockOnly(false);
    setPriceRange([0, 1000]);
    setSortBy('name');
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || selectedCategory || inStockOnly;

  if (!store) return null;

  // Filter state for FilterDrawer
  const filterState: FilterState = {
    categories: selectedCategory ? [selectedCategory] : [],
    strainTypes: [],
    priceRange,
    sortBy,
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setSelectedCategory(newFilters.categories[0] || '');
    setPriceRange(newFilters.priceRange);
    setSortBy(newFilters.sortBy);
  };

  // Get unique strain types from products
  const strainTypes = useMemo(() => {
    const types = new Set<string>();
    products.forEach((p) => {
      if (p.strain_type) types.add(p.strain_type);
    });
    return Array.from(types).sort();
  }, [products]);

  // Calculate max price from products
  const maxPrice = useMemo(() => {
    return Math.max(...products.map((p) => p.display_price), 1000);
  }, [products]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* FilterDrawer */}
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filterState}
        onFiltersChange={handleFiltersChange}
        availableCategories={productCategories}
        availableStrainTypes={strainTypes}
        maxPrice={maxPrice}
        accentColor={store.primary_color}
      />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">All Products</h1>
        <p className="text-muted-foreground">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Filter */}
        <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {productCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name A-Z</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced Filter Button */}
        <FilterTriggerButton
          onClick={() => setFilterDrawerOpen(true)}
          activeCount={selectedCategory || inStockOnly ? 1 : 0}
          className="md:hidden"
        />

        {/* View Toggle */}
        <div className="hidden md:flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-6">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => setSearchQuery('')}
              />
            </Badge>
          )}
          {selectedCategory && (
            <Badge variant="secondary" className="gap-1">
              {selectedCategory}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => setSelectedCategory('')}
              />
            </Badge>
          )}
          {inStockOnly && (
            <Badge variant="secondary" className="gap-1">
              In Stock
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => setInStockOnly(false)}
              />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear All
          </Button>
        </div>
      )}

      {/* Products Grid/List */}
      {productsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : productsError ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Unable to load products</h2>
          <p className="text-muted-foreground mb-4">
            There was a problem loading the products. Please try again.
          </p>
          <Button onClick={() => refetchProducts()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No products found</h2>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search or filters
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <StorefrontProductCard
              key={product.product_id}
              product={mapToMarketplaceProduct(product)}
              storeSlug={storeSlug!}
              isPreviewMode={false}
              onQuickAdd={(e) => handleQuickAdd(e, product)}
              isAdded={addedProducts.has(product.product_id)}
              onToggleWishlist={() => toggleWishlist({
                productId: product.product_id,
                name: product.name,
                price: product.display_price,
                imageUrl: product.image_url,
              })}
              isInWishlist={isInWishlist(product.product_id)}
              onQuickView={() => setQuickViewProductId(product.product_id)}
              index={0} // No staggered delay for grid here to avoid mass re-render complexity
              accentColor={store.primary_color}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <ProductListItem
              key={product.product_id}
              product={product}
              storeSlug={storeSlug!}
              primaryColor={store.primary_color}
            />
          ))}
        </div>
      )}

      {/* Quick View Modal */}
      <ProductQuickViewModal
        productId={quickViewProductId}
        isOpen={!!quickViewProductId}
        onClose={() => setQuickViewProductId(null)}
      />
    </div>
  );
}

// Product Card Component (Grid View) - Legacy component removed, replaced by shared StorefrontProductCard


// Product List Item Component (List View)
function ProductListItem({
  product,
  storeSlug,
  primaryColor,
}: {
  product: ProductWithSettings;
  storeSlug: string;
  primaryColor: string;
}) {
  const hasDiscount =
    product.compare_at_price && product.compare_at_price > product.display_price;

  return (
    <Link to={`/shop/${storeSlug}/products/${product.product_id}`}>
      <Card className="flex overflow-hidden hover:shadow-lg transition-shadow">
        <div className="w-32 md:w-48 flex-shrink-0 bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
        </div>
        <CardContent className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {product.marketplace_category_name || product.category}
            </p>
            <h3 className="font-semibold mb-2">{product.name}</h3>
            {product.short_description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {product.short_description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: primaryColor }}>
                {formatCurrency(product.display_price)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(product.compare_at_price!)}
                </span>
              )}
            </div>
            {!product.in_stock && (
              <Badge variant="secondary">Out of Stock</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}






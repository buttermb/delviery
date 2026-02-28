/**
 * Product Catalog Page
 * Browse all products with search and filters
 * Includes real-time inventory syncing for stock updates
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Package,
  Grid3X3,
  List,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';
import { SearchInput } from '@/components/shared/SearchInput';
import { FilterDrawer, FilterTriggerButton, type FilterState } from '@/components/shop/FilterDrawer';
import { useWishlist } from '@/hooks/useWishlist';
import { ProductQuickViewModal } from '@/components/shop/ProductQuickViewModal';
import { useShopCart } from '@/hooks/useShopCart';
import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';
import { toast } from 'sonner';
import { useStorefrontInventorySync } from '@/hooks/useStorefrontInventorySync';

/**
 * RPC Product Response from get_marketplace_products
 * Based on migration 20260112000001_fix_rpc_product_settings.sql
 */
interface RpcProduct {
  product_id: string;
  product_name: string;
  category: string | null;
  strain_type: string | null;
  price: number;
  sale_price: number | null;
  description: string | null;
  image_url: string | null;
  images: string[] | null;
  thc_content: number | null;
  cbd_content: number | null;
  is_visible: boolean;
  display_order: number;
  stock_quantity: number;
  metrc_retail_id: string | null;
  exclude_from_discounts: boolean;
  minimum_price: number | null;
  effects: string[] | null;
  slug: string | null;
  min_expiry_days: number | null;
  unit_type: string | null;
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
  // Cannabis-specific fields
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  effects: string[] | null;
  // Inventory fields
  stock_quantity: number;
  metrc_retail_id: string | null;
  exclude_from_discounts: boolean;
  minimum_price: number | null;
  min_expiry_days: number | null;
  unit_type: string | null;
  brand?: string | null;
  slug: string | null;
}

const ITEMS_PER_PAGE = 24;

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
    images: rpc.images ?? [],
    in_stock: rpc.stock_quantity > 0,
    is_featured: rpc.display_order === 0, // First items are featured
    marketplace_category_id: null,
    marketplace_category_name: rpc.category,
    tags: [],
    strain_type: rpc.strain_type,
    thc_content: rpc.thc_content,
    cbd_content: rpc.cbd_content,
    effects: rpc.effects,
    // Inventory data for real-time sync
    stock_quantity: rpc.stock_quantity,
    metrc_retail_id: rpc.metrc_retail_id,
    exclude_from_discounts: rpc.exclude_from_discounts ?? false,
    minimum_price: rpc.minimum_price,
    min_expiry_days: rpc.min_expiry_days,
    unit_type: rpc.unit_type,
    slug: rpc.slug,
  };
}

export function ProductCatalogPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { store } = useShop();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'name');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') ?? '');
  const [selectedStrainTypes, setSelectedStrainTypes] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [thcRange, setThcRange] = useState<[number, number]>([0, 100]);
  const [cbdRange, setCbdRange] = useState<[number, number]>([0, 100]);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [quickViewProductId, setQuickViewProductId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Wishlist integration
  const { toggleItem: toggleWishlist, isInWishlist } = useWishlist({ storeId: store?.id });
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Cart integration for Quick Add
  const { addItem } = useShopCart({
    storeId: store?.id,
    onCartChange: () => { },
  });

  const handleQuickAdd = (e: React.MouseEvent, product: ProductWithSettings) => {
    e.preventDefault();
    e.stopPropagation();

    // Check stock before adding
    if (product.stock_quantity <= 0) {
      toast.error('Out of Stock', {
        description: `${product.name} is currently unavailable.`,
      });
      return;
    }

    try {
      addItem({
        productId: product.product_id,
        name: product.name,
        price: product.display_price,
        imageUrl: product.image_url,
        quantity: 1,
        variant: product.strain_type || undefined,
        metrcRetailId: product.metrc_retail_id || undefined,
        excludeFromDiscounts: product.exclude_from_discounts,
        minimumPrice: product.minimum_price ?? undefined,
        minExpiryDays: product.min_expiry_days ?? undefined,
      });

      setAddedProducts(prev => new Set(prev).add(product.product_id));
      toast.success('Added to cart');

      setTimeout(() => {
        setAddedProducts(prev => {
          const next = new Set(prev);
          next.delete(product.product_id);
          return next;
        });
      }, 2000);
    } catch (error) {
      toast.error('Failed to add', { description: humanizeError(error) });
    }
  };

  // Real-time inventory sync for live stock updates
  useStorefrontInventorySync({
    storeId: store?.id,
    tenantId: store?.tenant_id,
    enabled: !!store?.id,
    showNotifications: true,
  });

  // Helper to map ProductWithSettings to MarketplaceProduct
  const mapToMarketplaceProduct = (p: ProductWithSettings): MarketplaceProduct => ({
    product_id: p.product_id,
    product_name: p.name,
    category: p.marketplace_category_name || p.category || 'Uncategorized',
    strain_type: p.strain_type ?? '',
    price: p.price,
    sale_price: p.compare_at_price ? p.display_price : undefined,
    description: p.description ?? '',
    image_url: p.image_url,
    images: p.images,
    thc_content: p.thc_content,
    cbd_content: p.cbd_content,
    is_visible: true,
    display_order: 0,
    stock_quantity: p.stock_quantity,
    unit_type: p.unit_type || undefined,
    metrc_retail_id: p.metrc_retail_id || undefined,
    exclude_from_discounts: p.exclude_from_discounts,
    minimum_price: p.minimum_price ?? undefined,
    min_expiry_days: p.min_expiry_days ?? undefined,
    effects: p.effects ?? undefined,
  });

  // Fetch products with error handling
  const { data: products = [], isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useQuery({
    queryKey: queryKeys.shopProducts.list(store?.id),
    queryFn: async () => {
      if (!store?.id) return [];

      const { data, error } = await supabase
        .rpc('get_marketplace_products', { p_store_id: store.id });

      // Handle missing RPC function gracefully
      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('does not exist') || error.code === '42883') {
          logger.warn('get_marketplace_products RPC not found or signature mismatch', { storeId: store.id, error });
          return [];
        }
        if (error.code === '22P02') {
          logger.warn('ProductCatalogPage: Invalid UUID input', { storeId: store.id });
          return [];
        }
        logger.error('Products fetch failed', error, { storeId: store.id });
        throw error;
      }
      return (data ?? []).map((item: unknown) => transformProduct(item as RpcProduct));
    },
    enabled: !!store?.id,
    retry: 1,
  });

  // Fetch categories with error handling (needed for cache warming)
  useQuery({
    queryKey: queryKeys.shopProducts.categories(store?.id),
    queryFn: async () => {
      if (!store?.id) return [];

      const { data, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .eq('store_id', store.id)
        .eq('is_active', true)
        .order('display_order');

      if (error) {
        logger.warn('Categories fetch failed', error, { storeId: store.id });
        return [];
      }
      return data ?? [];
    },
    enabled: !!store?.id,
    retry: 1,
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
          p.category?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query) ||
          p.strain_type?.toLowerCase().includes(query)
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

    // Strain type filter
    if (selectedStrainTypes.length > 0) {
      result = result.filter(
        (p) => p.strain_type && selectedStrainTypes.includes(p.strain_type.toLowerCase())
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

    // THC range filter
    if (thcRange[0] > 0 || thcRange[1] < 100) {
      result = result.filter(
        (p) => {
          if (p.thc_content === null) return thcRange[0] === 0;
          return p.thc_content >= thcRange[0] && p.thc_content <= thcRange[1];
        }
      );
    }

    // CBD range filter
    if (cbdRange[0] > 0 || cbdRange[1] < 100) {
      result = result.filter(
        (p) => {
          if (p.cbd_content === null) return cbdRange[0] === 0;
          return p.cbd_content >= cbdRange[0] && p.cbd_content <= cbdRange[1];
        }
      );
    }

    // Sort
    switch (sortBy) {
      case 'price_asc':
        result.sort((a, b) => a.display_price - b.display_price);
        break;
      case 'price_desc':
        result.sort((a, b) => b.display_price - a.display_price);
        break;
      case 'thc_desc':
        result.sort((a, b) => (b.thc_content ?? 0) - (a.thc_content ?? 0));
        break;
      case 'thc_asc':
        result.sort((a, b) => (a.thc_content ?? 0) - (b.thc_content ?? 0));
        break;
      case 'newest':
        // Keep original API order (newest products from DB)
        break;
      case 'name':
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [products, searchQuery, selectedCategory, selectedStrainTypes, inStockOnly, priceRange, thcRange, cbdRange, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStrainTypes, inStockOnly, priceRange, thcRange, cbdRange, sortBy]);

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
    setSelectedStrainTypes([]);
    setInStockOnly(false);
    setPriceRange([0, 1000]);
    setThcRange([0, 100]);
    setCbdRange([0, 100]);
    setSortBy('name');
    setCurrentPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedStrainTypes.length > 0 || inStockOnly || thcRange[0] > 0 || thcRange[1] < 100 || cbdRange[0] > 0 || cbdRange[1] < 100;

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

  if (!store) return null;

  // Filter state for FilterDrawer
  const filterState: FilterState = {
    categories: selectedCategory ? [selectedCategory] : [],
    strainTypes: selectedStrainTypes,
    priceRange,
    sortBy,
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setSelectedCategory(newFilters.categories[0] ?? '');
    setSelectedStrainTypes(newFilters.strainTypes);
    setPriceRange(newFilters.priceRange);
    setSortBy(newFilters.sortBy);
  };

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
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">All Products</h1>
        <p className="text-muted-foreground">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search with debounce and clear button */}
        <SearchInput
          placeholder="Search products..."
          onSearch={handleSearch}
          defaultValue={searchQuery}
          delay={300}
          className="flex-1"
        />

        {/* Mobile: Category + Sort in a 2-col row */}
        <div className="grid grid-cols-2 gap-2 md:contents">
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
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="thc_desc">THC%: High to Low</SelectItem>
              <SelectItem value="thc_asc">THC%: Low to High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile: Strain + Filter button in a 2-col row */}
        <div className="grid grid-cols-2 gap-2 md:contents">
          {/* Strain Type Filter */}
          <Select
            value={selectedStrainTypes[0] || "all"}
            onValueChange={(val) => setSelectedStrainTypes(val === "all" ? [] : [val])}
          >
            <SelectTrigger className="w-full md:w-[160px]">
              <SelectValue placeholder="Strain Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strains</SelectItem>
              <SelectItem value="indica">Indica</SelectItem>
              <SelectItem value="sativa">Sativa</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>

          {/* Advanced Filter Button */}
          <FilterTriggerButton
            onClick={() => setFilterDrawerOpen(true)}
            activeCount={selectedCategory || inStockOnly ? 1 : 0}
            className="md:hidden"
          />
        </div>

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
          {selectedStrainTypes.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {selectedStrainTypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => setSelectedStrainTypes([])}
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
          {(thcRange[0] > 0 || thcRange[1] < 100) && (
            <Badge variant="secondary" className="gap-1">
              THC: {thcRange[0]}%-{thcRange[1]}%
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => setThcRange([0, 100])}
              />
            </Badge>
          )}
          {(cbdRange[0] > 0 || cbdRange[1] < 100) && (
            <Badge variant="secondary" className="gap-1">
              CBD: {cbdRange[0]}%-{cbdRange[1]}%
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => setCbdRange([0, 100])}
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
      ) : products.length === 0 ? (
        <div className="text-center py-16" data-testid="empty-catalog">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No products yet</h2>
          <p className="text-muted-foreground mb-4">
            Check back later.
          </p>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {paginatedProducts.map((product) => (
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
              index={0}
              accentColor={store.primary_color}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedProducts.map((product) => (
            <ProductListItem
              key={product.product_id}
              product={product}
              storeSlug={storeSlug!}
              primaryColor={store.primary_color}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(page => {
              // Show first, last, current, and adjacent pages
              if (page === 1 || page === totalPages) return true;
              if (Math.abs(page - currentPage) <= 1) return true;
              return false;
            })
            .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
              if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                acc.push('ellipsis');
              }
              acc.push(page);
              return acc;
            }, [])
            .map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
              ) : (
                <Button
                  key={item}
                  variant={currentPage === item ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(item)}
                  className="min-w-[36px]"
                >
                  {item}
                </Button>
              )
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
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
              loading="lazy"
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






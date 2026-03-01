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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Package,
  Grid3X3,
  List,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';
import { FilterDrawer, FilterTriggerButton, getActiveFilterCount, type FilterState } from '@/components/shop/FilterDrawer';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { FilterDrawer, FilterTriggerButton, type FilterState } from '@/components/shop/FilterDrawer';
import { useWishlist } from '@/hooks/useWishlist';
import { ProductQuickViewModal } from '@/components/shop/ProductQuickViewModal';
import { useShopCart } from '@/hooks/useShopCart';
import { StorefrontProductCard, type MarketplaceProduct } from '@/components/shop/StorefrontProductCard';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { usePagination } from '@/hooks/usePagination';
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

const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cat = searchParams.get('category');
    return cat ? [cat] : [];
  });
  const [selectedStrainTypes, setSelectedStrainTypes] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [thcRange, setThcRange] = useState<[number, number]>([0, 100]);
  const [cbdRange, setCbdRange] = useState<[number, number]>([0, 100]);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [quickViewProductId, setQuickViewProductId] = useState<string | null>(null);

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

    // Category filter (multi-select)
    if (selectedCategories.length > 0) {
      result = result.filter(
        (p) =>
          selectedCategories.includes(p.marketplace_category_name ?? '') ||
          selectedCategories.includes(p.category ?? '')
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
  }, [products, searchQuery, selectedCategories, selectedStrainTypes, inStockOnly, priceRange, thcRange, cbdRange, sortBy]);

  // Pagination via standardized hook (URL-persisted, page size selector)
  const {
    paginatedItems: paginatedProducts,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    goToPage,
    changePageSize,
    pageSizeOptions,
  } = usePagination(filteredProducts, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    urlKey: 'page',
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategories, selectedStrainTypes, inStockOnly, priceRange, thcRange, cbdRange, sortBy]);
    goToPage(1);
  }, [searchQuery, selectedCategory, selectedStrainTypes, inStockOnly, priceRange, thcRange, cbdRange, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setSelectedCategories([]);
    setSelectedStrainTypes([]);
    setInStockOnly(false);
    setPriceRange([0, 1000]);
    setThcRange([0, 100]);
    setCbdRange([0, 100]);
    setSortBy('name');
    goToPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || selectedCategories.length > 0 || selectedStrainTypes.length > 0 || inStockOnly || thcRange[0] > 0 || thcRange[1] < 100 || cbdRange[0] > 0 || cbdRange[1] < 100;

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
    categories: selectedCategories,
    strainTypes: selectedStrainTypes,
    priceRange,
    sortBy,
    inStockOnly,
    thcRange,
    cbdRange,
  };

  const activeFilterCount = getActiveFilterCount(filterState, maxPrice);

  const handleFiltersChange = (newFilters: FilterState) => {
    setSelectedCategories(newFilters.categories);
    setSelectedStrainTypes(newFilters.strainTypes);
    setPriceRange(newFilters.priceRange);
    setSortBy(newFilters.sortBy);
    if (newFilters.inStockOnly !== undefined) setInStockOnly(newFilters.inStockOnly);
    if (newFilters.thcRange) setThcRange(newFilters.thcRange);
    if (newFilters.cbdRange) setCbdRange(newFilters.cbdRange);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
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
        resultCount={filteredProducts.length}
      />
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold mb-1">All Products</h1>
        <p className="text-sm text-muted-foreground">
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Row 1: Search + Filter trigger (mobile) */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search products"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {/* Mobile filter trigger */}
          <div className="md:hidden">
            <FilterTriggerButton
              onClick={() => setFilterDrawerOpen(true)}
              activeCount={activeFilterCount}
            />
          </div>
        </div>
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search with debounce and clear button */}
        <SearchInput
          placeholder="Search products..."
          onSearch={handleSearch}
          defaultValue={searchQuery}
          delay={300}
          className="flex-1"
        />

        {/* Row 2: Desktop inline filters (hidden on mobile - use drawer instead) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Category Filter (Checkbox Popover) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[180px] justify-between font-normal"
              >
                <span className="truncate">
                  {selectedCategories.length === 0
                    ? 'All Categories'
                    : selectedCategories.length === 1
                      ? selectedCategories[0]
                      : `${selectedCategories.length} categories`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
              <div className="space-y-1 max-h-[240px] overflow-y-auto">
                {productCategories.map((cat) => (
                  <label
                    key={cat}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(cat)}
                      onCheckedChange={() => toggleCategory(cat)}
                    />
                    <span className="truncate">{cat}</span>
                  </label>
                ))}
                {productCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground px-2 py-1">No categories</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
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

          {/* Strain Type Filter */}
          <Select
            value={selectedStrainTypes[0] || "all"}
            onValueChange={(val) => setSelectedStrainTypes(val === "all" ? [] : [val])}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Strain Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strains</SelectItem>
              <SelectItem value="indica">Indica</SelectItem>
              <SelectItem value="sativa">Sativa</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-1 ml-auto">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => setSearchQuery('')}
              />
            </Badge>
          )}
          {selectedCategories.map((cat) => (
            <Badge key={cat} variant="secondary" className="gap-1">
              {cat}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => toggleCategory(cat)}
              />
            </Badge>
          ))}
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4" data-testid="product-catalog-loading">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-950 rounded-3xl border border-neutral-100 dark:border-neutral-800 overflow-hidden shadow-sm h-full flex flex-col">
              {/* Image placeholder */}
              <Skeleton className="aspect-square w-full rounded-none" />
              {/* Content */}
              <div className="p-3 sm:p-5 flex flex-col flex-1 space-y-2">
                <Skeleton className="h-4 sm:h-5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              </div>
              {/* Footer */}
              <div className="px-3 pb-3 sm:px-5 sm:pb-5 flex items-center justify-between border-t border-neutral-50 pt-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-8 w-8 sm:h-10 sm:w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : productsError ? (
        <div className="text-center py-16" data-testid="product-catalog-error">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Unable to load products</h2>
          <p className="text-muted-foreground mb-4">
            There was a problem loading the products. Please try again.
          </p>
          <Button onClick={() => refetchProducts()} data-testid="retry-button">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
        <ErrorState
          title="Unable to load products"
          description="There was a problem loading the products. Please try again."
          onRetry={() => refetchProducts()}
          retryLabel="Try Again"
        />
      ) : products.length === 0 ? (
        <EmptyState
          title="Products coming soon"
          description="Check back later for new arrivals."
          illustration="no-data"
          data-testid="empty-catalog"
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try adjusting your search or filters to find what you're looking for."
          illustration="no-results"
          action={{
            label: "Clear Filters",
            onClick: clearFilters,
            variant: "outline",
          }}
          data-testid="empty-filtered"
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4" data-testid="product-catalog-grid">
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
        <div className="mt-8">
          <StandardPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            pageSizeOptions={pageSizeOptions}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
            showPageSizeSelector={filteredProducts.length > PAGE_SIZE_OPTIONS[0]}
            showItemCount
          />
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






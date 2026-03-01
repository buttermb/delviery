/**
 * Public Store Menu Page
 * /store/:slug/menu - No auth required
 * Full product catalog with filters, search, sort, grid/list toggle, pagination
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Grid3X3,
  List,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Leaf,
  X,
  ChevronDown,
  Plus,
  ArrowUpDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import ProductImage from '@/components/ProductImage';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import StoreNotFound from '@/components/shop/StoreNotFound';

// ── Types ───────────────────────────────────────────────────────────────────

interface StoreData {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  is_active: boolean;
  is_public: boolean;
  theme_config?: {
    theme?: string;
    colors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
    };
  } | null;
}

interface MenuProduct {
  product_id: string;
  product_name: string;
  category: string;
  strain_type: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  description: string | null;
  display_order: number;
  created_at: string;
}

type SortOption = 'name' | 'name-desc' | 'price' | 'price-desc' | 'popularity' | 'newest';
type ViewMode = 'grid' | 'list';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popularity', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'price', label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
];

const STRAIN_TYPES = ['Indica', 'Sativa', 'Hybrid'];
const PAGE_SIZE = 24;

// ── Main Component ──────────────────────────────────────────────────────────

export default function StoreMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // State from URL params for shareability
  const initialCategory = searchParams.get('category') ?? '';
  const initialSearch = searchParams.get('q') ?? '';

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialCategory ? [initialCategory] : []
  );
  const [selectedStrains, setSelectedStrains] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // ── Fetch Store ──────────────────────────────────────────────────────────

  const {
    data: store,
    isLoading: storeLoading,
    error: storeError,
  } = useQuery({
    queryKey: queryKeys.storePages.menu(slug),
    queryFn: async (): Promise<StoreData | null> => {
      if (!slug) return null;

      const { data, error } = await supabase.rpc(
        'get_marketplace_store_by_slug',
        { p_slug: slug }
      );

      if (error) {
        logger.error('Failed to fetch store', error, { component: 'StoreMenuPage' });
        throw error;
      }

      if (!data || !Array.isArray(data) || data.length === 0) return null;
      return data[0] as unknown as StoreData;
    },
    enabled: !!slug,
    retry: false,
    staleTime: 60_000,
  });

  // ── Fetch All Products ──────────────────────────────────────────────────

  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.storePages.menuProducts(store?.tenant_id),
    queryFn: async (): Promise<MenuProduct[]> => {
      if (!store?.tenant_id) return [];

      const { data, error } = await supabase
        .from('products')
        .select(
          'product_id, product_name, category, strain_type, price, sale_price, image_url, thc_content, cbd_content, description, display_order, created_at'
        )
        .eq('tenant_id', store.tenant_id)
        .eq('is_visible', true)
        .order('display_order', { ascending: true });

      if (error) {
        logger.error('Failed to fetch products', error, { component: 'StoreMenuPage' });
        return [];
      }

      return (data ?? []) as unknown as MenuProduct[];
    },
    enabled: !!store?.tenant_id,
    staleTime: 60_000,
  });

  // ── Derived Data ─────────────────────────────────────────────────────────

  const availableCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of allProducts) {
      if (p.category) {
        counts[p.category] = (counts[p.category] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allProducts]);

  const availableStrains = useMemo(() => {
    const strains = new Set<string>();
    for (const p of allProducts) {
      if (p.strain_type) strains.add(p.strain_type);
    }
    return STRAIN_TYPES.filter((s) => strains.has(s));
  }, [allProducts]);

  const maxPrice = useMemo(() => {
    if (allProducts.length === 0) return 1000;
    return Math.ceil(
      Math.max(...allProducts.map((p) => p.sale_price ?? p.price)) / 10
    ) * 10;
  }, [allProducts]);

  // Initialize price range once maxPrice is known
  useEffect(() => {
    setPriceRange((prev) => {
      if (prev[1] === 1000 && maxPrice !== 1000) {
        return [0, maxPrice];
      }
      return prev;
    });
  }, [maxPrice]);

  // ── Filtered & Sorted Products ───────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Search filter
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.strain_type?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      result = result.filter((p) => selectedCategories.includes(p.category));
    }

    // Strain filter
    if (selectedStrains.length > 0) {
      result = result.filter((p) => selectedStrains.includes(p.strain_type));
    }

    // Price range filter
    result = result.filter((p) => {
      const displayPrice = p.sale_price ?? p.price;
      return displayPrice >= priceRange[0] && displayPrice <= priceRange[1];
    });

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.product_name.localeCompare(b.product_name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.product_name.localeCompare(a.product_name));
        break;
      case 'price':
        result.sort((a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price));
        break;
      case 'price-desc':
        result.sort((a, b) => (b.sale_price ?? b.price) - (a.sale_price ?? a.price));
        break;
      case 'newest':
        result.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'popularity':
      default:
        // display_order is the proxy for popularity (lower = more popular)
        result.sort((a, b) => a.display_order - b.display_order);
        break;
    }

    return result;
  }, [allProducts, debouncedSearch, selectedCategories, selectedStrains, priceRange, sortBy]);

  // ── Pagination ────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredProducts, currentPage]
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategories, selectedStrains, priceRange, sortBy]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const toggleStrain = useCallback((strain: string) => {
    setSelectedStrains((prev) =>
      prev.includes(strain) ? prev.filter((s) => s !== strain) : [...prev, strain]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedStrains([]);
    setPriceRange([0, maxPrice]);
    setSearchQuery('');
    setSortBy('popularity');
    setSearchParams({});
  }, [maxPrice, setSearchParams]);

  const activeFilterCount =
    selectedCategories.length +
    selectedStrains.length +
    (priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : 0);

  // SEO: Update page title
  useEffect(() => {
    if (store?.store_name) {
      document.title = `Menu | ${store.store_name}`;
    }
    return () => {
      document.title = 'FloraIQ';
    };
  }, [store?.store_name]);

  const primaryColor =
    store?.theme_config?.colors?.primary || store?.primary_color || '#15803d';
  const accentColor =
    store?.theme_config?.colors?.accent || store?.accent_color || '#10b981';

  // ── Loading ──────────────────────────────────────────────────────────────

  if (storeLoading) {
    return <MenuPageSkeleton />;
  }

  // ── Error / Not Found ────────────────────────────────────────────────────

  if (storeError || !store || !store.is_active) {
    return <StoreNotFound />;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-neutral-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Back */}
            <Link to={`/store/${store.slug}`} className="flex items-center gap-2 shrink-0">
              {store.logo_url ? (
                <OptimizedImage
                  src={store.logo_url}
                  alt={store.store_name}
                  className="h-8 object-contain"
                  priority
                />
              ) : (
                <Leaf className="w-6 h-6" style={{ color: primaryColor }} />
              )}
              <span className="font-bold text-neutral-800 hidden sm:inline">
                {store.store_name}
              </span>
            </Link>

            {/* Search Bar */}
            <div className="flex-1 max-w-xl relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-neutral-50 border-neutral-200 focus-visible:ring-1"
                style={
                  { '--tw-ring-color': primaryColor } as React.CSSProperties
                }
                aria-label="Search products"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-neutral-900'
                    : 'text-neutral-400 hover:text-neutral-600'
                )}
                aria-label="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-white shadow-sm text-neutral-900'
                    : 'text-neutral-400 hover:text-neutral-600'
                )}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* ── Desktop Sidebar Filters ─────────────────────────────────────── */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-20 space-y-6">
              {/* Filter header */}
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-neutral-800 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </h2>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs font-medium hover:underline"
                    style={{ color: primaryColor }}
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Categories */}
              {availableCategories.length > 0 && (
                <FilterSection title="Categories">
                  <div className="space-y-2">
                    {availableCategories.map((cat) => (
                      <label
                        key={cat.name}
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Checkbox
                          checked={selectedCategories.includes(cat.name)}
                          onCheckedChange={() => toggleCategory(cat.name)}
                        />
                        <span className="text-sm text-neutral-600 group-hover:text-neutral-900 flex-1">
                          {cat.name}
                        </span>
                        <span className="text-xs text-neutral-400">{cat.count}</span>
                      </label>
                    ))}
                  </div>
                </FilterSection>
              )}

              {/* Strain Types */}
              {availableStrains.length > 0 && (
                <FilterSection title="Strain Type">
                  <div className="space-y-2">
                    {availableStrains.map((strain) => (
                      <label
                        key={strain}
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Checkbox
                          checked={selectedStrains.includes(strain)}
                          onCheckedChange={() => toggleStrain(strain)}
                        />
                        <span className="text-sm text-neutral-600 group-hover:text-neutral-900 flex items-center gap-2">
                          {strain}
                          <StrainDot strain={strain} />
                        </span>
                      </label>
                    ))}
                  </div>
                </FilterSection>
              )}

              {/* Price Range */}
              <FilterSection title="Price Range">
                <div className="px-1 pt-2 pb-1">
                  <Slider
                    value={priceRange}
                    onValueChange={(val) => setPriceRange(val as [number, number])}
                    min={0}
                    max={maxPrice}
                    step={5}
                    className="mb-3"
                  />
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{formatCurrency(priceRange[0])}</span>
                    <span>{formatCurrency(priceRange[1])}</span>
                  </div>
                </div>
              </FilterSection>
            </div>
          </aside>

          {/* ── Main Content ────────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            {/* Toolbar: Mobile filter, sort, result count */}
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile filter button */}
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg bg-white hover:bg-neutral-50 transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 px-1.5 py-0 text-[10px] h-5"
                      style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </button>

                <p className="text-sm text-neutral-500">
                  <span className="font-medium text-neutral-800">
                    {filteredProducts.length}
                  </span>{' '}
                  {filteredProducts.length === 1 ? 'product' : 'products'}
                </p>
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg bg-white hover:bg-neutral-50 transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                  </span>
                  <span className="sm:hidden">Sort</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showSortDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setShowSortDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-40 py-1">
                      {SORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setShowSortDropdown(false);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm transition-colors',
                            sortBy === option.value
                              ? 'font-medium bg-neutral-50'
                              : 'text-neutral-600 hover:bg-neutral-50'
                          )}
                          style={
                            sortBy === option.value ? { color: primaryColor } : undefined
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Active filter pills */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCategories.map((cat) => (
                  <FilterPill
                    key={`cat-${cat}`}
                    label={cat}
                    onRemove={() => toggleCategory(cat)}
                    color={primaryColor}
                  />
                ))}
                {selectedStrains.map((strain) => (
                  <FilterPill
                    key={`strain-${strain}`}
                    label={strain}
                    onRemove={() => toggleStrain(strain)}
                    color={primaryColor}
                  />
                ))}
                {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
                  <FilterPill
                    label={`${formatCurrency(priceRange[0])} – ${formatCurrency(priceRange[1])}`}
                    onRemove={() => setPriceRange([0, maxPrice])}
                    color={primaryColor}
                  />
                )}
              </div>
            )}

            {/* Product Grid / List */}
            {productsLoading ? (
              <ProductGridSkeleton viewMode={viewMode} />
            ) : paginatedProducts.length > 0 ? (
              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4'
                    : 'space-y-3'
                )}
              >
                {paginatedProducts.map((product) => (
                  viewMode === 'grid' ? (
                    <MenuProductCard
                      key={product.product_id}
                      product={product}
                      storeSlug={store.slug}
                      accentColor={accentColor}
                    />
                  ) : (
                    <MenuProductListItem
                      key={product.product_id}
                      product={product}
                      storeSlug={store.slug}
                      accentColor={accentColor}
                    />
                  )
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-neutral-100">
                <Leaf className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p className="text-neutral-600 font-medium mb-1">No products found</p>
                <p className="text-sm text-neutral-400 mb-4">
                  Try adjusting your filters or search query
                </p>
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="rounded-full"
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-9 w-9"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {generatePageNumbers(currentPage, totalPages).map((page, i) =>
                  page === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-neutral-400">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setCurrentPage(page as number)}
                      className="h-9 w-9"
                      aria-label={`Page ${page}`}
                      style={
                        currentPage === page
                          ? { backgroundColor: primaryColor }
                          : undefined
                      }
                    >
                      {page}
                    </Button>
                  )
                )}

                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 w-9"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile Filter Drawer ────────────────────────────────────────────── */}
      {showMobileFilters && (
        <MobileFilterDrawer
          selectedCategories={selectedCategories}
          selectedStrains={selectedStrains}
          priceRange={priceRange}
          maxPrice={maxPrice}
          availableCategories={availableCategories}
          availableStrains={availableStrains}
          onToggleCategory={toggleCategory}
          onToggleStrain={toggleStrain}
          onPriceRangeChange={setPriceRange}
          onClearAll={clearAllFilters}
          onClose={() => setShowMobileFilters(false)}
          activeFilterCount={activeFilterCount}
          primaryColor={primaryColor}
        />
      )}

      {/* Minimal footer */}
      <footer className="border-t border-neutral-200 bg-white mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <Link to={`/store/${store.slug}`} className="flex items-center gap-2">
              {store.logo_url ? (
                <OptimizedImage
                  src={store.logo_url}
                  alt={store.store_name}
                  className="h-5 object-contain"
                />
              ) : (
                <Leaf className="w-4 h-4" style={{ color: primaryColor }} />
              )}
              <span className="font-semibold text-sm text-neutral-700">
                {store.store_name}
              </span>
            </Link>
            <p className="text-xs text-neutral-400">
              &copy; {new Date().getFullYear()} {store.store_name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────────────

/** Grid product card */
function MenuProductCard({
  product,
  storeSlug,
  accentColor,
}: {
  product: MenuProduct;
  storeSlug: string;
  accentColor: string;
}) {
  const hasSalePrice =
    product.sale_price != null && product.sale_price < product.price;
  const displayPrice = hasSalePrice ? product.sale_price! : product.price;

  return (
    <Link to={`/shop/${storeSlug}/product/${product.product_id}`}>
      <div className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-neutral-50">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
            <ProductImage
              src={product.image_url}
              alt={product.product_name}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
            {hasSalePrice && (
              <span className="bg-red-500 text-white px-2 py-0.5 text-[10px] font-bold uppercase rounded-md">
                Sale
              </span>
            )}
            {product.strain_type && (
              <span
                className={cn(
                  'px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ',
                  product.strain_type === 'Indica'
                    ? 'bg-purple-100/90 text-purple-700 border-purple-200'
                    : product.strain_type === 'Sativa'
                      ? 'bg-amber-100/90 text-amber-700 border-amber-200'
                      : 'bg-emerald-100/90 text-emerald-700 border-emerald-200'
                )}
              >
                {product.strain_type}
              </span>
            )}
          </div>

          {/* Quick-add button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Navigate to product detail for full add- flow
              window.location.href = `/shop/${storeSlug}/product/${product.product_id}`;
            }}
            className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:scale-110"
            style={{ color: accentColor }}
            aria-label={`Add ${product.product_name}`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 flex flex-col flex-1">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
            {product.category}
          </p>
          <h3
            className="font-semibold text-sm leading-snug line-clamp-2 mb-2 group-hover:opacity-80 transition-opacity"
            style={{ color: accentColor }}
          >
            {product.product_name}
          </h3>

          {/* THC/CBD */}
          {(product.thc_content != null || product.cbd_content != null) && (
            <div className="flex flex-wrap gap-1 text-[10px] font-bold text-neutral-500 mb-2">
              {product.thc_content != null && (
                <span className="bg-neutral-100 px-1.5 py-0.5 rounded">
                  {product.thc_content}% THC
                </span>
              )}
              {product.cbd_content != null && (
                <span className="bg-neutral-100 px-1.5 py-0.5 rounded">
                  {product.cbd_content}% CBD
                </span>
              )}
            </div>
          )}

          {/* Price */}
          <div className="mt-auto pt-2 flex items-baseline gap-2">
            <span className="text-lg font-extrabold" style={{ color: accentColor }}>
              {formatCurrency(displayPrice)}
            </span>
            {hasSalePrice && (
              <span className="text-xs text-neutral-400 line-through">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** List view product row */
function MenuProductListItem({
  product,
  storeSlug,
  accentColor,
}: {
  product: MenuProduct;
  storeSlug: string;
  accentColor: string;
}) {
  const hasSalePrice =
    product.sale_price != null && product.sale_price < product.price;
  const displayPrice = hasSalePrice ? product.sale_price! : product.price;

  return (
    <Link to={`/shop/${storeSlug}/product/${product.product_id}`}>
      <div className="group bg-white rounded-xl border border-neutral-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex">
        {/* Image */}
        <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 overflow-hidden bg-neutral-50">
          <ProductImage
            src={product.image_url}
            alt={product.product_name}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                {product.category}
              </p>
              {product.strain_type && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border',
                    product.strain_type === 'Indica'
                      ? 'bg-purple-50 text-purple-600 border-purple-200'
                      : product.strain_type === 'Sativa'
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  )}
                >
                  {product.strain_type}
                </span>
              )}
              {hasSalePrice && (
                <span className="bg-red-500 text-white px-1.5 py-0.5 text-[9px] font-bold uppercase rounded">
                  Sale
                </span>
              )}
            </div>
            <h3
              className="font-semibold text-sm sm:text-base line-clamp-1 group-hover:opacity-80 transition-opacity"
              style={{ color: accentColor }}
            >
              {product.product_name}
            </h3>
            {product.description && (
              <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5 hidden sm:block">
                {product.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              {/* THC/CBD */}
              {product.thc_content != null && (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  {product.thc_content}% THC
                </span>
              )}
              {product.cbd_content != null && (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  {product.cbd_content}% CBD
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-base font-extrabold" style={{ color: accentColor }}>
                {formatCurrency(displayPrice)}
              </span>
              {hasSalePrice && (
                <span className="text-xs text-neutral-400 line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Desktop sidebar filter section wrapper */
function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border-b border-neutral-100 pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-1 text-left"
      >
        <span className="text-sm font-semibold text-neutral-700">{title}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-neutral-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && <div className="pt-3">{children}</div>}
    </div>
  );
}

/** Mobile filter drawer (full-screen overlay) */
function MobileFilterDrawer({
  selectedCategories,
  selectedStrains,
  priceRange,
  maxPrice,
  availableCategories,
  availableStrains,
  onToggleCategory,
  onToggleStrain,
  onPriceRangeChange,
  onClearAll,
  onClose,
  activeFilterCount,
  primaryColor,
}: {
  selectedCategories: string[];
  selectedStrains: string[];
  priceRange: [number, number];
  maxPrice: number;
  availableCategories: { name: string; count: number }[];
  availableStrains: string[];
  onToggleCategory: (cat: string) => void;
  onToggleStrain: (strain: string) => void;
  onPriceRangeChange: (range: [number, number]) => void;
  onClearAll: () => void;
  onClose: () => void;
  activeFilterCount: number;
  primaryColor: string;
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" role="presentation" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute left-0 top-0 bottom-0 w-full max-w-sm bg-white flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-neutral-800 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </h3>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs font-medium"
                style={{ color: primaryColor }}
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-100"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>
        </div>

        {/* Scrollable filters */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Categories */}
          {availableCategories.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 mb-3">Categories</h4>
              <div className="space-y-2">
                {availableCategories.map((cat) => (
                  <label
                    key={cat.name}
                    className="flex items-center gap-2.5 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(cat.name)}
                      onCheckedChange={() => onToggleCategory(cat.name)}
                    />
                    <span className="text-sm text-neutral-600 flex-1">{cat.name}</span>
                    <span className="text-xs text-neutral-400">{cat.count}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Strain Types */}
          {availableStrains.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-neutral-700 mb-3">
                Strain Type
              </h4>
              <div className="space-y-2">
                {availableStrains.map((strain) => (
                  <label
                    key={strain}
                    className="flex items-center gap-2.5 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedStrains.includes(strain)}
                      onCheckedChange={() => onToggleStrain(strain)}
                    />
                    <span className="text-sm text-neutral-600 flex items-center gap-2">
                      {strain}
                      <StrainDot strain={strain} />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Price Range */}
          <div>
            <h4 className="text-sm font-semibold text-neutral-700 mb-3">Price Range</h4>
            <div className="px-1 pt-2 pb-1">
              <Slider
                value={priceRange}
                onValueChange={(val) => onPriceRangeChange(val as [number, number])}
                min={0}
                max={maxPrice}
                step={5}
                className="mb-3"
              />
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{formatCurrency(priceRange[0])}</span>
                <span>{formatCurrency(priceRange[1])}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button
            onClick={onClose}
            className="w-full rounded-full text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Show Results
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small colored dot for strain type */
function StrainDot({ strain }: { strain: string }) {
  const color =
    strain === 'Indica'
      ? 'bg-purple-500'
      : strain === 'Sativa'
        ? 'bg-amber-500'
        : 'bg-emerald-500';
  return <span className={cn('w-2 h-2 rounded-full', color)} />;
}

/** Active filter pill with remove */
function FilterPill({
  label,
  onRemove,
  color,
}: {
  label: string;
  onRemove: () => void;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border"
      style={{
        borderColor: `${color}30`,
        color,
        backgroundColor: `${color}08`,
      }}
    >
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:opacity-70"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

/** Pagination helper */
function generatePageNumbers(
  current: number,
  total: number
): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push('...');

  pages.push(total);
  return pages;
}

/** Loading skeleton */
function MenuPageSkeleton() {
  return (
    <div className="min-h-dvh bg-neutral-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-neutral-200">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 flex-1 max-w-xl" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar skeleton */}
          <div className="hidden lg:block w-64 shrink-0 space-y-6">
            <Skeleton className="h-6 w-20" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
            <Skeleton className="h-6 w-20 mt-4" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>

          {/* Grid skeleton */}
          <div className="flex-1">
            <div className="flex justify-between mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Product grid skeleton */
function ProductGridSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 sm:h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
      ))}
    </div>
  );
}

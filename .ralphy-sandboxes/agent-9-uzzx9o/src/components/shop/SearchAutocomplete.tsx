/**
 * Search Autocomplete
 * Instant search with product suggestions
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Package, TrendingUp, Clock, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useDebounce } from '@/hooks/useDebounce';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import ProductImage from '@/components/ProductImage';

interface SearchAutocompleteProps {
  storeId: string;
  primaryColor: string;
  onSearch?: (query: string) => void;
}

interface ProductResult {
  product_id: string;
  name: string;
  price: number;
  display_price: number;
  image_url: string | null;
  category: string | null;
  in_stock: boolean;
}

export function SearchAutocomplete({ storeId, primaryColor, onSearch }: SearchAutocompleteProps) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debouncedQuery = useDebounce(query, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEYS.SHOP_RECENT_SEARCHES_PREFIX}${storeId}`);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch {
        // Invalid data
      }
    }
  }, [storeId]);

  // Search products
  const { data: results = [], isLoading } = useQuery({
    queryKey: queryKeys.searchAutocomplete.results(storeId, debouncedQuery),
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      const { data, error } = await supabase
        .rpc('get_marketplace_products', { p_store_id: storeId });

      if (error) throw error;

      const searchLower = debouncedQuery.toLowerCase();
      return (data as unknown as ProductResult[])
        .filter((p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.category?.toLowerCase().includes(searchLower)
        )
        .slice(0, 6);
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Get popular categories
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.searchAutocomplete.categories(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_categories')
        .select('name, slug')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .limit(4);

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !debouncedQuery,
  });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save search to recent
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const updated = [
      searchQuery.trim(),
      ...recentSearches.filter((s) => s.toLowerCase() !== searchQuery.toLowerCase()),
    ].slice(0, 5);

    setRecentSearches(updated);
    localStorage.setItem(`${STORAGE_KEYS.SHOP_RECENT_SEARCHES_PREFIX}${storeId}`, JSON.stringify(updated));
  }, [recentSearches, storeId]);

  // Handle search submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query);
      setIsOpen(false);
      if (onSearch) {
        onSearch(query);
      } else {
        navigate(`/shop/${storeSlug}/products?q=${encodeURIComponent(query)}`);
      }
    }
  };

  // Handle product click
  const handleProductClick = (product: ProductResult) => {
    saveRecentSearch(product.name);
    setIsOpen(false);
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(`${STORAGE_KEYS.SHOP_RECENT_SEARCHES_PREFIX}${storeId}`);
  };

  // Handle recent search click
  const handleRecentClick = (search: string) => {
    setQuery(search);
    saveRecentSearch(search);
    setIsOpen(false);
    if (onSearch) {
      onSearch(search);
    } else {
      navigate(`/shop/${storeSlug}/products?q=${encodeURIComponent(search)}`);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Label htmlFor="shop-search" className="sr-only">Search products</Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="shop-search"
            ref={inputRef}
            type="search"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="pl-9 pr-9"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-11 w-11"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 rounded-lg shadow-lg border z-50 max-h-[80vh] overflow-y-auto">
          {/* Loading */}
          {isLoading && debouncedQuery.length >= 2 && (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          )}

          {/* Search Results */}
          {!isLoading && results.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-sm font-medium text-muted-foreground">Products</p>
              {results.map((product) => (
                <Link
                  key={product.product_id}
                  to={`/shop/${storeSlug}/products/${product.product_id}`}
                  onClick={() => handleProductClick(product)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    <ProductImage
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: primaryColor }}>
                        {formatCurrency(product.display_price)}
                      </span>
                      {!product.in_stock && (
                        <Badge variant="secondary" className="text-xs">Out of Stock</Badge>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
              {query && (
                <button
                  onClick={handleSubmit}
                  className="w-full p-2 mt-2 text-sm font-medium text-center rounded-lg hover:bg-muted"
                  style={{ color: primaryColor }}
                >
                  See all results for "{query}"
                </button>
              )}
            </div>
          )}

          {/* No Results */}
          {!isLoading && debouncedQuery.length >= 2 && results.length === 0 && (
            <div className="p-4 text-center">
              <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No products found for "{debouncedQuery}"</p>
            </div>
          )}

          {/* Recent Searches & Categories (when no query) */}
          {!debouncedQuery && (
            <div className="p-2">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Recent Searches
                    </p>
                    <button
                      onClick={clearRecentSearches}
                      className="text-sm text-muted-foreground hover:text-foreground"
                      className="text-xs text-muted-foreground hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Clear recent searches"
                    >
                      Clear
                    </button>
                  </div>
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentClick(search)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                    >
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{search}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Popular Categories */}
              {categories.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Popular Categories
                  </p>
                  <div className="flex flex-wrap gap-2 p-2">
                    {categories.map((cat) => (
                      <Link
                        key={cat.slug}
                        to={`/shop/${storeSlug}/products?category=${cat.slug}`}
                        onClick={() => setIsOpen(false)}
                      >
                        <Badge variant="secondary" className="cursor-pointer hover:bg-muted-foreground/20">
                          {cat.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchAutocomplete;



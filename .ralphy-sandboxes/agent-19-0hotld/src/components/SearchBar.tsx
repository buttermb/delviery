import { logger } from '@/lib/logger';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { Command } from 'cmdk';
import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useDebounce } from '@/hooks/useDebounce';
import { RecentSearches } from './RecentSearches';
import { cleanProductName } from '@/utils/productName';

interface SearchBarProps {
  variant?: 'full' | 'icon';
}

interface Product {
  id: string;
  name: string;
  image_url?: string;
  category?: string;
  price: number;
  description?: string;
  in_stock?: boolean;
}

export function SearchBar({ variant = 'full' }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    // Keyboard shortcut: Cmd+K or Ctrl+K
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setProducts([]);
      return;
    }

    const searchProducts = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('products')
          .select('id, name, image_url, category, price, description, in_stock')
          .or(`name.ilike.%${escapePostgresLike(debouncedSearch)}%,description.ilike.%${escapePostgresLike(debouncedSearch)}%,category.ilike.%${escapePostgresLike(debouncedSearch)}%`)
          .eq('in_stock', true)
          .limit(10);
        
        setProducts(data ?? []);
      } catch (error) {
        logger.error('Search error', error, { component: 'SearchBar' });
      } finally {
        setLoading(false);
      }
    };

    searchProducts();
  }, [debouncedSearch]);

  const handleSelect = (productId: string) => {
    navigate(`/product/${productId}`);
    setOpen(false);
    setSearch('');
  };

  const handleSearchSubmit = (searchTerm: string) => {
    setSearch(searchTerm);
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={() => setOpen(true)}
          className="relative p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Search products"
          title="Search (⌘K)"
        >
          <Search className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors w-full"
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground text-sm">Search products...</span>
          <kbd className="ml-auto text-xs bg-background px-2 py-1 rounded border">⌘K</kbd>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-2xl">
          <Command className="rounded-lg border shadow-md">
            <div className="flex items-center border-b px-3">
              <label htmlFor="product-search-input" className="sr-only">Search products</label>
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                id="product-search-input"
                name="search"
                type="search"
                autoComplete="off"
                placeholder="Search for strains, edibles, concentrates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            </div>
            {search.length === 0 && (
              <div className="p-3 border-b">
                <RecentSearches onSelect={handleSearchSubmit} />
              </div>
            )}
            <Command.List className="max-h-[400px] overflow-y-auto p-2">
              {!search && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Start typing to search products...
                </div>
              )}
              {search && products.length === 0 && !loading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No results found for "{search}"
                </div>
              )}
              {products.map((product) => (
                <Command.Item
                  key={product.id}
                  onSelect={() => handleSelect(product.id)}
                  className="flex items-center gap-3 p-3 cursor-pointer rounded-lg hover:bg-muted transition-colors"
                >
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{cleanProductName(product.name)}</div>
                    <div className="text-sm text-muted-foreground">{product.category}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-primary">${product.price}</div>
                  </div>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
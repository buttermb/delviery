/**
 * DashboardSearchBar Component
 *
 * A global search bar component for the admin dashboard that enables
 * searching across all modules: customers, orders, products, invoices,
 * suppliers, and more.
 *
 * Features:
 * - Keyboard shortcut (Cmd/Ctrl+K) to focus
 * - Real-time search with debouncing
 * - Recent searches persistence
 * - Categorized results with icons
 * - Keyboard navigation support
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import Search from "lucide-react/dist/esm/icons/search";
import X from "lucide-react/dist/esm/icons/x";
import History from "lucide-react/dist/esm/icons/history";
import Users from "lucide-react/dist/esm/icons/users";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Package from "lucide-react/dist/esm/icons/package";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Truck from "lucide-react/dist/esm/icons/truck";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";

const RECENT_SEARCHES_KEY = 'dashboard_recent_searches';
const MAX_RECENT_SEARCHES = 5;
const SEARCH_DEBOUNCE_MS = 300;

export type SearchResultType =
  | 'customer'
  | 'order'
  | 'product'
  | 'invoice'
  | 'supplier'
  | 'courier'
  | 'wholesale_client'
  | 'wholesale_order';

export interface GlobalSearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
  url: string;
  metadata?: Record<string, unknown>;
}

interface RecentSearch {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
  url: string;
  timestamp: number;
}

interface DashboardSearchBarProps {
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'compact';
}

const SEARCH_RESULT_ICONS: Record<SearchResultType, React.ReactNode> = {
  customer: <Users className="h-4 w-4 text-blue-500" />,
  order: <ShoppingCart className="h-4 w-4 text-green-500" />,
  product: <Package className="h-4 w-4 text-purple-500" />,
  invoice: <Receipt className="h-4 w-4 text-orange-500" />,
  supplier: <Building2 className="h-4 w-4 text-teal-500" />,
  courier: <Truck className="h-4 w-4 text-indigo-500" />,
  wholesale_client: <Building2 className="h-4 w-4 text-amber-500" />,
  wholesale_order: <FileText className="h-4 w-4 text-cyan-500" />,
};

const SEARCH_RESULT_LABELS: Record<SearchResultType, string> = {
  customer: 'Customer',
  order: 'Order',
  product: 'Product',
  invoice: 'Invoice',
  supplier: 'Supplier',
  courier: 'Courier',
  wholesale_client: 'Wholesale Client',
  wholesale_order: 'Wholesale Order',
};

export function DashboardSearchBar({
  placeholder = 'Search across all modules...',
  className,
  variant = 'default',
}: DashboardSearchBarProps) {
  const { tenant } = useTenantAdminAuth();
  const navigate = useTenantNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as RecentSearch[];
        setRecentSearches(parsed);
      }
    } catch (error) {
      logger.error('Failed to load recent searches', { error });
    }
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Global keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Global search query
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['global-search', debouncedTerm, tenant?.id],
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      if (!debouncedTerm || debouncedTerm.length < 2 || !tenant?.id) {
        return [];
      }

      const searchLower = debouncedTerm.toLowerCase();
      const results: GlobalSearchResult[] = [];

      try {
        // Search in parallel across multiple tables (cast to any to bypass deep type issues)
        const [
          customersRes,
          ordersRes,
          productsRes,
          wholesaleClientsRes,
          wholesaleOrdersRes,
          couriersRes,
        ] = await Promise.all([
          // Search customers (profiles with account_id = tenant.id)
          (supabase as any)
            .from('profiles')
            .select('id, user_id, full_name, phone')
            .eq('account_id', tenant.id)
            .or(`full_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`)
            .limit(5),

          // Search orders
          (supabase as any)
            .from('orders')
            .select('id, order_number, status, total_amount, customer_name')
            .eq('tenant_id', tenant.id)
            .or(`order_number.ilike.%${searchLower}%,customer_name.ilike.%${searchLower}%`)
            .limit(5),

          // Search products
          (supabase as any)
            .from('products')
            .select('id, name, sku, category')
            .eq('tenant_id', tenant.id)
            .or(`name.ilike.%${searchLower}%,sku.ilike.%${searchLower}%`)
            .limit(5),

          // Search wholesale clients
          (supabase as any)
            .from('wholesale_clients')
            .select('id, business_name, contact_name, email')
            .eq('tenant_id', tenant.id)
            .or(`business_name.ilike.%${searchLower}%,contact_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%`)
            .limit(5),

          // Search wholesale orders
          (supabase as any)
            .from('wholesale_orders')
            .select('id, status, total_amount, wholesale_clients(business_name)')
            .eq('tenant_id', tenant.id)
            .ilike('id', `%${searchLower}%`)
            .limit(5),

          // Search couriers
          (supabase as any)
            .from('couriers')
            .select('id, full_name, phone, vehicle_type')
            .eq('tenant_id', tenant.id)
            .or(`full_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`)
            .limit(5),
        ]);

        // Map customers
        if (customersRes.data) {
          for (const c of customersRes.data as any[]) {
            results.push({
              id: c.user_id || c.id,
              type: 'customer',
              label: c.full_name || 'Unknown Customer',
              sublabel: c.phone || undefined,
              url: `/admin/customers/${c.user_id || c.id}`,
            });
          }
        }

        // Map orders
        if (ordersRes.data) {
          for (const o of ordersRes.data as any[]) {
            results.push({
              id: o.id,
              type: 'order',
              label: `Order #${o.order_number || o.id.slice(0, 8)}`,
              sublabel: o.customer_name || o.status || undefined,
              url: `/admin/orders/${o.id}`,
              metadata: { status: o.status, total: o.total_amount },
            });
          }
        }

        // Map products
        if (productsRes.data) {
          for (const p of productsRes.data as any[]) {
            results.push({
              id: p.id,
              type: 'product',
              label: p.name,
              sublabel: p.sku ? `SKU: ${p.sku}` : p.category || undefined,
              url: `/admin/products/${p.id}`,
            });
          }
        }

        // Map wholesale clients
        if (wholesaleClientsRes.data) {
          for (const wc of wholesaleClientsRes.data as any[]) {
            results.push({
              id: wc.id,
              type: 'wholesale_client',
              label: wc.business_name || 'Unnamed Client',
              sublabel: wc.contact_name || wc.email || undefined,
              url: `/admin/clients/${wc.id}`,
            });
          }
        }

        // Map wholesale orders
        if (wholesaleOrdersRes.data) {
          for (const wo of wholesaleOrdersRes.data as any[]) {
            const clientName = wo.wholesale_clients?.business_name;
            results.push({
              id: wo.id,
              type: 'wholesale_order',
              label: `Wholesale #${wo.id.slice(0, 8)}`,
              sublabel: clientName || wo.status || undefined,
              url: `/admin/wholesale-orders/${wo.id}`,
            });
          }
        }

        // Map couriers
        if (couriersRes.data) {
          for (const c of couriersRes.data as any[]) {
            results.push({
              id: c.id,
              type: 'courier',
              label: c.full_name || 'Unknown Courier',
              sublabel: c.phone || c.vehicle_type || undefined,
              url: `/admin/couriers/${c.id}`,
            });
          }
        }
      } catch (error) {
        logger.error('Global search error', { error });
      }

      return results;
    },
    enabled: debouncedTerm.length >= 2 && !!tenant?.id,
    staleTime: 30000,
  });

  // Save a search to recent searches
  const saveRecentSearch = useCallback((result: GlobalSearchResult) => {
    const newRecent: RecentSearch = {
      id: result.id,
      type: result.type,
      label: result.label,
      sublabel: result.sublabel,
      url: result.url,
      timestamp: Date.now(),
    };

    setRecentSearches((prev) => {
      const filtered = prev.filter((r) => !(r.id === result.id && r.type === result.type));
      const updated = [newRecent, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (error) {
        logger.error('Failed to save recent searches', { error });
      }
      return updated;
    });
  }, []);

  // Clear all recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
      logger.error('Failed to clear recent searches', { error });
    }
  }, []);

  // Handle result selection
  const handleSelect = useCallback((result: GlobalSearchResult | RecentSearch) => {
    saveRecentSearch(result as GlobalSearchResult);
    navigate(result.url);
    setOpen(false);
    setSearchTerm('');
  }, [navigate, saveRecentSearch]);

  // Handle view all results
  const handleViewAll = useCallback(() => {
    if (searchTerm.length >= 2) {
      navigate(`/admin/search?q=${encodeURIComponent(searchTerm)}`);
      setOpen(false);
      setSearchTerm('');
    }
  }, [searchTerm, navigate]);

  // Group results by type
  const groupedResults = useMemo(() => {
    return searchResults?.reduce<Record<SearchResultType, GlobalSearchResult[]>>(
      (acc, result) => {
        if (!acc[result.type]) {
          acc[result.type] = [];
        }
        acc[result.type].push(result);
        return acc;
      },
      {} as Record<SearchResultType, GlobalSearchResult[]>
    ) ?? {};
  }, [searchResults]);

  const hasResults = searchResults && searchResults.length > 0;
  const showRecentSearches = !searchTerm && recentSearches.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'justify-start text-muted-foreground font-normal',
            variant === 'default' && 'w-full max-w-md',
            variant === 'compact' && 'w-64',
            className
          )}
        >
          <Search className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">{placeholder}</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <CommandList className="max-h-[400px]">
            {isLoading && debouncedTerm.length >= 2 && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            )}

            {!isLoading && debouncedTerm.length >= 2 && !hasResults && (
              <CommandEmpty>
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No results found for "{searchTerm}"
                  </p>
                </div>
              </CommandEmpty>
            )}

            {/* Recent Searches */}
            {showRecentSearches && (
              <CommandGroup>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Recent Searches
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearRecentSearches();
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
                {recentSearches.map((recent) => (
                  <CommandItem
                    key={`recent-${recent.type}-${recent.id}`}
                    value={`recent-${recent.id}`}
                    onSelect={() => handleSelect(recent)}
                    className="cursor-pointer"
                  >
                    <History className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {SEARCH_RESULT_ICONS[recent.type]}
                        <span className="truncate">{recent.label}</span>
                      </div>
                      {recent.sublabel && (
                        <p className="text-xs text-muted-foreground truncate">
                          {recent.sublabel}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] ml-2">
                      {SEARCH_RESULT_LABELS[recent.type]}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Search Results by Category */}
            {hasResults && (
              <>
                {(Object.keys(groupedResults) as SearchResultType[]).map((type) => (
                  <CommandGroup key={type} heading={SEARCH_RESULT_LABELS[type]}>
                    {groupedResults[type].map((result) => (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        value={`${result.type}-${result.id}`}
                        onSelect={() => handleSelect(result)}
                        className="cursor-pointer"
                      >
                        {SEARCH_RESULT_ICONS[result.type]}
                        <div className="flex-1 min-w-0 ml-2">
                          <span className="truncate">{result.label}</span>
                          {result.sublabel && (
                            <p className="text-xs text-muted-foreground truncate">
                              {result.sublabel}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleViewAll}
                    className="cursor-pointer justify-center"
                  >
                    <span className="text-sm text-muted-foreground">
                      View all results for "{searchTerm}"
                    </span>
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {/* Prompt for typing */}
            {!showRecentSearches && searchTerm.length < 2 && !isLoading && (
              <div className="py-6 text-center">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Search across customers, orders, products, and more
                </p>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

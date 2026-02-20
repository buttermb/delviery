import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Search from "lucide-react/dist/esm/icons/search";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import X from "lucide-react/dist/esm/icons/x";
import Clock from "lucide-react/dist/esm/icons/clock";
import Package from "lucide-react/dist/esm/icons/package";
import Phone from "lucide-react/dist/esm/icons/phone";
import Hash from "lucide-react/dist/esm/icons/hash";
import { useDebounce } from '@/hooks/useDebounce';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { STORAGE_KEYS, safeStorage, safeJsonParse, safeJsonStringify } from '@/constants/storageKeys';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { formatSmartDate } from '@/lib/formatters';

interface OrderSearchResult {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  user?: {
    full_name: string | null;
    phone: string | null;
  };
}

interface OrderSearchBarProps {
  onSelectOrder?: (order: OrderSearchResult) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

const MAX_RECENT_SEARCHES = 5;

export function OrderSearchBar({
  onSelectOrder,
  onSearch,
  placeholder = 'Search by order # or phone...',
  className,
}: OrderSearchBarProps) {
  const { tenant } = useTenantAdminAuth();
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(inputValue.trim(), 300);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = safeStorage.getItem(STORAGE_KEYS.ORDER_SEARCH_RECENT);
    const parsed = safeJsonParse<string[]>(stored, []);
    if (Array.isArray(parsed)) {
      setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
    }
  }, []);

  // Save recent search to localStorage
  const saveRecentSearch = useCallback((search: string) => {
    if (!search.trim()) return;

    setRecentSearches(prev => {
      const updated = [search, ...prev.filter(s => s !== search)].slice(0, MAX_RECENT_SEARCHES);
      const json = safeJsonStringify(updated);
      if (json) {
        safeStorage.setItem(STORAGE_KEYS.ORDER_SEARCH_RECENT, json);
      }
      return updated;
    });
  }, []);

  // Search query
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ['order-search', tenant?.id, debouncedQuery],
    queryFn: async (): Promise<OrderSearchResult[]> => {
      if (!tenant?.id || debouncedQuery.length < 2) return [];

      // Search by order number or phone
      // Format: order number starts with # or is numeric, phone contains digits
      const isOrderNumber = /^#?\d/.test(debouncedQuery);
      const cleanQuery = debouncedQuery.replace(/^#/, '').toLowerCase();

      // Query orders table
      let query = supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at, user_id')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (isOrderNumber) {
        // Search by order number (case insensitive)
        query = query.ilike('order_number', `%${escapePostgresLike(cleanQuery)}%`);
      }

      const { data: ordersData, error } = await query;

      if (error) {
        throw error;
      }

      // If not order number search, we need to search by phone
      // Fetch all recent orders and filter by phone
      let phoneOrders: typeof ordersData = [];
      if (!isOrderNumber && debouncedQuery.length >= 3) {
        const { data: allOrders } = await supabase
          .from('orders')
          .select('id, order_number, status, total_amount, created_at, user_id')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(50);

        phoneOrders = allOrders || [];
      }

      // Combine and deduplicate order IDs
      const allOrdersMap = new Map<string, typeof ordersData[0]>();
      [...(ordersData || []), ...phoneOrders].forEach(order => {
        if (!allOrdersMap.has(order.id)) {
          allOrdersMap.set(order.id, order);
        }
      });

      const combinedOrders = Array.from(allOrdersMap.values());

      // Fetch user profiles for these orders
      const userIds = [...new Set(combinedOrders.map(o => o.user_id).filter(Boolean))];
      let profilesMap: Record<string, { full_name: string | null; phone: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, first_name, last_name, phone')
          .in('user_id', userIds);

        profilesMap = (profilesData || []).reduce((acc, profile) => {
          const displayName = profile.full_name
            || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
            || null;
          acc[profile.user_id] = {
            full_name: displayName,
            phone: profile.phone,
          };
          return acc;
        }, {} as Record<string, { full_name: string | null; phone: string | null }>);
      }

      // Map orders with user info
      let results: OrderSearchResult[] = combinedOrders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
        created_at: order.created_at,
        user: order.user_id ? profilesMap[order.user_id] : undefined,
      }));

      // Filter by phone if searching by phone
      if (!isOrderNumber && debouncedQuery.length >= 3) {
        const phoneDigits = debouncedQuery.replace(/\D/g, '');
        results = results.filter(order => {
          if (order.user?.phone) {
            const orderPhoneDigits = order.user.phone.replace(/\D/g, '');
            return orderPhoneDigits.includes(phoneDigits);
          }
          return false;
        });
      }

      return results.slice(0, 10);
    },
    enabled: !!tenant?.id && debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle selection
  const handleSelect = useCallback((order: OrderSearchResult) => {
    saveRecentSearch(order.order_number);
    setInputValue('');
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
    onSelectOrder?.(order);
  }, [onSelectOrder, saveRecentSearch]);

  // Handle recent search selection
  const handleRecentSelect = useCallback((search: string) => {
    setInputValue(search);
    onSearch?.(search);
  }, [onSearch]);

  // All selectable items (recent searches when empty, search results otherwise)
  const allItems = useMemo(() => {
    if (inputValue.trim().length === 0 && recentSearches.length > 0) {
      return { type: 'recent' as const, items: recentSearches };
    }
    if (searchResults.length > 0) {
      return { type: 'results' as const, items: searchResults };
    }
    return { type: 'empty' as const, items: [] };
  }, [inputValue, recentSearches, searchResults]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalItems = allItems.items.length;

    if (!isOpen || totalItems === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1 >= totalItems ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 < 0 ? totalItems - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      if (allItems.type === 'recent') {
        handleRecentSelect(allItems.items[activeIndex] as string);
      } else if (allItems.type === 'results') {
        handleSelect(allItems.items[activeIndex] as OrderSearchResult);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }, [isOpen, allItems, activeIndex, handleSelect, handleRecentSelect]);

  // Handle focus
  const handleFocus = () => {
    setIsOpen(true);
    setActiveIndex(-1);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsOpen(true);
    setActiveIndex(-1);
    onSearch?.(value);
  };

  // Handle clear
  const handleClear = () => {
    setInputValue('');
    setIsOpen(false);
    onSearch?.('');
    inputRef.current?.focus();
  };

  // Highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    try {
      const parts = text.split(new RegExp(`(${query})`, 'gi'));
      return parts.map((part, idx) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={idx} className="bg-primary/20 text-primary font-medium rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  const showDropdown = isOpen && (
    (inputValue.trim().length === 0 && recentSearches.length > 0) ||
    (inputValue.trim().length >= 2 && (isLoading || searchResults.length > 0)) ||
    (inputValue.trim().length >= 2 && !isLoading && searchResults.length === 0)
  );

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!isLoading && inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          {/* Recent Searches */}
          {inputValue.trim().length === 0 && recentSearches.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                Recent Searches
              </div>
              {recentSearches.map((search, idx) => (
                <button
                  key={`recent-${search}`}
                  type="button"
                  onClick={() => handleRecentSelect(search)}
                  className={cn(
                    'w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted transition-colors',
                    idx === activeIndex && 'bg-muted'
                  )}
                >
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {inputValue.trim().length >= 2 && (
            <>
              {isLoading && (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Searching...
                </div>
              )}

              {!isLoading && searchResults.length > 0 && (
                <div className="max-h-[300px] overflow-y-auto">
                  {searchResults.map((order, idx) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => handleSelect(order)}
                      className={cn(
                        'w-full px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0',
                        idx === activeIndex && 'bg-muted'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Hash className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            <span className="font-mono font-medium text-sm">
                              {highlightText(order.order_number, inputValue)}
                            </span>
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded-full',
                              order.status === 'delivered' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              order.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                              order.status === 'cancelled' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                              !['delivered', 'pending', 'cancelled'].includes(order.status) && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            )}>
                              {order.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {order.user?.full_name && (
                              <span className="truncate">{order.user.full_name}</span>
                            )}
                            {order.user?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {highlightText(order.user.phone, inputValue.replace(/\D/g, '') ? inputValue : '')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono font-medium text-sm">
                            ${order.total_amount?.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatSmartDate(order.created_at)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isLoading && searchResults.length === 0 && (
                <div className="px-3 py-4 text-center">
                  <Package className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No orders found for "{inputValue}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try searching by order number or phone
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

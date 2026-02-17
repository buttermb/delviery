/**
 * Customer Search Component with Typeahead
 *
 * Typeahead search component for customer selection across multiple modules.
 * Used in order creation, customer list, and global search.
 *
 * Features:
 * - Searches by name, phone, email
 * - Results with customer info and segment badge
 * - Debounced search (300ms)
 * - Highlights matching text
 * - Recent searches cached in localStorage
 * - Keyboard navigation support
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';
import Clock from 'lucide-react/dist/esm/icons/clock';
import User from 'lucide-react/dist/esm/icons/user';
import Phone from 'lucide-react/dist/esm/icons/phone';
import Mail from 'lucide-react/dist/esm/icons/mail';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

import CustomerSegmentBadge from '@/components/admin/customers/CustomerSegmentBadge';
import { useCustomerSegment, type CustomerSegment } from '@/hooks/useCustomerSegments';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';

// ============================================================================
// Types
// ============================================================================

export interface CustomerSearchResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface CustomerSearchProps {
  /** Callback when a customer is selected */
  onSelect: (customer: CustomerSearchResult) => void;
  /** Currently selected customer ID (to show as selected) */
  selectedCustomerId?: string | null;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names for the container */
  className?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Minimum characters before search triggers */
  minSearchLength?: number;
  /** Maximum number of results to show */
  maxResults?: number;
  /** Show recent searches when no query */
  showRecentSearches?: boolean;
  /** ID for the input element */
  inputId?: string;
}

interface RecentSearch {
  id: string;
  name: string;
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

const RECENT_SEARCHES_KEY = 'floraiq_customer_recent_searches';
const MAX_RECENT_SEARCHES = 5;
const DEBOUNCE_MS = 300;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

/**
 * Highlight matching text in a string
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const startIndex = lowerText.indexOf(lowerQuery);

  if (startIndex === -1) return text;

  const endIndex = startIndex + query.length;
  const beforeMatch = text.slice(0, startIndex);
  const match = text.slice(startIndex, endIndex);
  const afterMatch = text.slice(endIndex);

  return (
    <>
      {beforeMatch}
      <mark className="bg-yellow-200 dark:bg-yellow-900/50 text-inherit rounded-sm px-0.5">
        {match}
      </mark>
      {afterMatch}
    </>
  );
}

/**
 * Load recent searches from localStorage
 */
function loadRecentSearches(tenantId: string): RecentSearch[] {
  try {
    const stored = localStorage.getItem(`${RECENT_SEARCHES_KEY}_${tenantId}`);
    if (stored) {
      const parsed = JSON.parse(stored) as RecentSearch[];
      // Filter out old entries (older than 7 days)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return parsed.filter((s) => s.timestamp > sevenDaysAgo).slice(0, MAX_RECENT_SEARCHES);
    }
  } catch {
    // Invalid data, return empty
  }
  return [];
}

/**
 * Save recent searches to localStorage
 */
function saveRecentSearches(tenantId: string, searches: RecentSearch[]): void {
  try {
    localStorage.setItem(
      `${RECENT_SEARCHES_KEY}_${tenantId}`,
      JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    // Storage full or unavailable
  }
}

// ============================================================================
// Customer Result Item Component
// ============================================================================

interface CustomerResultItemProps {
  customer: CustomerSearchResult;
  query: string;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CustomerResultItem({
  customer,
  query,
  isSelected,
  isHighlighted,
  onClick,
  onMouseEnter,
}: CustomerResultItemProps) {
  const { segment } = useCustomerSegment({
    customerId: customer.id,
    enabled: true,
  });

  const initials = getInitials(customer.full_name || 'UN');

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full flex items-center gap-3 p-3 text-left transition-colors',
        isHighlighted && 'bg-accent',
        isSelected && 'bg-primary/10 border-l-2 border-primary'
      )}
    >
      <Avatar className="h-9 w-9 flex-shrink-0">
        {customer.avatar_url && <AvatarImage src={customer.avatar_url} alt={customer.full_name} />}
        <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {highlightMatch(customer.full_name, query)}
          </span>
          {segment && (
            <CustomerSegmentBadge
              segment={segment.segment as CustomerSegment}
              size="sm"
              showIcon={false}
              showTooltip={false}
            />
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {customer.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {highlightMatch(customer.phone, query)}
            </span>
          )}
          {customer.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{highlightMatch(customer.email, query)}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function SearchResultsSkeleton() {
  return (
    <div className="p-2 space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomerSearch({
  onSelect,
  selectedCustomerId,
  placeholder = 'Search customers by name, phone, or email...',
  className,
  disabled = false,
  autoFocus = false,
  minSearchLength = 2,
  maxResults = 6,
  showRecentSearches = true,
  inputId,
}: CustomerSearchProps) {
  const { tenant } = useTenantAdminAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Load recent searches on mount
  useEffect(() => {
    if (tenant?.id && showRecentSearches) {
      const loaded = loadRecentSearches(tenant.id);
      setRecentSearches(loaded);
    }
  }, [tenant?.id, showRecentSearches]);

  // Search query
  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ['customer-search', tenant?.id, debouncedQuery],
    queryFn: async (): Promise<CustomerSearchResult[]> => {
      if (!tenant?.id || debouncedQuery.length < minSearchLength) {
        return [];
      }

      const escaped = escapePostgresLike(debouncedQuery);
      const searchTerm = `%${escaped}%`;

      const { data, error: queryError } = await (supabase as any)
        .from('customers')
        .select('id, first_name, last_name, email, phone, avatar_url, created_at')
        .eq('tenant_id', tenant.id)
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
        .limit(maxResults);

      if (queryError) {
        logger.error('Customer search failed', queryError, {
          component: 'CustomerSearch',
          query: debouncedQuery,
        });
        throw queryError;
      }

      return (data || []).map((customer) => ({
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        full_name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: customer.email,
        phone: customer.phone,
        avatar_url: customer.avatar_url,
        created_at: customer.created_at,
      }));
    },
    enabled: !!tenant?.id && debouncedQuery.length >= minSearchLength,
    staleTime: 30000,
  });

  // Log errors
  useEffect(() => {
    if (error) {
      logger.error('Customer search error', error as Error, {
        component: 'CustomerSearch',
      });
    }
  }, [error]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add to recent searches
  const addToRecentSearches = useCallback(
    (customer: CustomerSearchResult) => {
      if (!tenant?.id) return;

      const newSearch: RecentSearch = {
        id: customer.id,
        name: customer.full_name,
        timestamp: Date.now(),
      };

      const updated = [
        newSearch,
        ...recentSearches.filter((s) => s.id !== customer.id),
      ].slice(0, MAX_RECENT_SEARCHES);

      setRecentSearches(updated);
      saveRecentSearches(tenant.id, updated);
    },
    [tenant?.id, recentSearches]
  );

  // Handle customer selection
  const handleSelect = useCallback(
    (customer: CustomerSearchResult) => {
      addToRecentSearches(customer);
      setQuery('');
      setIsOpen(false);
      onSelect(customer);
    },
    [addToRecentSearches, onSelect]
  );

  // Handle recent search selection
  const handleRecentSelect = useCallback(
    async (recentSearch: RecentSearch) => {
      if (!tenant?.id) return;

      // Fetch the customer data
      const { data, error: fetchError } = await (supabase as any)
        .from('customers')
        .select('id, first_name, last_name, email, phone, avatar_url, created_at')
        .eq('id', recentSearch.id)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (fetchError || !data) {
        logger.warn('Recent search customer not found', { id: recentSearch.id });
        // Remove from recent searches
        const updated = recentSearches.filter((s) => s.id !== recentSearch.id);
        setRecentSearches(updated);
        saveRecentSearches(tenant.id, updated);
        return;
      }

      const customer: CustomerSearchResult = {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        full_name: [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: data.email,
        phone: data.phone,
        avatar_url: data.avatar_url,
        created_at: data.created_at,
      };

      handleSelect(customer);
    },
    [tenant?.id, recentSearches, handleSelect]
  );

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    if (!tenant?.id) return;
    setRecentSearches([]);
    saveRecentSearches(tenant.id, []);
  }, [tenant?.id]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setIsOpen(true);
        }
        return;
      }

      const totalItems = debouncedQuery.length >= minSearchLength ? results.length : recentSearches.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0) {
            if (debouncedQuery.length >= minSearchLength && results[highlightedIndex]) {
              handleSelect(results[highlightedIndex]);
            } else if (recentSearches[highlightedIndex]) {
              handleRecentSelect(recentSearches[highlightedIndex]);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, debouncedQuery, minSearchLength, results, recentSearches, highlightedIndex, handleSelect, handleRecentSelect]
  );

  // Determine what to show in the dropdown
  const showResults = debouncedQuery.length >= minSearchLength;
  const showRecent = !showResults && showRecentSearches && recentSearches.length > 0;
  const hasNoResults = showResults && !isLoading && results.length === 0;

  // Memoize dropdown content
  const dropdownContent = useMemo(() => {
    if (isLoading && showResults) {
      return <SearchResultsSkeleton />;
    }

    if (hasNoResults) {
      return (
        <div className="p-6 text-center">
          <User className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No customers found for &quot;{debouncedQuery}&quot;</p>
        </div>
      );
    }

    if (showResults && results.length > 0) {
      return (
        <div className="py-1">
          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Customers ({results.length})
          </p>
          {results.map((customer, index) => (
            <CustomerResultItem
              key={customer.id}
              customer={customer}
              query={debouncedQuery}
              isSelected={customer.id === selectedCustomerId}
              isHighlighted={index === highlightedIndex}
              onClick={() => handleSelect(customer)}
              onMouseEnter={() => setHighlightedIndex(index)}
            />
          ))}
        </div>
      );
    }

    if (showRecent) {
      return (
        <div className="py-1">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Recent Searches
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={clearRecentSearches}
            >
              Clear
            </Button>
          </div>
          {recentSearches.map((recent, index) => (
            <button
              key={recent.id}
              type="button"
              onClick={() => handleRecentSelect(recent)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                index === highlightedIndex && 'bg-accent'
              )}
            >
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{recent.name}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Type at least {minSearchLength} characters to search
      </div>
    );
  }, [
    isLoading,
    showResults,
    hasNoResults,
    debouncedQuery,
    results,
    selectedCustomerId,
    highlightedIndex,
    handleSelect,
    showRecent,
    recentSearches,
    clearRecentSearches,
    handleRecentSelect,
    minSearchLength,
  ]);

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={inputId}
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoFocus={autoFocus}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            tabIndex={-1}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {isLoading && showResults && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {dropdownContent}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Inline Customer Search (for forms)
// ============================================================================

interface InlineCustomerSearchProps extends Omit<CustomerSearchProps, 'onSelect'> {
  /** Currently selected customer */
  selectedCustomer: CustomerSearchResult | null;
  /** Callback when customer selection changes */
  onChange: (customer: CustomerSearchResult | null) => void;
  /** Show clear button when customer is selected */
  showClear?: boolean;
}

export function InlineCustomerSearch({
  selectedCustomer,
  onChange,
  showClear = true,
  ...props
}: InlineCustomerSearchProps) {
  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
        <Avatar className="h-8 w-8">
          {selectedCustomer.avatar_url && (
            <AvatarImage src={selectedCustomer.avatar_url} alt={selectedCustomer.full_name} />
          )}
          <AvatarFallback className="text-xs">
            {getInitials(selectedCustomer.full_name || 'UN')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selectedCustomer.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {selectedCustomer.phone || selectedCustomer.email || 'No contact info'}
          </p>
        </div>
        {showClear && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <CustomerSearch
      {...props}
      onSelect={onChange}
    />
  );
}

export default CustomerSearch;

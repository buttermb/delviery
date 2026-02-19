/**
 * Global Search Command Palette
 *
 * Opens with Cmd+K / Ctrl+K keyboard shortcut.
 * Uses useGlobalSearch hook to search across orders, products, customers, and vendors.
 * Groups results by entity type with icons from ENTITY_ICONS.
 * Each result shows name, subtitle, and status badge.
 * Clicking navigates via useEntityNavigation.
 * Recent searches stored in localStorage via STORAGE_KEYS.
 * Shows keyboard shortcut hints.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { create } from 'zustand';
import {
  FileText,
  Package,
  Users,
  Building2,
  Loader2,
  Search,
  History,
  X,
  ArrowRight,
} from 'lucide-react';

import type { EntityType } from '@/lib/constants/entityTypes';
import { ENTITY_LABELS } from '@/lib/constants/entityTypes';
import { StatusBadge, type StatusEntityType } from '@/components/admin/shared/StatusBadge';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGlobalSearch, type SearchResultItem } from '@/hooks/useGlobalSearch';
import { useEntityNavigation } from '@/hooks/useEntityNavigation';
import { STORAGE_KEYS, safeJsonParse, safeJsonStringify, safeStorage } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';

// ─── Global State ────────────────────────────────────────────────────────────

interface CommandPaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecentSearchItem {
  id: string;
  entityType: 'ORDER' | 'PRODUCT' | 'CUSTOMER' | 'VENDOR';
  name: string;
  subtitle?: string;
  timestamp: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_RECENT_SEARCHES = 10;

/**
 * Entity icons mapped to lucide-react components
 */
const ENTITY_ICON_COMPONENTS = {
  ORDER: FileText,
  PRODUCT: Package,
  CUSTOMER: Users,
  VENDOR: Building2,
} as const;

/**
 * Map entity types to status badge entity types
 */
const ENTITY_TO_STATUS_TYPE: Record<string, StatusEntityType | null> = {
  ORDER: 'order',
  PRODUCT: 'inventory',
  CUSTOMER: 'customer',
  VENDOR: null,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CommandPalette() {
  const { open, setOpen, toggle } = useCommandPaletteStore();
  const { navigateToEntity, isReady } = useEntityNavigation();

  const {
    results,
    isSearching,
    setQuery,
    clear: clearSearch,
    query,
    totalCount,
  } = useGlobalSearch({
    enabled: open,
  });

  // Recent searches from localStorage
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => {
    const stored = safeStorage.getItem(STORAGE_KEYS.COMMAND_PALETTE_RECENT_SEARCHES);
    return safeJsonParse<RecentSearchItem[]>(stored, []);
  });

  // ─── Keyboard Shortcut ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
        logger.debug('[CommandPalette] Toggled via keyboard shortcut');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // ─── Clear on close ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      clearSearch();
    }
  }, [open, clearSearch]);

  // ─── Recent Searches ───────────────────────────────────────────────────────

  const saveRecentSearch = useCallback(
    (item: Omit<RecentSearchItem, 'timestamp'>) => {
      setRecentSearches((prev) => {
        // Remove duplicate if exists
        const filtered = prev.filter(
          (r) => !(r.id === item.id && r.entityType === item.entityType)
        );

        // Add new item at the beginning
        const updated: RecentSearchItem[] = [
          { ...item, timestamp: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT_SEARCHES);

        // Persist to localStorage
        const json = safeJsonStringify(updated);
        if (json) {
          safeStorage.setItem(STORAGE_KEYS.COMMAND_PALETTE_RECENT_SEARCHES, json);
        }

        return updated;
      });
    },
    []
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    safeStorage.removeItem(STORAGE_KEYS.COMMAND_PALETTE_RECENT_SEARCHES);
    logger.debug('[CommandPalette] Cleared recent searches');
  }, []);

  // ─── Selection Handler ─────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (entityType: 'ORDER' | 'PRODUCT' | 'CUSTOMER' | 'VENDOR', item: SearchResultItem) => {
      if (!isReady) {
        logger.warn('[CommandPalette] Navigation not ready - missing tenant context');
        return;
      }

      // Save to recent searches
      saveRecentSearch({
        id: item.id,
        entityType,
        name: item.name,
        subtitle: item.subtitle,
      });

      // Navigate to entity
      navigateToEntity(entityType as EntityType, item.id);

      // Close palette
      setOpen(false);

      logger.debug('[CommandPalette] Navigated to entity', { entityType, entityId: item.id });
    },
    [isReady, navigateToEntity, saveRecentSearch, setOpen]
  );

  const handleRecentSelect = useCallback(
    (item: RecentSearchItem) => {
      if (!isReady) {
        logger.warn('[CommandPalette] Navigation not ready - missing tenant context');
        return;
      }

      // Update timestamp in recent searches
      saveRecentSearch({
        id: item.id,
        entityType: item.entityType,
        name: item.name,
        subtitle: item.subtitle,
      });

      // Navigate to entity
      navigateToEntity(item.entityType as EntityType, item.id);

      // Close palette
      setOpen(false);
    },
    [isReady, navigateToEntity, saveRecentSearch, setOpen]
  );

  // ─── Computed ──────────────────────────────────────────────────────────────

  const hasResults = totalCount > 0;
  const showRecentSearches = !query && recentSearches.length > 0;

  // ─── Render Result Group ───────────────────────────────────────────────────

  const renderResultGroup = useMemo(() => {
    const renderGroup = (
      entityType: 'ORDER' | 'PRODUCT' | 'CUSTOMER' | 'VENDOR',
      items: SearchResultItem[]
    ) => {
      if (items.length === 0) return null;

      const IconComponent = ENTITY_ICON_COMPONENTS[entityType];
      const label = ENTITY_LABELS[entityType];
      const statusType = ENTITY_TO_STATUS_TYPE[entityType];

      return (
        <CommandGroup key={entityType} heading={`${label}s`}>
          {items.map((item) => (
            <CommandItem
              key={`${entityType}-${item.id}`}
              value={`${entityType}-${item.id}-${item.name}`}
              onSelect={() => handleSelect(entityType, item)}
              className="min-h-[44px]"
            >
              <IconComponent className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="truncate">{item.name}</span>
                {item.subtitle && (
                  <span className="text-xs text-muted-foreground truncate">
                    {item.subtitle}
                  </span>
                )}
              </div>
              {item.status && statusType && (
                <StatusBadge
                  status={item.status}
                  entityType={statusType}
                  size="sm"
                  className="ml-2 flex-shrink-0"
                />
              )}
              <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CommandItem>
          ))}
        </CommandGroup>
      );
    };

    return renderGroup;
  }, [handleSelect]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search orders, products, customers, vendors..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>
          {isSearching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : query.length < 2 ? (
            <div className="py-6 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Type at least 2 characters to search
              </p>
            </div>
          ) : (
            <div className="py-6 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No results found.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try a different search term.
              </p>
            </div>
          )}
        </CommandEmpty>

        {/* Recent Searches - shown when no active search */}
        {showRecentSearches && (
          <>
            <CommandGroup
              heading={
                <div className="flex items-center justify-between w-full">
                  <span>Recent Searches</span>
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
              }
            >
              {recentSearches.map((item) => {
                const IconComponent = ENTITY_ICON_COMPONENTS[item.entityType];
                return (
                  <CommandItem
                    key={`recent-${item.entityType}-${item.id}`}
                    value={`recent-${item.entityType}-${item.id}-${item.name}`}
                    onSelect={() => handleRecentSelect(item)}
                    className="min-h-[44px]"
                  >
                    <History className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <IconComponent className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate">{item.name}</span>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-2 text-[10px] flex-shrink-0">
                      {ENTITY_LABELS[item.entityType]}
                    </Badge>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Search Results */}
        {hasResults && (
          <>
            {renderResultGroup('ORDER', results.orders)}
            {results.orders.length > 0 && results.products.length > 0 && (
              <CommandSeparator />
            )}
            {renderResultGroup('PRODUCT', results.products)}
            {(results.orders.length > 0 || results.products.length > 0) &&
              results.customers.length > 0 && <CommandSeparator />}
            {renderResultGroup('CUSTOMER', results.customers)}
            {(results.orders.length > 0 ||
              results.products.length > 0 ||
              results.customers.length > 0) &&
              results.vendors.length > 0 && <CommandSeparator />}
            {renderResultGroup('VENDOR', results.vendors)}
          </>
        )}

        {/* Loading indicator */}
        {isSearching && query.length >= 2 && !hasResults && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Searching database...</span>
          </div>
        )}
      </CommandList>

      {/* Footer with keyboard hints */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between bg-muted/30">
        <span className="hidden sm:flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">
            {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')
              ? '⌘'
              : 'Ctrl'}
          </kbd>
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">K</kbd>
          <span className="ml-1">to toggle</span>
        </span>
        <span className="sm:hidden text-muted-foreground">Tap to select</span>
        <span className="hidden sm:flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↓</kbd>
            <span className="ml-1">navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↵</kbd>
            <span className="ml-1">select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Esc</kbd>
            <span className="ml-1">close</span>
          </span>
        </span>
      </div>
    </CommandDialog>
  );
}

/**
 * Export store for external control of the command palette
 */
export { useCommandPaletteStore as useCommandPalette };

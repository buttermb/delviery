/**
 * SavedSearches
 *
 * Save and recall search queries with filters for admin entity pages.
 * Stores up to 10 saved searches per entity type in localStorage.
 */

import { useState, useCallback, useMemo } from 'react';

import { Bookmark, Search, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const MAX_SAVED_SEARCHES = 10;

type EntityType = 'orders' | 'products' | 'customers' | 'invoices';

interface SavedSearch {
  name: string;
  search: string;
  filters: Record<string, unknown>;
  entityType: EntityType;
}

interface SavedSearchesProps {
  entityType: EntityType;
  currentSearch: string;
  currentFilters: Record<string, unknown>;
  onApplySearch: (search: string, filters: Record<string, unknown>) => void;
}

function storageKey(entityType: EntityType): string {
  return `${STORAGE_KEYS.ADMIN_SAVED_SEARCHES_PREFIX}${entityType}`;
}

function loadSavedSearches(entityType: EntityType): SavedSearch[] {
  try {
    const raw = localStorage.getItem(storageKey(entityType));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSearch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedSearches(entityType: EntityType, searches: SavedSearch[]): void {
  try {
    localStorage.setItem(storageKey(entityType), JSON.stringify(searches));
  } catch {
    logger.warn('Failed to persist saved searches');
  }
}

export function SavedSearches({
  entityType,
  currentSearch,
  currentFilters,
  onApplySearch,
}: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>(() => loadSavedSearches(entityType));
  const [newName, setNewName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const canSave = useMemo(() => {
    const hasContent = currentSearch.trim().length > 0 || Object.keys(currentFilters).length > 0;
    return hasContent && newName.trim().length > 0 && searches.length < MAX_SAVED_SEARCHES;
  }, [currentSearch, currentFilters, newName, searches.length]);

  const handleSave = useCallback(() => {
    if (!canSave) return;

    const entry: SavedSearch = {
      name: newName.trim(),
      search: currentSearch,
      filters: currentFilters,
      entityType,
    };

    const updated = [...searches, entry];
    setSearches(updated);
    persistSavedSearches(entityType, updated);
    setNewName('');
    toast.success('Search saved');
  }, [canSave, newName, currentSearch, currentFilters, entityType, searches]);

  const handleApply = useCallback(
    (saved: SavedSearch) => {
      onApplySearch(saved.search, saved.filters);
      setIsOpen(false);
    },
    [onApplySearch]
  );

  const handleDelete = useCallback(
    (index: number) => {
      const updated = searches.filter((_, i) => i !== index);
      setSearches(updated);
      persistSavedSearches(entityType, updated);
    },
    [searches, entityType]
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bookmark className="h-4 w-4" />
          Saved Searches
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <p className="text-sm font-medium">Saved Searches</p>

          {searches.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No saved searches yet.</p>
          )}

          {searches.map((saved, index) => (
            <div key={index} className="flex items-center gap-2 group">
              <button
                onClick={() => handleApply(saved)}
                className="flex-1 flex items-center gap-2 text-left text-sm hover:bg-muted rounded px-2 py-1.5 transition-colors"
              >
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{saved.name}</span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(index)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}

          {searches.length < MAX_SAVED_SEARCHES && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Search name..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 shrink-0"
                  disabled={!canSave}
                  onClick={handleSave}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {!currentSearch.trim() && Object.keys(currentFilters).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Enter a search or apply filters first.
                </p>
              )}
            </div>
          )}

          {searches.length >= MAX_SAVED_SEARCHES && (
            <p className="text-xs text-muted-foreground">
              Maximum of {MAX_SAVED_SEARCHES} saved searches reached. Delete one to add more.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

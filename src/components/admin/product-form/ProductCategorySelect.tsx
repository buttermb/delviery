/**
 * ProductCategorySelect - Hierarchical category selector for products
 *
 * Features:
 * - Displays categories in a tree-like hierarchy with indentation
 * - Search functionality for quick filtering
 * - Shows category path breadcrumb in selected state
 * - Gracefully handles missing categories table
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Search from "lucide-react/dist/esm/icons/search";
import Folder from "lucide-react/dist/esm/icons/folder";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import Tag from "lucide-react/dist/esm/icons/tag";
import { cn } from '@/lib/utils';
import { useFlattenedCategories, type FlattenedCategory } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductCategorySelectProps {
  /** Currently selected category ID */
  value?: string | null;
  /** Callback when category changes */
  onChange: (categoryId: string | null) => void;
  /** Placeholder text when no category selected */
  placeholder?: string;
  /** Enable search functionality */
  searchable?: boolean;
  /** Allow clearing the selection */
  clearable?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * ProductCategorySelect - A dropdown select for hierarchical product categories
 */
export function ProductCategorySelect({
  value,
  onChange,
  placeholder = 'Select category...',
  searchable = true,
  clearable = true,
  disabled = false,
  className,
}: ProductCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: flattenedCategories, isLoading, isError } = useFlattenedCategories();

  // Find the selected category
  const selectedCategory = useMemo(() => {
    if (!value || !flattenedCategories) return null;
    return flattenedCategories.find((cat) => cat.id === value) ?? null;
  }, [value, flattenedCategories]);

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    if (!flattenedCategories) return [];
    if (!search) return flattenedCategories;

    const query = search.toLowerCase();
    return flattenedCategories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(query) ||
        cat.path.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query)
    );
  }, [flattenedCategories, search]);

  const handleSelect = useCallback(
    (categoryId: string | null) => {
      onChange(categoryId);
      setOpen(false);
      setSearch('');
    },
    [onChange]
  );

  // Show loading state
  if (isLoading) {
    return <Skeleton className={cn('h-10 w-full', className)} />;
  }

  // Handle errors or missing table gracefully
  if (isError) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn('w-full justify-between text-muted-foreground', className)}
      >
        Categories unavailable
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  // Show message when no categories exist
  if (flattenedCategories.length === 0) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn('w-full justify-between text-muted-foreground', className)}
      >
        No categories available
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          <span className="truncate flex items-center gap-2">
            {selectedCategory ? (
              <>
                <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedCategory.path}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Search */}
        {searchable && (
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                aria-label="Search categories"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[300px]">
          <div className="p-1">
            {/* Clear option */}
            {clearable && value && !search && (
              <>
                <CategoryItem
                  category={null}
                  isSelected={false}
                  onSelect={() => handleSelect(null)}
                  label="Clear selection"
                />
                <div className="my-1 border-b" />
              </>
            )}

            {/* Category list */}
            {filteredCategories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                isSelected={value === category.id}
                onSelect={() => handleSelect(category.id)}
              />
            ))}

            {/* No results */}
            {filteredCategories.length === 0 && search && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No categories found for &quot;{search}&quot;
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface CategoryItemProps {
  category: FlattenedCategory | null;
  isSelected: boolean;
  onSelect: () => void;
  label?: string;
}

function CategoryItem({ category, isSelected, onSelect, label }: CategoryItemProps) {
  const hasChildren = category
    ? category.depth === 0
    : false;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none',
        isSelected && 'bg-accent'
      )}
      style={{
        paddingLeft: category ? `${8 + category.depth * 16}px` : '8px',
      }}
    >
      {category ? (
        <>
          {hasChildren ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : category.depth > 0 ? (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="flex-1 text-left">
            <div className="font-medium">{category.name}</div>
            {category.description && (
              <div className="text-xs text-muted-foreground truncate">
                {category.description}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 text-left text-muted-foreground italic">
          {label}
        </div>
      )}
      {isSelected && <Check className="h-4 w-4 shrink-0" />}
    </button>
  );
}

export { ProductCategorySelect as default };

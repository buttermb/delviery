/**
 * ProductTagFilter
 *
 * Filter bar component for filtering products by tags.
 * Shows popular tags and allows multi-select filtering.
 */

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import Tag from 'lucide-react/dist/esm/icons/tag';
import X from 'lucide-react/dist/esm/icons/x';
import Search from 'lucide-react/dist/esm/icons/search';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import {
  useProductTags,
  usePopularProductTags,
  type ProductTag,
} from '@/hooks/useProductTags';
import { ProductTagBadge } from '@/components/admin/products/ProductTagBadge';
import { cn } from '@/lib/utils';

interface ProductTagFilterProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  showPopularTags?: boolean;
  maxPopularTags?: number;
  className?: string;
}

export function ProductTagFilter({
  selectedTagIds,
  onTagsChange,
  showPopularTags = true,
  maxPopularTags = 5,
  className,
}: ProductTagFilterProps) {
  const { data: allTags, isLoading: isLoadingAll } = useProductTags();
  const { data: popularTags, isLoading: isLoadingPopular } = usePopularProductTags(maxPopularTags);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get selected tag objects
  const selectedTags = useMemo(() => {
    if (!allTags) return [];
    return allTags.filter((tag) => selectedTagIds.includes(tag.id));
  }, [allTags, selectedTagIds]);

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!allTags) return [];
    if (!searchTerm) return allTags;
    const term = searchTerm.toLowerCase();
    return allTags.filter((tag) => tag.name.toLowerCase().includes(term));
  }, [allTags, searchTerm]);

  const handleToggleTag = useCallback((tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  }, [selectedTagIds, onTagsChange]);

  const handleRemoveTag = useCallback((tagId: string) => {
    onTagsChange(selectedTagIds.filter((id) => id !== tagId));
  }, [selectedTagIds, onTagsChange]);

  const handleClearAll = useCallback(() => {
    onTagsChange([]);
  }, [onTagsChange]);

  const isLoading = isLoadingAll || isLoadingPopular;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Main Filter Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tag Selector Popover */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Tag className="h-4 w-4" />
              Tags
              {selectedTagIds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedTagIds.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <ScrollArea className="h-64">
              <div className="p-2">
                {isLoadingAll ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : filteredTags.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {searchTerm ? 'No tags match your search' : 'No tags available'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => handleToggleTag(tag.id)}
                        />
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm truncate flex-1">{tag.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            {selectedTagIds.length > 0 && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={handleClearAll}
                >
                  Clear all
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Selected Tags as Badges */}
        {selectedTags.length > 0 && (
          <>
            {selectedTags.map((tag) => (
              <ProductTagBadge
                key={tag.id}
                tag={tag}
                size="sm"
                onRemove={() => handleRemoveTag(tag.id)}
              />
            ))}
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              Clear
            </Button>
          </>
        )}
      </div>

      {/* Popular Tags Quick Filter */}
      {showPopularTags && popularTags && popularTags.length > 0 && selectedTagIds.length === 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Popular:</span>
          {isLoadingPopular ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </>
          ) : (
            popularTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleToggleTag(tag.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                  'hover:bg-muted cursor-pointer',
                  selectedTagIds.includes(tag.id) && 'bg-muted'
                )}
                style={{ borderColor: tag.color }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
                {tag.usage_count > 0 && (
                  <span className="text-muted-foreground">({tag.usage_count})</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ProductTagFilter;

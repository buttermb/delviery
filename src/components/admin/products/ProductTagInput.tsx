/**
 * ProductTagInput
 *
 * Input component for assigning tags to a product.
 * Features auto-suggest for existing tags and ability to create new tags inline.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import Plus from 'lucide-react/dist/esm/icons/plus';

import Check from 'lucide-react/dist/esm/icons/check';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import {
  useProductTags,
  useProductTagAssignments,
  useCreateProductTag,
  useAssignProductTag,
  useRemoveProductTag,
  TAG_COLORS,
  type ProductTag,
} from '@/hooks/useProductTags';
import { ProductTagBadge } from '@/components/admin/products/ProductTagBadge';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface ProductTagInputProps {
  productId: string;
  className?: string;
}

export function ProductTagInput({ productId, className }: ProductTagInputProps) {
  const { data: allTags, isLoading: isLoadingTags } = useProductTags();
  const { data: assignments, isLoading: isLoadingAssignments } = useProductTagAssignments(productId);
  const createTag = useCreateProductTag();
  const assignTag = useAssignProductTag();
  const removeTag = useRemoveProductTag();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get assigned tag IDs
  const assignedTagIds = useMemo(() => {
    return new Set(assignments?.map((a) => a.tag_id) ?? []);
  }, [assignments]);

  // Get assigned tags with full data
  const assignedTags = useMemo(() => {
    if (!assignments) return [];
    return assignments
      .filter((a) => a.tag)
      .map((a) => a.tag as ProductTag);
  }, [assignments]);

  // Filter available tags based on search and exclude already assigned
  const availableTags = useMemo(() => {
    if (!allTags) return [];
    let filtered = allTags.filter((tag) => !assignedTagIds.has(tag.id));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((tag) => tag.name.toLowerCase().includes(term));
    }
    return filtered;
  }, [allTags, assignedTagIds, searchTerm]);

  // Check if exact match exists
  const exactMatchExists = useMemo(() => {
    if (!searchTerm || !allTags) return false;
    const term = searchTerm.toLowerCase().trim();
    return allTags.some((tag) => tag.name.toLowerCase() === term);
  }, [allTags, searchTerm]);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleAssignTag = useCallback(async (tagId: string) => {
    try {
      await assignTag.mutateAsync({ productId, tagId });
      setSearchTerm('');
    } catch (err) {
      logger.error('Error assigning tag', err);
    }
  }, [productId, assignTag]);

  const handleRemoveTag = useCallback(async (tagId: string) => {
    try {
      await removeTag.mutateAsync({ productId, tagId });
    } catch (err) {
      logger.error('Error removing tag', err);
    }
  }, [productId, removeTag]);

  const handleCreateAndAssign = useCallback(async () => {
    if (!searchTerm.trim()) return;

    try {
      const newTag = await createTag.mutateAsync({
        name: searchTerm.trim(),
        color: newTagColor,
      });
      if (newTag) {
        await assignTag.mutateAsync({ productId, tagId: newTag.id });
      }
      setSearchTerm('');
      setShowCreateForm(false);
      setNewTagColor(TAG_COLORS[0].value);
    } catch (err) {
      logger.error('Error creating and assigning tag', err);
    }
  }, [searchTerm, newTagColor, productId, createTag, assignTag]);

  const _isLoading = isLoadingTags || isLoadingAssignments;
  const isPending = assignTag.isPending || removeTag.isPending || createTag.isPending;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Assigned Tags Display */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {isLoadingAssignments ? (
          <>
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </>
        ) : assignedTags.length === 0 ? (
          <span className="text-sm text-muted-foreground">No tags assigned</span>
        ) : (
          assignedTags.map((tag) => (
            <ProductTagBadge
              key={tag.id}
              tag={tag}
              size="md"
              onRemove={() => handleRemoveTag(tag.id)}
            />
          ))
        )}
      </div>

      {/* Add Tag Button & Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-3 border-b">
            <Input
              ref={inputRef}
              placeholder="Search or create tag..."
              aria-label="Search or create tag"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && availableTags.length > 0) {
                  handleAssignTag(availableTags[0].id);
                } else if (e.key === 'Enter' && searchTerm && !exactMatchExists) {
                  setShowCreateForm(true);
                }
              }}
              className="h-9"
            />
          </div>

          <ScrollArea className="max-h-64">
            <div className="p-2">
              {isLoadingTags ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Available Tags */}
                  {availableTags.length > 0 ? (
                    <div className="space-y-1">
                      {availableTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleAssignTag(tag.id)}
                          disabled={isPending}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left"
                        >
                          <span
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-sm truncate flex-1">{tag.name}</span>
                          {assignTag.isPending && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : searchTerm ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No matching tags
                    </div>
                  ) : allTags && allTags.length === assignedTagIds.size ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      All tags assigned
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No tags available
                    </div>
                  )}

                  {/* Create New Tag Option */}
                  {searchTerm && !exactMatchExists && (
                    <div className="border-t mt-2 pt-2">
                      {showCreateForm ? (
                        <div className="space-y-3 p-2">
                          <div className="text-sm font-medium">
                            Create &quot;{searchTerm}&quot;
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {TAG_COLORS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => setNewTagColor(color.value)}
                                className={cn(
                                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                                  newTagColor === color.value
                                    ? 'border-foreground scale-110'
                                    : 'border-transparent'
                                )}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setShowCreateForm(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={handleCreateAndAssign}
                              disabled={createTag.isPending}
                            >
                              {createTag.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Create
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCreateForm(true)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-primary"
                        >
                          <Plus className="h-4 w-4" />
                          <span className="text-sm">
                            Create &quot;{searchTerm}&quot;
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default ProductTagInput;

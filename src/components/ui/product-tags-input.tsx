/**
 * ProductTagsInput Component
 *
 * A searchable multi-select input for product tags with:
 * - Search/filter through existing tags
 * - Create new tags inline
 * - Display selected tags as removable badges
 * - Keyboard navigation support
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import X from "lucide-react/dist/esm/icons/x";
import Plus from "lucide-react/dist/esm/icons/plus";
import Tag from "lucide-react/dist/esm/icons/tag";
import Check from "lucide-react/dist/esm/icons/check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

// Preset colors for new tags
const TAG_COLORS = [
  '#3B82F6', // blue
  '#22C55E', // green
  '#EAB308', // yellow
  '#F97316', // orange
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#6B7280', // gray
] as const;

interface ProductTag {
  id: string;
  name: string;
  color?: string;
}

interface ProductTagsInputProps {
  /** Currently selected tag IDs or tag names (for string array storage) */
  value: string[];
  /** Callback when tags change */
  onChange: (tags: string[]) => void;
  /** Available tags to choose from */
  availableTags?: ProductTag[];
  /** Whether to allow creating new tags */
  allowCreate?: boolean;
  /** Callback when a new tag is created */
  onCreateTag?: (name: string, color: string) => Promise<ProductTag | null>;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the component is loading tags */
  isLoading?: boolean;
  /** Maximum number of tags that can be selected */
  maxTags?: number;
  /** Additional class name */
  className?: string;
  /** Read-only mode - just display tags without edit capability */
  readOnly?: boolean;
  /** Whether to use tag IDs (with availableTags) or plain strings */
  useIds?: boolean;
}

export function ProductTagsInput({
  value,
  onChange,
  availableTags = [],
  allowCreate = true,
  onCreateTag,
  placeholder = 'Add tags...',
  disabled = false,
  isLoading = false,
  maxTags,
  className,
  readOnly = false,
  useIds = false,
}: ProductTagsInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>(TAG_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search when popover closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Get tag display info
  const getTagInfo = useCallback(
    (tagValue: string): { name: string; color?: string } => {
      if (useIds && availableTags.length > 0) {
        const tag = availableTags.find((t) => t.id === tagValue);
        return tag ? { name: tag.name, color: tag.color } : { name: tagValue };
      }
      // For string array mode, check if we have matching available tag
      const matchingTag = availableTags.find(
        (t) => t.name.toLowerCase() === tagValue.toLowerCase()
      );
      return matchingTag
        ? { name: matchingTag.name, color: matchingTag.color }
        : { name: tagValue };
    },
    [availableTags, useIds]
  );

  // Filter available tags based on search and already selected
  const filteredTags = useMemo(() => {
    const selectedSet = new Set(value.map((v) => v.toLowerCase()));

    return availableTags.filter((tag) => {
      const isSelected = useIds
        ? selectedSet.has(tag.id.toLowerCase())
        : selectedSet.has(tag.name.toLowerCase());

      if (isSelected) return false;

      if (searchQuery.trim()) {
        return tag.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [availableTags, value, searchQuery, useIds]);

  // Check if search query matches an existing tag
  const queryMatchesExisting = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return false;
    return availableTags.some((tag) => tag.name.toLowerCase() === query);
  }, [searchQuery, availableTags]);

  // Check if can create new tag
  const canCreateNew = useMemo(() => {
    if (!allowCreate || !searchQuery.trim()) return false;
    if (queryMatchesExisting) return false;
    if (maxTags && value.length >= maxTags) return false;
    // Check if already selected (case-insensitive)
    const query = searchQuery.trim().toLowerCase();
    return !value.some((v) => v.toLowerCase() === query);
  }, [allowCreate, searchQuery, queryMatchesExisting, maxTags, value]);

  // Add a tag
  const handleAddTag = useCallback(
    (tag: ProductTag) => {
      if (maxTags && value.length >= maxTags) return;

      const newValue = useIds ? tag.id : tag.name;
      if (!value.includes(newValue)) {
        onChange([...value, newValue]);
      }
      setSearchQuery('');
      setIsOpen(false);
    },
    [value, onChange, maxTags, useIds]
  );

  // Remove a tag
  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onChange(value.filter((v) => v !== tagToRemove));
    },
    [value, onChange]
  );

  // Create and add a new tag
  const handleCreateTag = useCallback(async () => {
    const name = searchQuery.trim();
    if (!name || !allowCreate) return;

    if (onCreateTag) {
      setIsCreating(true);
      try {
        const newTag = await onCreateTag(name, selectedColor);
        if (newTag) {
          handleAddTag(newTag);
        }
      } finally {
        setIsCreating(false);
      }
    } else {
      // No callback - just add as string
      if (!value.includes(name)) {
        onChange([...value, name]);
      }
      setSearchQuery('');
      setIsOpen(false);
    }
  }, [
    searchQuery,
    allowCreate,
    onCreateTag,
    selectedColor,
    handleAddTag,
    value,
    onChange,
  ]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canCreateNew && !isCreating) {
        e.preventDefault();
        handleCreateTag();
      }
      if (e.key === 'Backspace' && !searchQuery && value.length > 0) {
        e.preventDefault();
        handleRemoveTag(value[value.length - 1]);
      }
    },
    [canCreateNew, isCreating, handleCreateTag, searchQuery, value, handleRemoveTag]
  );

  const atMaxTags = maxTags ? value.length >= maxTags : false;

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground text-sm', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading tags...</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Selected tags display */}
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tagValue) => {
          const { name, color } = getTagInfo(tagValue);
          return (
            <Badge
              key={tagValue}
              variant="secondary"
              className={cn(
                'gap-1 text-xs pr-1',
                color && 'text-white border-transparent'
              )}
              style={color ? { backgroundColor: color } : undefined}
            >
              <Tag className="h-3 w-3" />
              {name}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tagValue)}
                  disabled={disabled}
                  className="ml-0.5 hover:opacity-70 disabled:opacity-50 rounded-full"
                  aria-label={`Remove tag ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}

        {/* Add tag button/input */}
        {!readOnly && !atMaxTags && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 text-xs px-2 border-dashed"
                disabled={disabled}
              >
                <Plus className="h-3 w-3" />
                {value.length === 0 ? placeholder : 'Add'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  ref={inputRef}
                  placeholder="Search tags..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  onKeyDown={handleKeyDown}
                />
                <CommandList>
                  {/* Available tags */}
                  {filteredTags.length > 0 && (
                    <CommandGroup heading="Available tags">
                      {filteredTags.map((tag) => (
                        <CommandItem
                          key={tag.id}
                          value={tag.name}
                          onSelect={() => handleAddTag(tag)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color || '#6B7280' }}
                          />
                          <span className="flex-1">{tag.name}</span>
                          {value.includes(useIds ? tag.id : tag.name) && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* Empty state */}
                  {filteredTags.length === 0 && !canCreateNew && (
                    <CommandEmpty>
                      {searchQuery
                        ? 'No tags found.'
                        : 'No more tags available.'}
                    </CommandEmpty>
                  )}

                  {/* Create new tag */}
                  {canCreateNew && (
                    <>
                      {filteredTags.length > 0 && <CommandSeparator />}
                      <CommandGroup heading="Create new tag">
                        <div className="p-2 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{searchQuery.trim()}</span>
                          </div>
                          {/* Color picker */}
                          <div className="flex items-center gap-1">
                            {TAG_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={cn(
                                  'h-5 w-5 rounded-full border-2 transition-transform',
                                  selectedColor === color
                                    ? 'scale-110 border-foreground'
                                    : 'border-transparent hover:scale-105'
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => setSelectedColor(color)}
                                aria-label={`Select color ${color}`}
                              />
                            ))}
                          </div>
                          <Button
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={handleCreateTag}
                            disabled={isCreating}
                          >
                            {isCreating ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Plus className="h-3 w-3 mr-1" />
                            )}
                            Create "{searchQuery.trim()}"
                          </Button>
                        </div>
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Max tags indicator */}
        {maxTags && (
          <span className="text-xs text-muted-foreground ml-1">
            {value.length}/{maxTags}
          </span>
        )}
      </div>
    </div>
  );
}

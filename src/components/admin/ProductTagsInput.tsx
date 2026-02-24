/**
 * ProductTagsInput Component
 *
 * A reusable input component for selecting and filtering product tags.
 * Features:
 * - Search/filter through available tags
 * - Multi-select support for filtering
 * - Create new tags inline with color picker
 * - Color-coded tag display
 * - Keyboard navigation support
 *
 * Usage:
 * ```tsx
 * <ProductTagsInput
 *   value={selectedTagIds}
 *   onChange={setSelectedTagIds}
 *   placeholder="Filter by tags..."
 * />
 * ```
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import X from "lucide-react/dist/esm/icons/x";
import Plus from "lucide-react/dist/esm/icons/plus";
import Tag from "lucide-react/dist/esm/icons/tag";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Search from "lucide-react/dist/esm/icons/search";
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  useProductTags,
  useCreateProductTag,
  type ProductTag,
} from '@/hooks/useProductTags';

// Preset colors for new tags
const TAG_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
];

interface ProductTagsInputProps {
  /** Currently selected tag IDs */
  value: string[];
  /** Called when selection changes */
  onChange: (tagIds: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Allow creating new tags */
  allowCreate?: boolean;
  /** Maximum tags that can be selected (undefined = unlimited) */
  maxTags?: number;
  /** Read-only mode */
  readOnly?: boolean;
  /** Show as compact chips or full dropdown */
  variant?: 'dropdown' | 'chips';
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'default';
}

export function ProductTagsInput({
  value,
  onChange,
  placeholder = 'Select tags...',
  allowCreate = true,
  maxTags,
  readOnly = false,
  variant = 'dropdown',
  className,
  size = 'default',
}: ProductTagsInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[8]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: allTags, isLoading: tagsLoading } = useProductTags();
  const createTag = useCreateProductTag();

  // Get selected tags with their details
  const selectedTags = useMemo(() => {
    if (!allTags) return [];
    return value
      .map((id) => allTags.find((tag) => tag.id === id))
      .filter((tag): tag is ProductTag => tag !== undefined);
  }, [allTags, value]);

  // Filter available tags based on search
  const filteredTags = useMemo(() => {
    if (!allTags) return [];
    let tags = allTags;

    if (search) {
      const searchLower = search.toLowerCase();
      tags = tags.filter((tag) =>
        tag.name.toLowerCase().includes(searchLower)
      );
    }

    return tags;
  }, [allTags, search]);

  // Check if tag name already exists
  const tagNameExists = useMemo(() => {
    if (!allTags || !newTagName.trim()) return false;
    return allTags.some(
      (tag) => tag.name.toLowerCase() === newTagName.trim().toLowerCase()
    );
  }, [allTags, newTagName]);

  // Check if we can add more tags
  const canAddMore = maxTags === undefined || value.length < maxTags;

  const handleToggleTag = useCallback(
    (tag: ProductTag) => {
      if (readOnly) return;

      const isSelected = value.includes(tag.id);
      if (isSelected) {
        onChange(value.filter((id) => id !== tag.id));
      } else if (canAddMore) {
        onChange([...value, tag.id]);
      }
    },
    [value, onChange, readOnly, canAddMore]
  );

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      if (readOnly) return;
      onChange(value.filter((id) => id !== tagId));
    },
    [value, onChange, readOnly]
  );

  const handleCreateTag = async () => {
    const trimmedName = newTagName.trim();
    if (!trimmedName || tagNameExists) return;

    try {
      const newTag = await createTag.mutateAsync({
        name: trimmedName,
        color: selectedColor,
      });
      if (newTag && canAddMore) {
        onChange([...value, newTag.id]);
        toast.success(`Tag "${trimmedName}" created`);
      }
      setNewTagName('');
      setSelectedColor(TAG_COLORS[8]);
      setShowCreateForm(false);
    } catch (error) {
      toast.error('Failed to create tag', { description: humanizeError(error) });
    }
  };

  const handleClearAll = () => {
    if (readOnly) return;
    onChange([]);
  };

  // Focus search input when popover opens
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isOpen && searchInputRef.current) {
      timer = setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    if (!isOpen) {
      setSearch('');
      setShowCreateForm(false);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  const isMutating = createTag.isPending;

  // Render compact chips variant
  if (variant === 'chips') {
    return (
      <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            className="gap-1 text-white text-xs cursor-default"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={isMutating}
                className="ml-0.5 hover:opacity-70 disabled:opacity-50"
                aria-label={`Remove tag ${tag.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {!readOnly && canAddMore && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 text-xs px-2"
                disabled={isMutating}
              >
                {isMutating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                <Tag className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <TagSelectorContent
                tags={filteredTags}
                selectedIds={value}
                search={search}
                onSearchChange={setSearch}
                onToggleTag={handleToggleTag}
                searchInputRef={searchInputRef}
                tagsLoading={tagsLoading}
                allowCreate={allowCreate}
                showCreateForm={showCreateForm}
                setShowCreateForm={setShowCreateForm}
                newTagName={newTagName}
                setNewTagName={setNewTagName}
                selectedColor={selectedColor}
                setSelectedColor={setSelectedColor}
                tagNameExists={tagNameExists}
                onCreateTag={handleCreateTag}
                isMutating={isMutating}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // Render dropdown variant (default)
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          disabled={readOnly || tagsLoading}
          className={cn(
            'justify-between min-w-[200px] font-normal',
            size === 'sm' && 'h-8 text-sm',
            selectedTags.length > 0 && 'border-primary/50 bg-primary/5',
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <Tag className={cn('h-4 w-4 text-muted-foreground', size === 'sm' && 'h-3.5 w-3.5')} />
            {selectedTags.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : selectedTags.length === 1 ? (
              <Badge
                className="text-white text-xs"
                style={{ backgroundColor: selectedTags[0].color }}
              >
                {selectedTags[0].name}
              </Badge>
            ) : (
              <span className="text-foreground">
                {selectedTags.length} tags selected
              </span>
            )}
          </span>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {selectedTags.length > 0 && !readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            {tagsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform text-muted-foreground',
                  isOpen && 'rotate-180'
                )}
              />
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <TagSelectorContent
          tags={filteredTags}
          selectedIds={value}
          search={search}
          onSearchChange={setSearch}
          onToggleTag={handleToggleTag}
          searchInputRef={searchInputRef}
          tagsLoading={tagsLoading}
          allowCreate={allowCreate}
          showCreateForm={showCreateForm}
          setShowCreateForm={setShowCreateForm}
          newTagName={newTagName}
          setNewTagName={setNewTagName}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          tagNameExists={tagNameExists}
          onCreateTag={handleCreateTag}
          isMutating={isMutating}
        />

        {selectedTags.length > 0 && (
          <div className="p-2 border-t border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {selectedTags.length} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-xs"
            >
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Internal component for the tag selector content
interface TagSelectorContentProps {
  tags: ProductTag[];
  selectedIds: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggleTag: (tag: ProductTag) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  tagsLoading: boolean;
  allowCreate: boolean;
  showCreateForm: boolean;
  setShowCreateForm: (show: boolean) => void;
  newTagName: string;
  setNewTagName: (name: string) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  tagNameExists: boolean;
  onCreateTag: () => void;
  isMutating: boolean;
}

function TagSelectorContent({
  tags,
  selectedIds,
  search,
  onSearchChange,
  onToggleTag,
  searchInputRef,
  tagsLoading,
  allowCreate,
  showCreateForm,
  setShowCreateForm,
  newTagName,
  setNewTagName,
  selectedColor,
  setSelectedColor,
  tagNameExists,
  onCreateTag,
  isMutating,
}: TagSelectorContentProps) {
  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search tags..."
            aria-label="Search tags"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Tag list */}
      <ScrollArea className="max-h-48">
        <div className="p-1">
          {tagsLoading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tags.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {search ? 'No tags found' : 'No tags available'}
            </div>
          ) : (
            tags.map((tag) => {
              const isSelected = selectedIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/50'
                  )}
                >
                  <div
                    className={cn(
                      'flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center',
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-input'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <Badge
                    className="text-white text-xs"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                  {(tag as unknown as Record<string, unknown>).description && (
                    <span className="text-xs text-muted-foreground truncate ml-auto">
                      {(tag as unknown as Record<string, unknown>).description}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Create new tag section */}
      {allowCreate && (
        <div className="border-t border-border">
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create new tag
            </button>
          ) : (
            <div className="p-3 space-y-2">
              <Input
                placeholder="Tag name..."
                aria-label="New tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onCreateTag();
                  }
                  if (e.key === 'Escape') {
                    setShowCreateForm(false);
                  }
                }}
                autoFocus
              />
              {tagNameExists && (
                <p className="text-xs text-destructive">
                  Tag with this name already exists
                </p>
              )}
              <div className="flex items-center gap-1">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-5 w-5 rounded-full border-2 transition-transform"
                    style={{
                      backgroundColor: color,
                      borderColor:
                        selectedColor === color ? 'white' : 'transparent',
                      transform:
                        selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow:
                        selectedColor === color
                          ? `0 0 0 1px ${color}`
                          : 'none',
                    }}
                    onClick={() => setSelectedColor(color)}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={onCreateTag}
                  disabled={!newTagName.trim() || tagNameExists || isMutating}
                >
                  {isMutating ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  Create
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTagName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

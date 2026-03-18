/**
 * CustomerTagFilter Component
 *
 * Filter component for customer list that allows filtering by assigned tags.
 * Supports multi-select filtering with visual tag badges.
 */

import { useState } from 'react';
import { Check, ChevronDown, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/command';
import { useTags } from '@/hooks/useCustomerTags';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerTagFilterProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  className?: string;
}

export function CustomerTagFilter({
  selectedTagIds,
  onTagsChange,
  className,
}: CustomerTagFilterProps) {
  const [open, setOpen] = useState(false);
  const { data: tags, isLoading } = useTags();

  const selectedTags = tags?.filter((tag) => selectedTagIds.includes(tag.id)) ?? [];

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const clearAll = () => {
    onTagsChange([]);
    setOpen(false);
  };

  if (isLoading) {
    return <Skeleton className="h-9 w-[140px]" />;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            aria-label="Filter by tags"
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Tags</span>
            {selectedTagIds.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-xs font-normal"
              >
                {selectedTagIds.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {tags?.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => toggleTag(tag.id)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      <Badge
                        className="text-white text-xs"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {selectedTagIds.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={clearAll}
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected tags display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              className="gap-1 text-white text-xs cursor-pointer hover:opacity-80"
              style={{ backgroundColor: tag.color }}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

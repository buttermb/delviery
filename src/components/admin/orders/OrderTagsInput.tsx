/**
 * OrderTagsInput Component
 *
 * Provides tag management UI for order categorization:
 * - View and manage tags assigned to an order
 * - Create new tags inline
 * - Assign/remove tags with visual feedback
 * - Color-coded tag display
 */

import { useState } from 'react';
import X from "lucide-react/dist/esm/icons/x";
import Plus from "lucide-react/dist/esm/icons/plus";
import Tag from "lucide-react/dist/esm/icons/tag";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useTags,
  useCreateTag,
} from '@/hooks/useCustomerTags';
import {
  useOrderTags,
  useAssignOrderTag,
  useRemoveOrderTag,
} from '@/hooks/useOrderTags';
import type { Tag as TagType } from '@/hooks/useCustomerTags';

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

interface OrderTagsInputProps {
  orderId: string;
  readOnly?: boolean;
  compact?: boolean;
}

export function OrderTagsInput({ orderId, readOnly = false, compact = false }: OrderTagsInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[8]);

  const { data: allTags, isLoading: tagsLoading } = useTags();
  const { data: orderTags, isLoading: orderTagsLoading } = useOrderTags(orderId);
  const createTag = useCreateTag();
  const assignTag = useAssignOrderTag();
  const removeTag = useRemoveOrderTag();

  const assignedTagIds = new Set(orderTags?.map((ot) => ot.tag_id) || []);
  const availableTags = allTags?.filter((tag) => !assignedTagIds.has(tag.id)) || [];

  const handleAssignTag = async (tag: TagType) => {
    try {
      await assignTag.mutateAsync({ orderId, tagId: tag.id });
      toast.success(`Tag "${tag.name}" added`);
    } catch {
      toast.error('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: string, tagName: string) => {
    try {
      await removeTag.mutateAsync({ orderId, tagId });
      toast.success(`Tag "${tagName}" removed`);
    } catch {
      toast.error('Failed to remove tag');
    }
  };

  const handleCreateAndAssign = async () => {
    const trimmedName = newTagName.trim();
    if (!trimmedName) return;

    try {
      const newTag = await createTag.mutateAsync({
        name: trimmedName,
        color: selectedColor,
      });
      if (newTag) {
        await assignTag.mutateAsync({ orderId, tagId: newTag.id });
        toast.success(`Tag "${trimmedName}" created and added`);
      }
      setNewTagName('');
      setSelectedColor(TAG_COLORS[8]);
    } catch {
      toast.error('Failed to create tag');
    }
  };

  const isLoading = tagsLoading || orderTagsLoading;
  const isMutating = createTag.isPending || assignTag.isPending || removeTag.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading tags...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {orderTags?.map((ot) => {
        const tag = ot.tag;
        if (!tag) return null;
        return (
          <Badge
            key={ot.id}
            className={`gap-1 text-white cursor-default ${compact ? 'text-[10px] px-1.5 py-0' : 'text-xs'}`}
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {!readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag.id, tag.name);
                }}
                disabled={isMutating}
                className="ml-0.5 hover:opacity-70 disabled:opacity-50"
                aria-label={`Remove tag ${tag.name}`}
              >
                <X className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
              </button>
            )}
          </Badge>
        );
      })}

      {!readOnly && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`gap-1 px-2 ${compact ? 'h-5 text-[10px]' : 'h-6 text-xs'}`}
              disabled={isMutating}
              onClick={(e) => e.stopPropagation()}
            >
              {isMutating ? (
                <Loader2 className={compact ? 'h-2.5 w-2.5 animate-spin' : 'h-3 w-3 animate-spin'} />
              ) : (
                <Plus className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
              )}
              <Tag className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3">
              {/* Existing tags to assign */}
              {availableTags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Available tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        className="cursor-pointer text-white text-xs hover:opacity-80"
                        style={{ backgroundColor: tag.color }}
                        onClick={() => handleAssignTag(tag)}
                      >
                        <Plus className="h-2.5 w-2.5 mr-0.5" />
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Create new tag */}
              <div className="space-y-1.5 border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Create new tag
                </p>
                <Input
                  placeholder="Tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateAndAssign();
                    }
                  }}
                />
                <div className="flex items-center gap-1">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="h-4 w-4 rounded-full border-2 transition-transform"
                      style={{
                        backgroundColor: color,
                        borderColor: selectedColor === color ? 'white' : 'transparent',
                        transform: selectedColor === color ? 'scale(1.2)' : 'scale(1)',
                        boxShadow: selectedColor === color ? `0 0 0 1px ${color}` : 'none',
                      }}
                      onClick={() => setSelectedColor(color)}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={handleCreateAndAssign}
                  disabled={!newTagName.trim() || createTag.isPending}
                >
                  {createTag.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  Create & Add
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Show placeholder when no tags and read-only */}
      {readOnly && (!orderTags || orderTags.length === 0) && (
        <span className="text-xs text-muted-foreground">No tags</span>
      )}
    </div>
  );
}

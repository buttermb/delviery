/**
 * TagManager Component
 *
 * Provides tag management UI for customer contacts:
 * - View and manage tags for a contact
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
  useContactTags,
  useCreateTag,
  useAssignTag,
  useRemoveTag,
} from '@/hooks/useCustomerTags';
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

interface TagManagerProps {
  contactId: string;
  readOnly?: boolean;
}

export function TagManager({ contactId, readOnly = false }: TagManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[8]);

  const { data: allTags, isLoading: tagsLoading } = useTags();
  const { data: contactTags, isLoading: contactTagsLoading } = useContactTags(contactId);
  const createTag = useCreateTag();
  const assignTag = useAssignTag();
  const removeTag = useRemoveTag();

  const assignedTagIds = new Set(contactTags?.map((ct) => ct.tag_id) || []);
  const availableTags = allTags?.filter((tag) => !assignedTagIds.has(tag.id)) || [];

  const handleAssignTag = async (tag: TagType) => {
    try {
      await assignTag.mutateAsync({ contactId, tagId: tag.id });
      toast.success(`Tag "${tag.name}" added`);
    } catch {
      toast.error('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: string, tagName: string) => {
    try {
      await removeTag.mutateAsync({ contactId, tagId });
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
        await assignTag.mutateAsync({ contactId, tagId: newTag.id });
        toast.success(`Tag "${trimmedName}" created and added`);
      }
      setNewTagName('');
      setSelectedColor(TAG_COLORS[8]);
    } catch {
      toast.error('Failed to create tag');
    }
  };

  const isLoading = tagsLoading || contactTagsLoading;
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
      {contactTags?.map((ct) => {
        const tag = ct.tag;
        if (!tag) return null;
        return (
          <Badge
            key={ct.id}
            className="gap-1 text-white text-xs cursor-default"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id, tag.name)}
                disabled={isMutating}
                className="ml-0.5 hover:opacity-70 disabled:opacity-50"
                aria-label={`Remove tag ${tag.name}`}
              >
                <X className="h-3 w-3" />
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
          <PopoverContent className="w-64 p-3" align="start">
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
    </div>
  );
}

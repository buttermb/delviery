/**
 * ProductTagsManager
 *
 * Full CRUD management UI for product tags.
 * Allows creating, editing, and deleting tags.
 * Tags are displayed as colored chips.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Pencil from 'lucide-react/dist/esm/icons/pencil';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Tag from 'lucide-react/dist/esm/icons/tag';
import {
  useProductTags,
  useCreateProductTag,
  useUpdateProductTag,
  useDeleteProductTag,
  TAG_COLORS,
  type ProductTag,
} from '@/hooks/useProductTags';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface ProductTagsManagerProps {
  className?: string;
}

export function ProductTagsManager({ className }: ProductTagsManagerProps) {
  const { data: tags, isLoading, error } = useProductTags();
  const createTag = useCreateProductTag();
  const updateTag = useUpdateProductTag();
  const deleteTag = useDeleteProductTag();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ProductTag | null>(null);
  const [deletingTag, setDeletingTag] = useState<ProductTag | null>(null);

  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].value);

  const resetForm = useCallback(() => {
    setTagName('');
    setTagColor(TAG_COLORS[0].value);
  }, []);

  const handleOpenCreate = useCallback(() => {
    resetForm();
    setIsCreateDialogOpen(true);
  }, [resetForm]);

  const handleOpenEdit = useCallback((tag: ProductTag) => {
    setTagName(tag.name);
    setTagColor(tag.color);
    setEditingTag(tag);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!tagName.trim()) return;

    try {
      await createTag.mutateAsync({
        name: tagName,
        color: tagColor,
      });
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (err) {
      logger.error('Error creating tag', err);
    }
  }, [tagName, tagColor, createTag, resetForm]);

  const handleUpdate = useCallback(async () => {
    if (!editingTag || !tagName.trim()) return;

    try {
      await updateTag.mutateAsync({
        id: editingTag.id,
        name: tagName,
        color: tagColor,
      });
      setEditingTag(null);
      resetForm();
    } catch (err) {
      logger.error('Error updating tag', err);
    }
  }, [editingTag, tagName, tagColor, updateTag, resetForm]);

  const handleDelete = useCallback(async () => {
    if (!deletingTag) return;

    try {
      await deleteTag.mutateAsync(deletingTag.id);
      setDeletingTag(null);
    } catch (err) {
      logger.error('Error deleting tag', err);
    }
  }, [deletingTag, deleteTag]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Tag className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Failed to load tags. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Product Tags
            </CardTitle>
            <CardDescription>
              Create and manage tags to organize your products
            </CardDescription>
          </div>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Tag
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !tags || tags.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="mb-2">No tags created yet</p>
            <p className="text-sm">Create your first tag to start organizing products</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                style={{ borderColor: tag.color }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span>{tag.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenEdit(tag)}
                    className="p-0.5 rounded hover:bg-background"
                    aria-label={`Edit ${tag.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setDeletingTag(tag)}
                    className="p-0.5 rounded hover:bg-background text-destructive"
                    aria-label={`Delete ${tag.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Add a new tag to organize your products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag Name</Label>
              <Input
                id="tag-name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Enter tag name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setTagColor(color.value)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                      tagColor === color.value
                        ? 'border-foreground scale-110'
                        : 'border-transparent'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    aria-label={`Select ${color.name} color`}
                  />
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Label className="text-muted-foreground">Preview</Label>
              <div className="mt-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
                  style={{ borderColor: tagColor }}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tagColor }}
                  />
                  {tagName || 'Tag Preview'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!tagName.trim() || createTag.isPending}
            >
              {createTag.isPending ? 'Creating...' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the tag name or color
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">Tag Name</Label>
              <Input
                id="edit-tag-name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Enter tag name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setTagColor(color.value)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                      tagColor === color.value
                        ? 'border-foreground scale-110'
                        : 'border-transparent'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    aria-label={`Select ${color.name} color`}
                  />
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Label className="text-muted-foreground">Preview</Label>
              <div className="mt-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
                  style={{ borderColor: tagColor }}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tagColor }}
                  />
                  {tagName || 'Tag Preview'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTag(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!tagName.trim() || updateTag.isPending}
            >
              {updateTag.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!deletingTag}
        onOpenChange={(open) => !open && setDeletingTag(null)}
        onConfirm={handleDelete}
        title="Delete Tag?"
        description={`Are you sure you want to delete the tag "${deletingTag?.name}"? This will remove it from all products. This action cannot be undone.`}
        itemName={deletingTag?.name}
        itemType="tag"
        isLoading={deleteTag.isPending}
      />
    </Card>
  );
}

export default ProductTagsManager;

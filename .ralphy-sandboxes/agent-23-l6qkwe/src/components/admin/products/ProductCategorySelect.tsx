import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Search from "lucide-react/dist/esm/icons/search";
import FolderTree from "lucide-react/dist/esm/icons/folder-tree";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import { useCategoryTree, useFlattenedCategories, type CategoryTreeNode } from '@/hooks/useCategories';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';

// Alias for backward compatibility
type CategoryNode = CategoryTreeNode;

interface ProductCategorySelectProps {
  /** Currently selected category ID */
  value?: string;
  /** Callback when category changes - receives category ID */
  onChange: (categoryId: string) => void;
  /** Placeholder text when nothing selected */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name for the trigger button */
  className?: string;
  /** Whether to show the full path in the trigger */
  showPath?: boolean;
  /** Allow selecting parent categories (not just leaves) */
  allowParentSelection?: boolean;
}

/**
 * ProductCategorySelect - Hierarchical category selector for products
 *
 * Features:
 * - Displays categories in a tree structure with expand/collapse
 * - Search within categories
 * - Shows full category path when selected
 * - Integrates with tenant context for multi-tenant support
 *
 * @example
 * <ProductCategorySelect
 *   value={formData.category_id}
 *   onChange={(id) => setFormData({ ...formData, category_id: id })}
 *   placeholder="Select category"
 * />
 */
export function ProductCategorySelect({
  value,
  onChange,
  placeholder = 'Select category...',
  disabled = false,
  className,
  showPath = true,
  allowParentSelection = true,
}: ProductCategorySelectProps) {
  const { tenant: _tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Use the tree and flattened hooks
  const { data: tree = [], isLoading: treeLoading, isError } = useCategoryTree();
  const { data: flattened = [] } = useFlattenedCategories();
  const isLoading = treeLoading;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!_tenant?.id) throw new Error('Tenant ID missing');
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)
        .eq('tenant_id', _tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Category deleted successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      // If the deleted category was the currently selected value, clear it
      if (categoryToDelete && value === categoryToDelete.id) {
        onChange('');
      }
    },
    onError: (error: Error) => {
      logger.error('Failed to delete category', { error: error.message });
      toast.error('Failed to delete category', { description: humanizeError(error) });
    },
  });

  const handleDeleteCategory = useCallback((e: React.MouseEvent, categoryId: string, categoryName: string) => {
    e.stopPropagation();
    setCategoryToDelete({ id: categoryId, name: categoryName });
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteCategory = useCallback(() => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete.id);
    }
  }, [categoryToDelete, deleteCategoryMutation]);

  // Find selected category info
  const selectedCategory = useMemo(() => {
    if (!value) return null;
    return flattened.find((c) => c.id === value);
  }, [value, flattened]);

  // Filter categories by search
  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;

    const query = search.toLowerCase();
    const categoryById = new Map(flattened.map((cat) => [cat.id, cat]));

    // Find all matching categories and their ancestors
    const matchingIds = new Set<string>();
    const ancestorIds = new Set<string>();

    flattened.forEach((cat) => {
      if (
        cat.name.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query)
      ) {
        matchingIds.add(cat.id);

        // Add all ancestors to ensure path is visible
        let current = cat.parent_id ? categoryById.get(cat.parent_id) : undefined;
        while (current) {
          ancestorIds.add(current.id);
          current = current.parent_id ? categoryById.get(current.parent_id) : undefined;
        }
      }
    });

    // Filter tree to only include matching categories and their ancestors
    const filterNodes = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes
        .filter((node) => matchingIds.has(node.id) || ancestorIds.has(node.id))
        .map((node) => ({
          ...node,
          children: filterNodes(node.children),
        }));
    };

    return filterNodes(tree);
  }, [tree, flattened, search]);

  // Auto-expand when searching
  const effectiveExpandedIds = useMemo(() => {
    if (search.trim()) {
      // When searching, expand all filtered categories
      return new Set(filteredTree.flatMap((node) => {
        const ids: string[] = [node.id];
        const collectIds = (n: CategoryNode) => {
          n.children.forEach((child) => {
            ids.push(child.id);
            collectIds(child);
          });
        };
        collectIds(node);
        return ids;
      }));
    }
    return expandedIds;
  }, [search, filteredTree, expandedIds]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (categoryId: string, hasChildren: boolean) => {
      if (!allowParentSelection && hasChildren) {
        // Just expand/collapse if parent selection not allowed
        toggleExpand(categoryId);
        return;
      }

      onChange(categoryId);
      setOpen(false);
      setSearch('');
    },
    [onChange, allowParentSelection, toggleExpand]
  );

  // Render a category node recursively
  const renderNode = (node: CategoryNode, level = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = effectiveExpandedIds.has(node.id);
    const isSelected = value === node.id;

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => handleSelect(node.id, hasChildren)}
          className={cn(
            'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm group',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none',
            isSelected && 'bg-accent font-medium'
          )}
          style={{ paddingLeft: `${8 + level * 16}px` }}
        >
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4.5" /> // Spacer for alignment
          )}

          {/* Category name */}
          <span className="flex-1 text-left truncate">{node.name}</span>

          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => handleDeleteCategory(e, node.id, node.name)}
            className="p-0.5 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete category"
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>

          {/* Checkmark for selected */}
          {isSelected && <Check className="h-4 w-4 shrink-0" />}
        </button>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Display text for the trigger button
  const displayText = useMemo(() => {
    if (!selectedCategory) return placeholder;
    return showPath ? selectedCategory.path : selectedCategory.name;
  }, [selectedCategory, placeholder, showPath]);

  // Handle empty state (no categories defined)
  const isEmpty = !isLoading && tree.length === 0;

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn('w-full justify-between font-normal', className)}
        >
          {isLoading ? (
            <span className="text-muted-foreground">Loading...</span>
          ) : (
            <span className={cn('truncate', !selectedCategory && 'text-muted-foreground')}>
              {displayText}
            </span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Search input */}
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

        <ScrollArea className="max-h-[300px]">
          <div className="p-1">
            {/* Loading state */}
            {isLoading && (
              <div className="space-y-2 p-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4 ml-4" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4 ml-4" />
              </div>
            )}

            {/* Error state */}
            {isError && (
              <div className="py-6 text-center">
                <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                <p className="text-sm text-muted-foreground">
                  Failed to load categories
                </p>
              </div>
            )}

            {/* Empty state */}
            {isEmpty && !isError && (
              <div className="py-6 text-center">
                <FolderTree className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No categories defined
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create categories in Catalog &gt; Categories
                </p>
              </div>
            )}

            {/* No search results */}
            {!isLoading && !isEmpty && filteredTree.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No categories found
              </div>
            )}

            {/* Category tree */}
            {!isLoading && !isError && filteredTree.length > 0 && (
              <div className="space-y-0.5">
                {filteredTree.map((node) => renderNode(node))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>

    <ConfirmDeleteDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      onConfirm={confirmDeleteCategory}
      isLoading={deleteCategoryMutation.isPending}
      title="Delete Category"
      description={`Are you sure you want to delete "${categoryToDelete?.name}"? Products in this category will become uncategorized. This action cannot be undone.`}
      itemName={categoryToDelete?.name}
      itemType="category"
    />
    </>
  );
}

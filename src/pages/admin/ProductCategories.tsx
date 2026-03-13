/**
 * ProductCategories Management Page
 *
 * Manage product categories for organizing inventory.
 * - Create, edit, delete categories
 * - Set category-specific settings (margins, defaults)
 * - View product count per category
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Layers, Plus, MoreVertical, Edit, Trash2, Package } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Category {
  id: string;
  name: string;
  description: string | null;
  product_count: number;
  created_at: string;
}

export function ProductCategories() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  // Fetch categories with product counts
  const { data: categories, isLoading } = useQuery({
    queryKey: [...queryKeys.products.all, 'categories', tenantId],
    queryFn: async (): Promise<Category[]> => {
      if (!tenantId) return [];

      // Get unique categories from products table
      const { data: products, error } = await supabase
        .from('products')
        .select('category')
        .eq('tenant_id', tenantId)
        .not('category', 'is', null);

      if (error) {
        logger.error('Failed to fetch categories', error, {
          component: 'ProductCategories',
          tenantId,
        });
        throw new Error(error.message);
      }

      // Count products per category
      const categoryMap = new Map<string, number>();
      (products ?? []).forEach((p) => {
        const cat = p.category as string;
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      });

      // Convert to array and sort by product count
      return Array.from(categoryMap.entries())
        .map(([name, count]) => ({
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          description: null,
          product_count: count,
          created_at: new Date().toISOString(),
        }))
        .sort((a, b) => b.product_count - a.product_count);
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  // Create/Update category mutation (updates all products with old category name to new name)
  const saveMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName?: string; newName: string }) => {
      if (!tenantId) throw new Error('No tenant context');

      // If editing, update all products with the old category name
      if (oldName && oldName !== newName) {
        const { error } = await supabase
          .from('products')
          .update({ category: newName })
          .eq('tenant_id', tenantId)
          .eq('category', oldName);

        if (error) throw error;
      }

      return { oldName, newName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(
        data.oldName ? `Category renamed from "${data.oldName}" to "${data.newName}"` : `Category "${data.newName}" will be available when products are added`
      );
      resetForm();
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to save category'));
      logger.error('Failed to save category', error, { component: 'ProductCategories' });
    },
  });

  // Delete category mutation (sets category to null for affected products)
  const deleteMutation = useMutation({
    mutationFn: async (categoryName: string) => {
      if (!tenantId) throw new Error('No tenant context');

      // Set category to null for all products with this category
      const { error } = await supabase
        .from('products')
        .update({ category: null })
        .eq('tenant_id', tenantId)
        .eq('category', categoryName);

      if (error) throw error;
      return categoryName;
    },
    onSuccess: (categoryName) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(`Category "${categoryName}" deleted. Products uncategorized.`);
      setDeletingCategory(null);
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to delete category'));
      logger.error('Failed to delete category', error, { component: 'ProductCategories' });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setShowCreateDialog(false);
    setEditingCategory(null);
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    saveMutation.mutate({ newName: formData.name.trim() });
  };

  const handleEdit = () => {
    if (!editingCategory || !formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    saveMutation.mutate({
      oldName: editingCategory.name,
      newName: formData.name.trim(),
    });
  };

  const handleDelete = () => {
    if (deletingCategory) {
      deleteMutation.mutate(deletingCategory.name);
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize products into categories for easier management
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {categories && categories.length === 0 ? (
        <Card className="p-12 text-center">
          <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Categories Yet</h3>
          <p className="text-muted-foreground mb-4">
            Categories are automatically created when you add products. Or create one now.
          </p>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create First Category
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {categories?.map((category) => (
            <Card key={category.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Layers className="h-5 w-5 text-primary flex-shrink-0" />
                  <CardTitle className="text-lg truncate">{category.name}</CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(category)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeletingCategory(category)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>
                      {category.product_count} product{category.product_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Badge variant="secondary">{category.product_count}</Badge>
                </div>
                {category.description && (
                  <p className="text-sm text-muted-foreground mt-2">{category.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Category Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new category to organize your products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Flower, Edibles, Concentrates"
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="category-description">Description (Optional)</Label>
              <Input
                id="category-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={() => resetForm()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Category</DialogTitle>
              <DialogDescription>
                Renaming will update all products in this category
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-category-name">Category Name *</Label>
                <Input
                  id="edit-category-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Category name"
                  maxLength={50}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingCategory}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        title="Delete Category?"
        description={`This will remove the category "${deletingCategory?.name}" from ${deletingCategory?.product_count} product(s). The products will become uncategorized. This action cannot be undone.`}
        confirmText="Delete Category"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

export default ProductCategories;

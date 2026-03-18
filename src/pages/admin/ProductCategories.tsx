/**
 * ProductCategories Management Page
 *
 * Manage product categories for organizing inventory.
 * - Create, edit, delete categories with proper CRUD against the categories table
 * - Set parent categories for hierarchical organization
 * - View product count per category
 * - Search/filter categories
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { handleError } from '@/utils/errorHandling/handlers';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Layers, Plus, MoreVertical, Edit, Trash2, Package, Search } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

// --- Types ---

interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CategoryWithCount extends Category {
  product_count: number;
}

// --- Form Schema ---

const categoryFormSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Name must be under 100 characters'),
  description: z.string().max(500, 'Description must be under 500 characters').optional().or(z.literal('')),
  parent_id: z.string().nullable(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

// --- Component ---

export function ProductCategories() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryWithCount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // --- Form ---

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
      parent_id: null,
    },
  });

  useEffect(() => {
    if (editingCategory) {
      form.reset({
        name: editingCategory.name,
        description: editingCategory.description ?? '',
        parent_id: editingCategory.parent_id,
      });
    } else if (showDialog) {
      form.reset({ name: '', description: '', parent_id: null });
    }
  }, [editingCategory, showDialog, form]);

  // --- Queries ---

  const { data: categories, isLoading } = useQuery({
    queryKey: queryKeys.categories.list(tenantId),
    queryFn: async (): Promise<Category[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('categories')
        .select('id, tenant_id, name, description, parent_id, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error && error.code === '42P01') {
        logger.warn('Categories table does not exist', { error });
        return [];
      }

      if (error) {
        logger.error('Failed to fetch categories', { error, component: 'ProductCategories' });
        throw error;
      }

      return (data ?? []) as Category[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
    retry: 2,
  });

  // Fetch product counts per category
  const { data: productCounts } = useQuery({
    queryKey: [...queryKeys.categories.list(tenantId), 'product-counts'],
    queryFn: async () => {
      if (!tenantId || !categories || categories.length === 0) return new Map<string, number>();

      const { data: products, error } = await supabase
        .from('products')
        .select('category_id')
        .eq('tenant_id', tenantId)
        .not('category_id', 'is', null);

      if (error && error.code !== '42P01') {
        logger.warn('Failed to fetch products for category counts', { error });
      }

      const counts = new Map<string, number>();
      (products ?? []).forEach(p => {
        if (p.category_id) {
          counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
        }
      });
      return counts;
    },
    enabled: !!tenantId && !!categories && categories.length > 0,
    staleTime: 30_000,
    retry: 2,
  });

  // --- Derived Data ---

  const categoriesWithCounts = useMemo((): CategoryWithCount[] => {
    if (!categories) return [];
    return categories.map(cat => ({
      ...cat,
      product_count: productCounts?.get(cat.id) ?? 0,
    }));
  }, [categories, productCounts]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categoriesWithCounts;
    const query = searchQuery.toLowerCase();
    return categoriesWithCounts.filter(
      cat =>
        cat.name.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query)
    );
  }, [categoriesWithCounts, searchQuery]);

  const totalProducts = useMemo(() => {
    if (!productCounts) return 0;
    let total = 0;
    productCounts.forEach(count => { total += count; });
    return total;
  }, [productCounts]);

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await supabase
        .from('categories')
        .insert({
          name: values.name,
          description: values.description || null,
          parent_id: values.parent_id,
          tenant_id: tenantId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      toast.success('Category created');
      closeDialog();
    },
    onError: (error) => {
      handleError(error, { component: 'ProductCategories', toastTitle: 'Failed to create category' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CategoryFormValues }) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await supabase
        .from('categories')
        .update({
          name: values.name,
          description: values.description || null,
          parent_id: values.parent_id,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      toast.success('Category updated');
      closeDialog();
    },
    onError: (error) => {
      handleError(error, { component: 'ProductCategories', toastTitle: 'Failed to update category' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('No tenant context');

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Category deleted');
      setDeleteDialogOpen(false);
      setDeletingCategory(null);
    },
    onError: (error) => {
      handleError(error, { component: 'ProductCategories', toastTitle: 'Failed to delete category' });
    },
  });

  // --- Handlers ---

  const closeDialog = useCallback(() => {
    setShowDialog(false);
    setEditingCategory(null);
    form.reset({ name: '', description: '', parent_id: null });
  }, [form]);

  const openCreateDialog = useCallback(() => {
    setEditingCategory(null);
    setShowDialog(true);
  }, []);

  const openEditDialog = useCallback((category: CategoryWithCount) => {
    setEditingCategory(category);
    setShowDialog(true);
  }, []);

  const openDeleteDialog = useCallback((category: CategoryWithCount) => {
    setDeletingCategory(category);
    setDeleteDialogOpen(true);
  }, []);

  const onSubmit = useCallback((values: CategoryFormValues) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, values });
    } else {
      createMutation.mutate(values);
    }
  }, [editingCategory, updateMutation, createMutation]);

  const isFormPending = createMutation.isPending || updateMutation.isPending;

  // Build delete description
  const deleteDescription = useMemo(() => {
    if (!deletingCategory) return undefined;
    const count = deletingCategory.product_count;
    if (count > 0) {
      return `Are you sure you want to delete "${deletingCategory.name}"? ${count} product${count === 1 ? '' : 's'} will have their category removed. This action cannot be undone.`;
    }
    return undefined;
  }, [deletingCategory]);

  // --- Render ---

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize products into categories for easier management
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{categories?.length ?? 0}</div>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalProducts}</div>
                <p className="text-xs text-muted-foreground">Categorized Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      {categoriesWithCounts.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search categories"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Categories Grid */}
      {filteredCategories.length === 0 && !searchQuery ? (
        <EnhancedEmptyState
          icon={Layers}
          title="No Categories Yet"
          description="Create your first category to organize products."
          primaryAction={{
            label: 'Create First Category',
            onClick: openCreateDialog,
            icon: Plus,
          }}
          compact
          designSystem="tenant-admin"
        />
      ) : filteredCategories.length === 0 && searchQuery ? (
        <EnhancedEmptyState
          icon={Search}
          title="No Matching Categories"
          description={`No categories found for "${searchQuery}".`}
          primaryAction={{
            label: 'Clear Search',
            onClick: () => setSearchQuery(''),
          }}
          compact
          designSystem="tenant-admin"
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="transition-colors hover:bg-accent/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Layers className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        aria-label={`Actions for ${category.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(category)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(category)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>
                    {category.product_count} product{category.product_count !== 1 ? 's' : ''}
                  </span>
                  {category.parent_id && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      Sub-category
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Category Dialog */}
      <Dialog open={showDialog || !!editingCategory} onOpenChange={(open) => {
        if (!open) closeDialog();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'New Category'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Flower, Edibles, Concentrates"
                        maxLength={100}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional category description..."
                        maxLength={500}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Category</FormLabel>
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(value) => {
                        field.onChange(value === '__none__' ? null : value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None (top-level)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None (top-level)</SelectItem>
                        {categories
                          ?.filter(c => c.id !== editingCategory?.id)
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isFormPending}>
                  {isFormPending
                    ? (editingCategory ? 'Saving...' : 'Creating...')
                    : (editingCategory ? 'Save Changes' : 'Create Category')
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (deletingCategory) {
            deleteMutation.mutate(deletingCategory.id);
          }
        }}
        itemName={deletingCategory?.name}
        itemType="category"
        description={deleteDescription}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

export default ProductCategories;

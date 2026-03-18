import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { TruncatedText } from '@/components/shared/TruncatedText';
import {
  Plus,
  Search,
  Tag,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  ArrowLeft,
  Package,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { queryKeys } from '@/lib/queryKeys';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { handleError } from '@/utils/errorHandling/handlers';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { logger } from '@/lib/logger';

// --- Types ---

interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  children?: Category[];
}

interface CategoryWithProductCount extends Category {
  productCount: number;
}

// --- Form Schema ---

const categoryFormSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Name must be under 100 characters'),
  description: z.string().max(500, 'Description must be under 500 characters').optional().or(z.literal('')),
  parent_id: z.string().nullable(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

// --- Component ---

export default function CategoriesPage() {
  const { navigateToAdmin, navigate, tenantSlug } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithProductCount | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  // --- Form ---

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
      parent_id: null,
    },
  });

  // Reset form when dialog opens/closes or editing category changes
  useEffect(() => {
    if (editingCategory) {
      form.reset({
        name: editingCategory.name,
        description: editingCategory.description ?? '',
        parent_id: editingCategory.parent_id,
      });
    } else if (dialogOpen) {
      form.reset({ name: '', description: '', parent_id: null });
    }
  }, [editingCategory, dialogOpen, form]);

  // --- Queries ---

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: queryKeys.categories.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, tenant_id, name, description, parent_id, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .order('name', { ascending: true });

        if (error && error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        if (error) throw error;
        setTableMissing(false);
        return (data ?? []) as Category[];
      } catch (error) {
        if ((error as { code?: string })?.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        handleError(error, { component: 'CategoriesPage', toastTitle: 'Failed to load categories' });
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Fetch product counts per category
  const { data: productCounts } = useQuery({
    queryKey: [...queryKeys.categories.list(tenantId), 'product-counts'],
    queryFn: async () => {
      if (!tenantId || !categories || categories.length === 0) return new Map<string, number>();

      try {
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
      } catch (error) {
        logger.error('Failed to calculate product counts', { error });
        return new Map<string, number>();
      }
    },
    enabled: !!tenantId && !!categories && categories.length > 0,
    staleTime: 30000,
  });

  // --- Tree Building ---

  const buildCategoryTree = useCallback((categoriesList: Category[]): CategoryWithProductCount[] => {
    const categoryMap = new Map<string, CategoryWithProductCount>();
    const rootCategories: CategoryWithProductCount[] = [];

    categoriesList.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [],
        productCount: productCounts?.get(cat.id) ?? 0,
      });
    });

    categoriesList.forEach(cat => {
      const category = categoryMap.get(cat.id);
      if (category && cat.parent_id && categoryMap.has(cat.parent_id)) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children = parent.children ?? [];
          parent.children.push(category);
        }
      } else if (category) {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  }, [productCounts]);

  // --- Mutations ---

  const createCategory = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      if (!tenantId) throw new Error('Tenant ID missing');

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
      toast.success('Category created');
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      closeDialog();
    },
    onError: (error) => {
      handleError(error, { component: 'CategoriesPage', toastTitle: 'Failed to create category' });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CategoryFormValues }) => {
      if (!tenantId) throw new Error('Tenant ID missing');

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
      toast.success('Category updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      closeDialog();
    },
    onError: (error) => {
      handleError(error, { component: 'CategoriesPage', toastTitle: 'Failed to update category' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant ID missing');

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Category deleted');
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: (error) => {
      handleError(error, { component: 'CategoriesPage', toastTitle: 'Failed to delete category' });
    },
  });

  // --- Handlers ---

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingCategory(null);
    form.reset({ name: '', description: '', parent_id: null });
  }, [form]);

  const openCreateDialog = useCallback(() => {
    setEditingCategory(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((category: Category) => {
    setEditingCategory(category);
    setDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((category: CategoryWithProductCount) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  }, []);

  const onSubmit = useCallback((values: CategoryFormValues) => {
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, values });
    } else {
      createCategory.mutate(values);
    }
  }, [editingCategory, updateCategory, createCategory]);

  const toggleCategory = useCallback((id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const navigateToFilteredProducts = useCallback((categoryId: string) => {
    const basePath = tenantSlug ? `/${tenantSlug}` : '';
    navigate(`${basePath}/admin/products?category_id=${categoryId}`);
  }, [navigate, tenantSlug]);

  // --- Derived Data ---

  const filteredCategories = useMemo(() => {
    return categories?.filter(cat =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? [];
  }, [categories, searchQuery]);

  const categoryTree = useMemo(
    () => buildCategoryTree(filteredCategories),
    [buildCategoryTree, filteredCategories]
  );

  const totalProducts = useMemo(() => {
    if (!productCounts) return 0;
    let total = 0;
    productCounts.forEach(count => { total += count; });
    return total;
  }, [productCounts]);

  const isFormPending = createCategory.isPending || updateCategory.isPending;

  // --- Render Helpers ---

  const renderCategory = (category: CategoryWithProductCount, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div key={category.id} className="mb-2">
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
            level > 0 ? 'ml-6' : ''
          }`}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => toggleCategory(category.id)}
              aria-label={isExpanded ? 'Collapse category' : 'Expand category'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-8 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <TruncatedText text={category.name} className="font-medium" as="p" />
            {category.description && (
              <TruncatedText text={category.description} className="text-sm text-muted-foreground" as="p" />
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
            <Package className="h-4 w-4" />
            <span>{category.productCount} products</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateToFilteredProducts(category.id)}
              title="View products"
              aria-label="View products"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openEditDialog(category)}
              aria-label="Edit category"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openDeleteDialog(category)}
              aria-label="Delete category"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-6 mt-2">
            {category.children?.map((child) => renderCategory(child as CategoryWithProductCount, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Build delete description with product count info
  const deleteDescription = useMemo(() => {
    if (!categoryToDelete) return undefined;
    const count = categoryToDelete.productCount;
    const childCount = (categoryToDelete.children?.length ?? 0);

    const parts: string[] = [];
    if (count > 0) {
      parts.push(`${count} product${count === 1 ? '' : 's'} will have their category removed`);
    }
    if (childCount > 0) {
      parts.push(`${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} will become top-level`);
    }

    if (parts.length > 0) {
      return `Are you sure you want to delete "${categoryToDelete.name}"? ${parts.join('. ')}. This action cannot be undone.`;
    }
    return undefined;
  }, [categoryToDelete]);

  // --- Render ---

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToAdmin('inventory-hub')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Product Categories</h1>
          <p className="text-muted-foreground">
            Organize products into categories for your storefront
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Tag className="h-5 w-5 text-primary" />
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
      <Card>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

      {/* Categories Tree */}
      {categoriesLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-6 w-6 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : tableMissing ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Feature Not Available</h3>
            <p className="text-muted-foreground mb-4">
              The categories table has not been created yet. This feature requires additional database setup.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact support to enable this feature or run the database migration.
            </p>
          </CardContent>
        </Card>
      ) : categoryTree.length === 0 ? (
        <EnhancedEmptyState
          icon={Tag}
          title="No Categories Found"
          description="Create your first category to organize products."
          primaryAction={{
            label: 'Create Your First Category',
            onClick: openCreateDialog,
            icon: Plus,
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {categoryTree.map(category => renderCategory(category))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Category Dialog */}
      <Dialog open={dialogOpen || !!editingCategory} onOpenChange={(open) => {
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
                      <Input placeholder="e.g. Flower, Edibles, Vapes" {...field} />
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
                          .map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
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
                    ? (editingCategory ? 'Updating...' : 'Creating...')
                    : (editingCategory ? 'Update' : 'Create')
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (categoryToDelete) {
            deleteCategory.mutate(categoryToDelete.id);
          }
        }}
        itemName={categoryToDelete?.name}
        itemType="category"
        description={deleteDescription}
        isLoading={deleteCategory.isPending}
      />
    </div>
  );
}

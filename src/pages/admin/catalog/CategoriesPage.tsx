import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { TruncatedText } from '@/components/shared/TruncatedText';
import {
  Plus,
  Search,
  Tag,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  ArrowLeft,
  Package,
  DollarSign,
  TrendingUp,
  Crown,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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

// Types for category stats
interface CategoryStats {
  categoryId: string;
  productCount: number;
  totalStockValue: number;
  totalRevenue: number;
  bestSeller: {
    id: string;
    name: string;
    totalSold: number;
  } | null;
}

interface Category {
  id: string;
  tenant_id: string;
  name: string;
  slug: string | null;
  description: string | null;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  children?: Category[];
}

interface CategoryWithStats extends Category {
  stats?: CategoryStats;
}

export default function CategoriesPage() {
  const { navigateToAdmin, navigate, tenantSlug } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    slug: '',
    description: '',
    parent_id: null as string | null,
    color: '#3B82F6',
    icon: 'tag'
  });

  // Track if table is missing
  const [tableMissing, setTableMissing] = useState(false);

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: queryKeys.categories.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('name', { ascending: true });

        // Gracefully handle missing table
        if (error && error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        if (error) throw error;
        setTableMissing(false);
        return (data || []) as unknown as Category[];
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

  // Fetch category stats (products, stock value, revenue, best seller)
  const { data: categoryStats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.categories.list(tenantId), 'stats'],
    queryFn: async () => {
      if (!tenantId || !categories || categories.length === 0) return new Map<string, CategoryStats>();

      try {
        // Fetch products with their category_id
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, name, category_id, available_quantity, cost_per_unit, retail_price')
          .eq('tenant_id', tenantId);

        if (productsError && productsError.code !== '42P01') {
          logger.warn('Failed to fetch products for category stats', { error: productsError });
        }

        // Fetch order items to calculate revenue and best sellers
        const { data: orderItems, error: orderItemsError } = await supabase
          .from('order_items')
          .select(`
            product_id,
            quantity,
            price
          `);

        if (orderItemsError && orderItemsError.code !== '42P01') {
          logger.warn('Failed to fetch order items for category stats', { error: orderItemsError });
        }

        // Build stats map
        const statsMap = new Map<string, CategoryStats>();

        // Initialize stats for each category
        categories.forEach(cat => {
          statsMap.set(cat.id, {
            categoryId: cat.id,
            productCount: 0,
            totalStockValue: 0,
            totalRevenue: 0,
            bestSeller: null,
          });
        });

        // Build product-to-category mapping and calculate product stats
        const productCategoryMap = new Map<string, string>();
        const productSalesMap = new Map<string, { name: string; totalSold: number; categoryId: string }>();

        (products || []).forEach(product => {
          if (product.category_id) {
            productCategoryMap.set(product.id, product.category_id);

            const stats = statsMap.get(product.category_id);
            if (stats) {
              stats.productCount += 1;
              const stockValue = (product.available_quantity || 0) * (product.cost_per_unit || product.retail_price || 0);
              stats.totalStockValue += stockValue;
            }

            productSalesMap.set(product.id, {
              name: product.name,
              totalSold: 0,
              categoryId: product.category_id,
            });
          }
        });

        // Calculate revenue and sales per product
        (orderItems || []).forEach(item => {
          const categoryId = productCategoryMap.get(item.product_id);
          if (categoryId) {
            const stats = statsMap.get(categoryId);
            if (stats) {
              stats.totalRevenue += item.price * item.quantity;
            }

            const productSales = productSalesMap.get(item.product_id);
            if (productSales) {
              productSales.totalSold += item.quantity;
            }
          }
        });

        // Find best seller for each category
        categories.forEach(cat => {
          const stats = statsMap.get(cat.id);
          if (stats) {
            let bestSeller: { id: string; name: string; totalSold: number } | null = null;

            productSalesMap.forEach((sales, productId) => {
              if (sales.categoryId === cat.id && sales.totalSold > 0) {
                if (!bestSeller || sales.totalSold > bestSeller.totalSold) {
                  bestSeller = {
                    id: productId,
                    name: sales.name,
                    totalSold: sales.totalSold,
                  };
                }
              }
            });

            stats.bestSeller = bestSeller;
          }
        });

        return statsMap;
      } catch (error) {
        logger.error('Failed to calculate category stats', { error });
        return new Map<string, CategoryStats>();
      }
    },
    enabled: !!tenantId && !!categories && categories.length > 0,
    staleTime: 30000,
  });

  // Build category tree with stats
  const buildCategoryTree = useCallback((categoriesList: Category[]): CategoryWithStats[] => {
    const categoryMap = new Map<string, CategoryWithStats>();
    const rootCategories: CategoryWithStats[] = [];

    // First pass: create map of all categories
    categoriesList.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [],
        stats: categoryStats?.get(cat.id),
      });
    });

    // Second pass: build tree structure
    categoriesList.forEach(cat => {
      const category = categoryMap.get(cat.id);
      if (category && cat.parent_id && categoryMap.has(cat.parent_id)) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(category);
        }
      } else if (category) {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  }, [categoryStats]);

  // Create category
  const createCategory = useMutation({
    mutationFn: async (category: typeof newCategory) => {
      if (!tenantId) throw new Error('Tenant ID missing');

      const { error } = await supabase
        .from('categories')
        .insert([{
          ...category,
          tenant_id: tenantId,
          slug: category.slug || category.name.toLowerCase().replace(/\s+/g, '-')
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Category created successfully!' });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      setCreateDialogOpen(false);
      setNewCategory({
        name: '',
        slug: '',
        description: '',
        parent_id: null,
        color: '#3B82F6',
        icon: 'tag'
      });
    },
    onError: (error) => {
      handleError(error, { component: 'CategoriesPage', toastTitle: 'Failed to create category' });
    }
  });

  // Update category
  const updateCategory = useMutation({
    mutationFn: async ({ id, ...updates }: Category) => {
      if (!tenantId) throw new Error('Tenant ID missing');
      const { error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Category updated successfully!' });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      setEditingCategory(null);
    },
    onError: (error) => {
      handleError(error, { component: 'CategoriesPage', toastTitle: 'Failed to update category' });
    }
  });

  // Delete category
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
      toast({ title: 'Category deleted successfully!' });
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
    },
    onError: (error) => {
      handleError(error, { component: 'CategoriesPage', toastTitle: 'Failed to delete category' });
    }
  });

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

  const filteredCategories = useMemo(() => {
    return categories?.filter(cat =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];
  }, [categories, searchQuery]);

  const categoryTree = useMemo(() => buildCategoryTree(filteredCategories), [buildCategoryTree, filteredCategories]);

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    if (!categoryStats) return { totalProducts: 0, totalStockValue: 0, totalRevenue: 0 };

    let totalProducts = 0;
    let totalStockValue = 0;
    let totalRevenue = 0;

    categoryStats.forEach(stats => {
      totalProducts += stats.productCount;
      totalStockValue += stats.totalStockValue;
      totalRevenue += stats.totalRevenue;
    });

    return { totalProducts, totalStockValue, totalRevenue };
  }, [categoryStats]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isLoading = categoriesLoading || statsLoading;

  const renderCategory = (category: CategoryWithStats, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const stats = category.stats;

    return (
      <div key={category.id} className="mb-2">
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
            level > 0 ? 'ml-6' : ''
          }`}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => toggleCategory(category.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="w-6 shrink-0" />
          )}

          {/* Color indicator */}
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: category.color || '#3B82F6' }}
          />

          {/* Category info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TruncatedText text={category.name} className="font-medium" as="p" />
              {category.slug && (
                <Badge variant="outline" className="text-xs">
                  {category.slug}
                </Badge>
              )}
            </div>
            {category.description && (
              <TruncatedText text={category.description} className="text-sm text-muted-foreground" as="p" />
            )}
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            {/* Product Count */}
            <div className="flex items-center gap-1.5 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{stats?.productCount ?? 0}</span>
              <span className="text-muted-foreground">products</span>
            </div>

            {/* Stock Value */}
            <div className="flex items-center gap-1.5 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatCurrency(stats?.totalStockValue ?? 0)}</span>
              <span className="text-muted-foreground">stock</span>
            </div>

            {/* Revenue */}
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="font-medium text-green-600">{formatCurrency(stats?.totalRevenue ?? 0)}</span>
            </div>

            {/* Best Seller */}
            {stats?.bestSeller && (
              <div className="flex items-center gap-1.5 text-sm max-w-[150px]">
                <Crown className="h-4 w-4 text-yellow-500 shrink-0" />
                <span className="truncate text-muted-foreground" title={stats.bestSeller.name}>
                  {stats.bestSeller.name}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => navigateToFilteredProducts(category.id)}
              title="View products"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => setEditingCategory(category)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                setCategoryToDelete({ id: category.id, name: category.name });
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Mobile stats row */}
        <div className="md:hidden ml-12 mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" /> {stats?.productCount ?? 0} products
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> {formatCurrency(stats?.totalStockValue ?? 0)} stock
          </span>
          <span className="flex items-center gap-1 text-green-600">
            <TrendingUp className="h-3 w-3" /> {formatCurrency(stats?.totalRevenue ?? 0)} revenue
          </span>
          {stats?.bestSeller && (
            <span className="flex items-center gap-1">
              <Crown className="h-3 w-3 text-yellow-500" /> {stats.bestSeller.name}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-6 mt-2">
            {category.children?.map((child) => renderCategory(child as CategoryWithStats, level + 1))}
          </div>
        )}
      </div>
    );
  };

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
          <h1 className="text-xl font-bold">Categories & Tags</h1>
          <p className="text-muted-foreground">
            Organize products with categories and tags
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{categories?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Total Categories</p>
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
                <div className="text-2xl font-bold">{aggregateStats.totalProducts}</div>
                <p className="text-xs text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(aggregateStats.totalStockValue)}</div>
                <p className="text-xs text-muted-foreground">Total Stock Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(aggregateStats.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
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
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
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
              Contact support to enable this feature or run the database migration to create the required tables.
            </p>
          </CardContent>
        </Card>
      ) : categoryTree.length === 0 ? (
        <EnhancedEmptyState
          icon={Tag}
          title="No Categories Found"
          description="Create your first category to organize products."
          primaryAction={{
            label: "Create Your First Category",
            onClick: () => setCreateDialogOpen(true),
            icon: Plus
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
      <Dialog open={createDialogOpen || !!editingCategory} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditingCategory(null);
          setNewCategory({
            name: '',
            slug: '',
            description: '',
            parent_id: null,
            color: '#3B82F6',
            icon: 'tag'
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Name *</Label>
              <Input
                id="category-name"
                placeholder="Flower"
                value={editingCategory?.name || newCategory.name}
                onChange={(e) => {
                  if (editingCategory) {
                    setEditingCategory({ ...editingCategory, name: e.target.value });
                  } else {
                    setNewCategory({ ...newCategory, name: e.target.value });
                  }
                }}
              />
            </div>

            <div>
              <Label htmlFor="category-slug">Slug</Label>
              <Input
                id="category-slug"
                placeholder="flower (auto-generated if empty)"
                value={editingCategory?.slug || newCategory.slug}
                onChange={(e) => {
                  if (editingCategory) {
                    setEditingCategory({ ...editingCategory, slug: e.target.value });
                  } else {
                    setNewCategory({ ...newCategory, slug: e.target.value });
                  }
                }}
              />
            </div>

            <div>
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                placeholder="Category description..."
                value={editingCategory?.description || newCategory.description}
                onChange={(e) => {
                  if (editingCategory) {
                    setEditingCategory({ ...editingCategory, description: e.target.value });
                  } else {
                    setNewCategory({ ...newCategory, description: e.target.value });
                  }
                }}
              />
            </div>

            <div>
              <Label htmlFor="category-parent">Parent Category</Label>
              <Select
                value={editingCategory?.parent_id || newCategory.parent_id || '__none__'}
                onValueChange={(value) => {
                  const parentValue = value === '__none__' ? null : value;
                  if (editingCategory) {
                    setEditingCategory({ ...editingCategory, parent_id: parentValue });
                  } else {
                    setNewCategory({ ...newCategory, parent_id: parentValue });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (top-level)</SelectItem>
                  {categories?.filter(c => c.id !== editingCategory?.id).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category-color">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="category-color"
                  type="color"
                  value={editingCategory?.color || newCategory.color}
                  onChange={(e) => {
                    if (editingCategory) {
                      setEditingCategory({ ...editingCategory, color: e.target.value });
                    } else {
                      setNewCategory({ ...newCategory, color: e.target.value });
                    }
                  }}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={editingCategory?.color || newCategory.color}
                  onChange={(e) => {
                    if (editingCategory) {
                      setEditingCategory({ ...editingCategory, color: e.target.value });
                    } else {
                      setNewCategory({ ...newCategory, color: e.target.value });
                    }
                  }}
                  placeholder="#3B82F6"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingCategory(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingCategory) {
                  updateCategory.mutate(editingCategory);
                } else {
                  createCategory.mutate(newCategory);
                }
              }}
              disabled={
                (!editingCategory && !newCategory.name) ||
                (editingCategory && !editingCategory.name) ||
                createCategory.isPending ||
                updateCategory.isPending
              }
            >
              {editingCategory ? 'Update' : 'Create'} Category
            </Button>
          </DialogFooter>
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
        isLoading={deleteCategory.isPending}
      />
    </div>
  );
}

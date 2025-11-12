import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Tag,
  Edit,
  Trash2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  ArrowLeft
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

export default function CategoriesPage() {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
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
  const { data: categories, isLoading } = useQuery({
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
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Build category tree
  const buildCategoryTree = (categories: any[]) => {
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // First pass: create map of all categories
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree structure
    categories.forEach(cat => {
      const category = categoryMap.get(cat.id);
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id).children.push(category);
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  };

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
    onError: (error: any) => {
      toast({
        title: 'Failed to create category',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Update category
  const updateCategory = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Category updated successfully!' });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
      setEditingCategory(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update category',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete category
  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Category deleted successfully!' });
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.lists() });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete category',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredCategories = categories?.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categoryTree = buildCategoryTree(filteredCategories || []);

  const renderCategory = (category: any, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div key={category.id} className="mb-2">
        <div
          className={`flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors ${
            level > 0 ? 'ml-6' : ''
          }`}
        >
          {hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggleCategory(category.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          {!hasChildren && <div className="w-6" />}

          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: category.color || '#3B82F6' }}
          />
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{category.name}</p>
              {category.slug && (
                <Badge variant="outline" className="text-xs">
                  {category.slug}
                </Badge>
              )}
            </div>
            {category.description && (
              <p className="text-sm text-muted-foreground">{category.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditingCategory(category)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setCategoryToDelete({ id: category.id, name: category.name });
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="ml-6">
            {category.children.map((child: any) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Categories & Tags</h1>
          <p className="text-muted-foreground">
            Organize products with categories and tags
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{categories?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {categories?.filter(c => !c.parent_id).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Top-Level Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {categories?.filter(c => c.parent_id).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Sub-Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
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
        <div className="text-center py-12">Loading categories...</div>
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
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No categories found</p>
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
              Create Your First Category
            </Button>
          </CardContent>
        </Card>
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


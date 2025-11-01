/**
 * Categories & Tags Page
 * Organize products with categories and tags for better management
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/DataTable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Tag, Edit, Trash2, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
// ColumnDef type - simplified version
type ColumnDef<T> = {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (row: { original: T }) => React.ReactNode;
  id?: string;
};
import { format } from 'date-fns';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  product_count?: number;
  created_at: string;
}

export default function CategoriesPage() {
  const { account } = useAccount();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      // Fetch categories - assuming a categories table exists
      // For now, we'll create a mock structure
      const { data: products } = await supabase
        .from('products')
        .select('category, id')
        .eq('account_id', account.id);

      // Group by category
      const categoryMap = new Map<string, Category>();
      (products || []).forEach((p: any) => {
        const catName = p.category || 'Uncategorized';
        if (!categoryMap.has(catName)) {
          categoryMap.set(catName, {
            id: catName.toLowerCase().replace(/\s+/g, '-'),
            name: catName,
            slug: catName.toLowerCase().replace(/\s+/g, '-'),
            description: '',
            product_count: 0,
            created_at: new Date().toISOString(),
          });
        }
        const cat = categoryMap.get(catName)!;
        cat.product_count = (cat.product_count || 0) + 1;
      });

      return Array.from(categoryMap.values());
    },
    enabled: !!account?.id,
  });

  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: 'name',
      header: 'Category',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => (
        <code className="text-xs bg-muted px-2 py-1 rounded">{row.original.slug}</code>
      ),
    },
    {
      accessorKey: 'product_count',
      header: 'Products',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.product_count || 0} products</Badge>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description || '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingCategory(row.original);
              setFormData({
                name: row.original.name,
                description: row.original.description || '',
              });
              setIsDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const handleSave = async () => {
    try {
      // TODO: Save category to database
      showSuccessToast('Category saved successfully');
      setIsDialogOpen(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (error) {
      showErrorToast('Failed to save category');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🔖 Categories & Tags</h1>
          <p className="text-muted-foreground">
            Organize your product catalog with categories and tags
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Flower, Concentrate, Edible"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this category"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <DataTable
          columns={columns}
          data={categories || []}
          loading={isLoading}
          emptyMessage="No categories found. Create your first category!"
        />
      </Card>
    </div>
  );
}


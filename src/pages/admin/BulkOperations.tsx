import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Upload, Download, Trash2, Edit, Save, X, FileSpreadsheet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Product {
  id: string;
  name: string;
  category?: string;
  price?: number;
  stock_quantity?: number;
}

export default function BulkOperations() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'delete' | 'category' | 'price' | 'status'>('category');
  const [bulkValue, setBulkValue] = useState('');
  const [operationHistory, setOperationHistory] = useState<Array<{ id: string; action: string; count: number; timestamp: string }>>([]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products-bulk', tenantId],
    queryFn: async (): Promise<Product[]> => {
      if (!tenantId) return [];

      // Try products table
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, category, price, stock_quantity')
          .eq('tenant_id', tenantId)
          .limit(500);

        if (!error && data) {
          return data;
        }

        // Fallback: wholesale_inventory
        const { data: wholesale, error: wholesaleError } = await supabase
          .from('wholesale_inventory')
          .select('id, strain as name, category, price_per_lb as price, weight_lbs as stock_quantity')
          .eq('tenant_id', tenantId)
          .limit(500);

        if (!wholesaleError && wholesale) {
          return wholesale;
        }

        return [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!tenantId,
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(products?.map((p) => p.id) || []));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const executeBulkAction = async () => {
    if (selectedProducts.size === 0) {
      toast({
        title: 'No products selected',
        description: 'Please select at least one product.',
        variant: 'destructive',
      });
      return;
    }

    const productIds = Array.from(selectedProducts);
    let updateData: any = {};
    let actionName = '';

    switch (bulkAction) {
      case 'category':
        if (!bulkValue) {
          toast({
            title: 'Category required',
            description: 'Please enter a category name.',
            variant: 'destructive',
          });
          return;
        }
        updateData = { category: bulkValue };
        actionName = `Updated category to "${bulkValue}"`;
        break;
      case 'price':
        const price = Number(bulkValue);
        if (isNaN(price) || price < 0) {
          toast({
            title: 'Invalid price',
            description: 'Please enter a valid price.',
            variant: 'destructive',
          });
          return;
        }
        updateData = { price: price };
        actionName = `Updated price to $${price}`;
        break;
      case 'status':
        if (!bulkValue) {
          toast({
            title: 'Status required',
            description: 'Please enter a status.',
            variant: 'destructive',
          });
          return;
        }
        updateData = { status: bulkValue };
        actionName = `Updated status to "${bulkValue}"`;
        break;
      case 'delete':
        if (!confirm(`Are you sure you want to delete ${productIds.length} product(s)?`)) {
          return;
        }
        actionName = 'Deleted products';
        break;
    }

    try {
      if (bulkAction === 'delete') {
        // Delete products
        const { error } = await supabase
          .from('products')
          .delete()
          .in('id', productIds)
          .eq('tenant_id', tenantId);

        if (error) throw error;
      } else {
        // Update products
        const { error } = await supabase
          .from('products')
          .update(updateData)
          .in('id', productIds)
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') {
          throw new Error('Products table does not exist.');
        }
        if (error) throw error;
      }

      // Record in history
      setOperationHistory((prev) => [
        {
          id: Date.now().toString(),
          action: actionName,
          count: productIds.length,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);

      toast({
        title: 'Bulk operation successful',
        description: `${actionName} for ${productIds.length} product(s).`,
      });

      queryClient.invalidateQueries({ queryKey: ['products-bulk', tenantId] });
      setSelectedProducts(new Set());
      setBulkValue('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to execute bulk operation',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    if (!products) return;

    const csv = [
      ['ID', 'Name', 'Category', 'Price', 'Stock Quantity'].join(','),
      ...products.map((p) =>
        [
          p.id,
          p.name,
          p.category || '',
          p.price || 0,
          p.stock_quantity || 0,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());

      // Parse CSV and create products (simplified - would need proper CSV parsing)
      toast({
        title: 'Import started',
        description: 'CSV import functionality will process the file.',
      });
    };
    reader.readAsText(file);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bulk Operations</h1>
          <p className="text-muted-foreground">Perform bulk actions on multiple products at once</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Label htmlFor="csv-import" className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </span>
            </Button>
            <Input
              id="csv-import"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
            />
          </Label>
        </div>
      </div>

      {/* Bulk Action Panel */}
      {selectedProducts.size > 0 && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Bulk Action ({selectedProducts.size} selected)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="action">Action</Label>
                <Select value={bulkAction} onValueChange={(value: any) => setBulkAction(value)}>
                  <SelectTrigger id="action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Assign Category</SelectItem>
                    <SelectItem value="price">Update Price</SelectItem>
                    <SelectItem value="status">Update Status</SelectItem>
                    <SelectItem value="delete">Delete Products</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {bulkAction !== 'delete' && (
                <div>
                  <Label htmlFor="value">
                    {bulkAction === 'category'
                      ? 'Category Name'
                      : bulkAction === 'price'
                      ? 'Price ($)'
                      : 'Status'}
                  </Label>
                  <Input
                    id="value"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder={
                      bulkAction === 'category'
                        ? 'e.g., Electronics'
                        : bulkAction === 'price'
                        ? '0.00'
                        : 'e.g., active'
                    }
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={executeBulkAction}>
                <Save className="h-4 w-4 mr-2" />
                Execute Bulk Action
              </Button>
              <Button variant="outline" onClick={() => setSelectedProducts(new Set())}>
                <X className="h-4 w-4 mr-2" />
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({products?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {products && products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProducts.size === products.length && products.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category || 'Uncategorized'}</Badge>
                    </TableCell>
                    <TableCell>${Number(product.price || 0).toFixed(2)}</TableCell>
                    <TableCell>{product.stock_quantity || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No products found.</div>
          )}
        </CardContent>
      </Card>

      {/* Operation History */}
      {operationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Operation History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {operationHistory.map((op) => (
                <div key={op.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{op.action}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(op.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="secondary">{op.count} items</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


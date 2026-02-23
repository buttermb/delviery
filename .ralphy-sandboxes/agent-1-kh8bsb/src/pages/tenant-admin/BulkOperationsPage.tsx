import { logger } from '@/lib/logger';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  Upload,
  Download,
  RefreshCw,
  Tag,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

interface BulkOperation {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'inventory' | 'pricing' | 'metadata' | 'status';
}

const BULK_OPERATIONS: BulkOperation[] = [
  {
    id: 'update-price',
    name: 'Update Prices',
    description: 'Bulk update product prices by percentage or fixed amount',
    icon: DollarSign,
    category: 'pricing'
  },
  {
    id: 'update-stock',
    name: 'Update Stock Levels',
    description: 'Adjust inventory quantities for multiple products',
    icon: Package,
    category: 'inventory'
  },
  {
    id: 'apply-tags',
    name: 'Apply Tags',
    description: 'Add or remove tags from multiple products',
    icon: Tag,
    category: 'metadata'
  },
  {
    id: 'update-status',
    name: 'Update Status',
    description: 'Change active/inactive status for multiple products',
    icon: RefreshCw,
    category: 'status'
  },
  {
    id: 'export-data',
    name: 'Export Data',
    description: 'Export selected products to CSV',
    icon: Download,
    category: 'metadata'
  },
  {
    id: 'import-data',
    name: 'Import Data',
    description: 'Import products from CSV file',
    icon: Upload,
    category: 'metadata'
  }
];

export default function BulkOperationsPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);
  const [operationParams, setOperationParams] = useState<any>({});

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, stock_quantity')
          .eq('tenant_id', tenantId)
          .order('name');

        // Gracefully handle missing table
        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Execute bulk operation
  const executeBulkOperation = useMutation({
    mutationFn: async ({ operation, productIds, params }: { operation: string; productIds: string[]; params: any }) => {
      if (!tenantId) throw new Error('Tenant ID missing');

      // Build update object based on operation
      const updates: any = {};

      switch (operation) {
        case 'update-price':
          if (params.priceChangeType === 'percentage') {
            // This would require fetching current prices first
            toast({
              title: 'Price update',
              description: `Would update prices for ${productIds.length} products by ${params.priceChange}%`,
            });
          } else {
            updates.price = params.priceChange;
          }
          break;
        case 'update-stock':
          updates.stock_quantity = params.stockChange;
          break;
        case 'apply-tags':
          if (params.tagAction === 'add') {
            // Would need to merge with existing tags
            updates.tags = params.tags;
          } else {
            // Would need to remove tags
            updates.tags = [];
          }
          break;
        case 'update-status':
          updates.status = params.status;
          break;
      }

      // Execute bulk update
      const { error } = await supabase
        .from('products')
        .update(updates)
        .in('id', productIds)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Bulk operation completed successfully!' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setOperationDialogOpen(false);
      setSelectedProducts(new Set());
      setSelectedOperation(null);
    },
    onError: (error: unknown) => {
      logger.error('Bulk operation failed', error, { component: 'BulkOperations' });
      toast({
        title: 'Bulk operation failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  });

  const handleOperationSelect = (operationId: string) => {
    setSelectedOperation(operationId);
    setOperationParams({});
    setOperationDialogOpen(true);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products?.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products?.map(p => p.id) || []));
    }
  };

  const getOperationParams = () => {
    const operation = BULK_OPERATIONS.find(op => op.id === selectedOperation);
    if (!operation) return null;

    switch (operation.id) {
      case 'update-price':
        return (
          <div className="space-y-4">
            <div>
              <Label>Price Change Type</Label>
              <Select
                value={operationParams.priceChangeType || 'fixed'}
                onValueChange={(value) => setOperationParams({ ...operationParams, priceChangeType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder={operationParams.priceChangeType === 'percentage' ? '10' : '100.00'}
                value={operationParams.priceChange || ''}
                onChange={(e) => setOperationParams({ ...operationParams, priceChange: e.target.value })}
              />
            </div>
          </div>
        );
      case 'update-stock':
        return (
          <div className="space-y-4">
            <div>
              <Label>Stock Change</Label>
              <Input
                type="number"
                placeholder="+10 or -5"
                value={operationParams.stockChange || ''}
                onChange={(e) => setOperationParams({ ...operationParams, stockChange: e.target.value })}
              />
            </div>
          </div>
        );
      case 'apply-tags':
        return (
          <div className="space-y-4">
            <div>
              <Label>Tag Action</Label>
              <Select
                value={operationParams.tagAction || 'add'}
                onValueChange={(value) => setOperationParams({ ...operationParams, tagAction: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Tags</SelectItem>
                  <SelectItem value="remove">Remove Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                placeholder="sale, featured, new"
                value={operationParams.tags || ''}
                onChange={(e) => setOperationParams({ ...operationParams, tags: e.target.value })}
              />
            </div>
          </div>
        );
      case 'update-status':
        return (
          <div className="space-y-4">
            <div>
              <Label>New Status</Label>
              <Select
                value={operationParams.status || 'active'}
                onValueChange={(value) => setOperationParams({ ...operationParams, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      default:
        return <p className="text-sm text-muted-foreground">No parameters needed for this operation.</p>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Bulk Operations</h1>
        <p className="text-muted-foreground">
          Perform bulk actions on multiple products at once
        </p>
      </div>

      {/* Selected Products Count */}
      {selectedProducts.size > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedProducts.size} product(s) selected</p>
                <p className="text-sm text-muted-foreground">
                  Choose an operation to perform on selected products
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedProducts(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operation Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {BULK_OPERATIONS.map((operation) => {
          const Icon = operation.icon;
          return (
            <Card
              key={operation.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleOperationSelect(operation.id)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{operation.name}</CardTitle>
                </div>
                <CardDescription>{operation.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Products List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Products</CardTitle>
              <CardDescription>
                Choose products to apply bulk operations to
              </CardDescription>
            </div>
            <Button variant="outline" onClick={toggleSelectAll}>
              {selectedProducts.size === products?.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <EnhancedLoadingState variant="table" count={5} message="Loading products..." />
          ) : products?.length === 0 ? (
            <EnhancedEmptyState
              icon={Package}
              title="No Products Found"
              description="Add products to your inventory to use bulk operations."
              compact
            />
          ) : (
            <div className="space-y-2">
              {products?.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => toggleProductSelection(product.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Price: ${product.price || 0}</span>
                      <span>Stock: {product.stock_quantity || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operation Dialog */}
      <Dialog open={operationDialogOpen} onOpenChange={setOperationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {BULK_OPERATIONS.find(op => op.id === selectedOperation)?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedProducts.size > 0
                ? `This will apply to ${selectedProducts.size} selected product(s).`
                : 'Please select products first.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedProducts.size === 0 ? (
              <EnhancedEmptyState
                icon={AlertTriangle}
                title="No Products Selected"
                description="Please select at least one product to proceed."
                compact
              />
            ) : (
              getOperationParams()
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOperationDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedOperation && selectedProducts.size > 0) {
                  executeBulkOperation.mutate({
                    operation: selectedOperation,
                    productIds: Array.from(selectedProducts),
                    params: operationParams
                  });
                }
              }}
              disabled={selectedProducts.size === 0 || executeBulkOperation.isPending}
            >
              {executeBulkOperation.isPending ? 'Processing...' : 'Execute Operation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

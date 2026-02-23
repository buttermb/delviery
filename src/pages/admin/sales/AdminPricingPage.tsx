import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DollarSign, Edit, Save, X } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { formatCurrency } from '@/lib/formatters';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';

interface Product {
  id: string;
  name: string;
  price: number;
  wholesale_price: number | null;
  cost_per_unit: number | null;
  bulk_discount: number | null;
  category: string;
}

export default function AdminPricingPage() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Product>>({});

  // Load products with pricing
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: queryKeys.pricing.products(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await (supabase as any)
        .from('products')
        .select('id, name, price, wholesale_price, cost_per_unit, bulk_discount, category')
        .eq('tenant_id', tenantId)
        .order('name');
      
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: !!tenantId,
  });

  // Update pricing mutation
  const updatePricing = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
      if (!tenantId) throw new Error('Tenant context required');

      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pricing updated successfully!");
      queryClient.invalidateQueries({ queryKey: queryKeys.pricing.products(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      setEditingId(null);
      setEditData({});
    },
    onError: (error: Error) => {
      toast.error("Update failed");
    }
  });

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setEditData({
      price: product.price,
      wholesale_price: product.wholesale_price,
      cost_per_unit: product.cost_per_unit,
      bulk_discount: product.bulk_discount
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveChanges = (id: string) => {
    updatePricing.mutate({ id, updates: editData });
  };

  const calculateMargin = (price: number, cost: number | null) => {
    if (!cost || cost === 0) return 'N/A';
    const margin = ((price - cost) / price) * 100;
    return `${margin.toFixed(1)}%`;
  };

  if (isLoading) {
    return <EnhancedLoadingState variant="table" message="Loading pricing data..." />;
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Product Pricing</h1>
        <p className="text-muted-foreground">
          Manage retail, wholesale, and cost pricing
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">Total Products</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatCurrency(products.reduce((sum, p) => sum + p.price, 0) / products.length || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Avg Retail Price</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {products.filter(p => p.wholesale_price).length}
            </div>
            <p className="text-xs text-muted-foreground">With Wholesale Pricing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {products.filter(p => p.bulk_discount && p.bulk_discount > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">With Bulk Discounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Product Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="text-left p-3 font-medium">Product</th>
                  <th scope="col" className="text-left p-3 font-medium">Category</th>
                  <th scope="col" className="text-right p-3 font-medium">Retail Price</th>
                  <th scope="col" className="text-right p-3 font-medium">Wholesale Price</th>
                  <th scope="col" className="text-right p-3 font-medium">Cost</th>
                  <th scope="col" className="text-right p-3 font-medium">Margin</th>
                  <th scope="col" className="text-right p-3 font-medium">Bulk Discount</th>
                  <th scope="col" className="text-center p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-accent/50">
                    <td className="p-3 font-medium">{product.name}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{product.category}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {editingId === product.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editData.price || ''}
                          onChange={(e) => setEditData({ ...editData, price: parseFloat(e.target.value) })}
                          className="w-24 text-right"
                        />
                      ) : (
                        <span className="font-bold">{formatCurrency(product.price)}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {editingId === product.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editData.wholesale_price || ''}
                          onChange={(e) => setEditData({ ...editData, wholesale_price: parseFloat(e.target.value) })}
                          className="w-24 text-right"
                        />
                      ) : (
                        <span>{product.wholesale_price ? formatCurrency(product.wholesale_price) : '—'}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {editingId === product.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editData.cost_per_unit || ''}
                          onChange={(e) => setEditData({ ...editData, cost_per_unit: parseFloat(e.target.value) })}
                          className="w-24 text-right"
                        />
                      ) : (
                        <span>{product.cost_per_unit ? formatCurrency(product.cost_per_unit) : '—'}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-sm text-muted-foreground">
                        {calculateMargin(product.price, product.cost_per_unit)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {editingId === product.id ? (
                        <Input
                          type="number"
                          value={editData.bulk_discount || 0}
                          onChange={(e) => setEditData({ ...editData, bulk_discount: parseInt(e.target.value) })}
                          className="w-20 text-right"
                        />
                      ) : (
                        <span>{product.bulk_discount ? `${product.bulk_discount}%` : '—'}</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {editingId === product.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="default"
                            onClick={() => saveChanges(product.id)}
                            disabled={updatePricing.isPending}
                            aria-label="Save changes"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                            aria-label="Cancel editing"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditing(product)}
                          aria-label="Edit pricing"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

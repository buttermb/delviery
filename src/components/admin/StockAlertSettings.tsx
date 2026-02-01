/**
 * Stock Alert Settings Component
 * Allows configuring low stock thresholds per product
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { AlertTriangle, CheckCircle, Package, Save, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { useStockAlertSettings } from '@/hooks/useStockAlertSettings';
import { SearchInput } from '@/components/shared/SearchInput';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

interface Product {
  id: string;
  name: string;
  category: string;
  available_quantity: number | null;
  low_stock_alert: number | null;
  sku: string | null;
}

interface ThresholdConfig {
  productId: string;
  threshold: number;
}

export function StockAlertSettings() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingThresholds, setEditingThresholds] = useState<Map<string, number>>(new Map());
  const [bulkThreshold, setBulkThreshold] = useState<number>(10);

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.products.byTenant(tenantId || ''),
    queryFn: async (): Promise<Product[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, available_quantity, low_stock_alert, sku')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!tenantId,
  });

  // Hook for saving settings
  const { updateThreshold, updateBulkThresholds, isSaving } = useStockAlertSettings();

  // Derive categories
  const categories = products
    ? Array.from(new Set(products.map((p) => p.category).filter(Boolean)))
    : [];

  // Filter products
  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      !searchTerm ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Get threshold for a product (edited or current)
  const getThreshold = (productId: string, currentThreshold: number | null): number => {
    if (editingThresholds.has(productId)) {
      return editingThresholds.get(productId)!;
    }
    return currentThreshold ?? 10;
  };

  // Calculate alert level preview
  const getAlertLevel = (
    available: number | null,
    threshold: number
  ): 'out_of_stock' | 'critical' | 'warning' | 'good' => {
    const qty = available ?? 0;
    if (qty <= 0) return 'out_of_stock';
    if (qty <= threshold * 0.25) return 'critical';
    if (qty <= threshold) return 'warning';
    return 'good';
  };

  // Handle individual threshold change
  const handleThresholdChange = (productId: string, value: number) => {
    setEditingThresholds(new Map(editingThresholds.set(productId, value)));
  };

  // Save individual threshold
  const handleSaveThreshold = async (productId: string, threshold: number) => {
    await updateThreshold(productId, threshold);
    // Remove from editing map after save
    const newMap = new Map(editingThresholds);
    newMap.delete(productId);
    setEditingThresholds(newMap);
  };

  // Apply bulk threshold to filtered products
  const handleBulkApply = async () => {
    if (!filteredProducts || filteredProducts.length === 0) {
      toast.error('No products to update');
      return;
    }

    const updates: ThresholdConfig[] = filteredProducts.map((p) => ({
      productId: p.id,
      threshold: bulkThreshold,
    }));

    await updateBulkThresholds(updates);

    // Clear editing state
    setEditingThresholds(new Map());
  };

  // Loading state
  if (productsLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const alertLevelColors = {
    out_of_stock: 'bg-red-100 dark:bg-red-950 border-red-500 text-red-700 dark:text-red-300',
    critical: 'bg-orange-100 dark:bg-orange-950 border-orange-500 text-orange-700 dark:text-orange-300',
    warning: 'bg-yellow-100 dark:bg-yellow-950 border-yellow-500 text-yellow-700 dark:text-yellow-300',
    good: 'bg-green-100 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-300',
  };

  const alertLevelLabels = {
    out_of_stock: 'Out of Stock',
    critical: 'Critical',
    warning: 'Low Stock',
    good: 'Good',
  };

  const alertLevelIcons = {
    out_of_stock: <AlertTriangle className="h-4 w-4" />,
    critical: <AlertTriangle className="h-4 w-4" />,
    warning: <TrendingDown className="h-4 w-4" />,
    good: <CheckCircle className="h-4 w-4" />,
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Stock Alert Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure low stock thresholds for each product
        </p>
      </div>

      {/* Bulk Operations Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bulk Settings</CardTitle>
          <CardDescription>Apply threshold to all filtered products at once</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="bulk-threshold">Bulk Threshold</Label>
              <div className="flex items-center gap-4 mt-2">
                <Slider
                  id="bulk-threshold"
                  min={1}
                  max={100}
                  step={1}
                  value={[bulkThreshold]}
                  onValueChange={(values) => setBulkThreshold(values[0])}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={bulkThreshold}
                  onChange={(e) => setBulkThreshold(parseInt(e.target.value) || 10)}
                  className="w-20"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleBulkApply} disabled={isSaving} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                Apply to {filteredProducts?.length || 0} Products
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            placeholder="Search products by name or SKU..."
            onSearch={setSearchTerm}
            defaultValue={searchTerm}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle>Product Thresholds ({filteredProducts?.length || 0})</CardTitle>
          <CardDescription>
            Set individual thresholds for each product. Alert levels are calculated based on
            current stock vs threshold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredProducts && filteredProducts.length > 0 ? (
            <div className="space-y-3">
              {filteredProducts.map((product) => {
                const threshold = getThreshold(product.id, product.low_stock_alert);
                const hasUnsavedChanges = editingThresholds.has(product.id);
                const alertLevel = getAlertLevel(product.available_quantity, threshold);

                return (
                  <div
                    key={product.id}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-lg transition-all ${
                      hasUnsavedChanges ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    {/* Product Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{product.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>Stock: {product.available_quantity ?? 0}</span>
                          {product.sku && (
                            <>
                              <span>•</span>
                              <span>SKU: {product.sku}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Alert Level Preview */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${alertLevelColors[alertLevel]} flex items-center gap-1`}
                      >
                        {alertLevelIcons[alertLevel]}
                        {alertLevelLabels[alertLevel]}
                      </Badge>
                    </div>

                    {/* Threshold Controls */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                        <Label htmlFor={`threshold-${product.id}`} className="text-sm whitespace-nowrap">
                          Threshold:
                        </Label>
                        <Input
                          id={`threshold-${product.id}`}
                          type="number"
                          min={1}
                          max={1000}
                          value={threshold}
                          onChange={(e) =>
                            handleThresholdChange(product.id, parseInt(e.target.value) || 10)
                          }
                          className="w-20"
                        />
                      </div>

                      {hasUnsavedChanges && (
                        <Button
                          size="sm"
                          onClick={() => handleSaveThreshold(product.id, threshold)}
                          disabled={isSaving}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EnhancedEmptyState
              icon={Package}
              title="No products found"
              description="Try adjusting your search or filters to find products"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default StockAlertSettings;

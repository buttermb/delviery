/**
 * Storefront Products Page
 * Manage product visibility and pricing for the online store
 */

import { useState, useMemo, useTransition } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import {
  Search,
  Package,
  Eye,
  EyeOff,
  Save,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  category: string | null;
  price: number;
  image_url: string | null;
  in_stock: boolean;
  status: string;
  menu_visibility: boolean;
}

interface ProductSetting {
  id: string;
  product_id: string;
  is_visible: boolean;
  display_price: number | null;
  sale_price?: number | null;
  display_order: number;
}

export default function StorefrontProducts() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isFilterPending, startFilterTransition] = useTransition();
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});

  // Fetch store
  const { data: store } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch all products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.tenantProducts.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, price, image_url, in_stock, menu_visibility')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
    enabled: !!tenantId,
  });

  // Fetch product settings
  const { data: productSettings = [], isLoading: settingsLoading } = useQuery({
    queryKey: queryKeys.marketplaceProductSettingsByStore.byStore(store?.id),
    queryFn: async () => {
      if (!store?.id) return [];
      const { data, error } = await supabase
        .from('marketplace_product_settings')
        .select('id, product_id, is_visible, custom_price, display_order')
        .eq('store_id', store.id);

      if (error) throw error;
      return (data ?? []) as unknown as ProductSetting[];
    },
    enabled: !!store?.id,
  });

  // Create settings map for quick lookup
  const settingsMap = useMemo(() => {
    const map = new Map<string, ProductSetting>();
    productSettings.forEach((s) => map.set(s.product_id, s));
    return map;
  }, [productSettings]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search filter
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Category filter
      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }
      // Visibility filter
      if (visibilityFilter !== 'all') {
        const setting = settingsMap.get(p.id);
        const isVisible = setting?.is_visible ?? false;
        if (visibilityFilter === 'visible' && !isVisible) return false;
        if (visibilityFilter === 'hidden' && isVisible) return false;
      }
      return true;
    });
  }, [products, searchQuery, categoryFilter, visibilityFilter, settingsMap]);

  // Toggle visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ productId, isVisible }: { productId: string; isVisible: boolean }) => {
      if (!store?.id) throw new Error('No store');

      const existing = settingsMap.get(productId);

      if (existing) {
        const { error } = await supabase
          .from('marketplace_product_settings')
          .update({ is_visible: isVisible })
          .eq('id', existing.id)
          .eq('store_id', store.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketplace_product_settings')
          .insert({
            store_id: store.id,
            product_id: productId,
            is_visible: isVisible,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProductSettings.all });
      // Invalidate storefront product caches for instant sync
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
    },
    onError: (error) => {
      logger.error('Failed to toggle visibility', error, { component: 'StorefrontProducts' });
      toast.error("Failed to update product visibility.", { description: humanizeError(error) });
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ productId, price }: { productId: string; price: number | null }) => {
      if (!store?.id) throw new Error('No store');

      const existing = settingsMap.get(productId);

      if (existing) {
        const { error } = await supabase
          .from('marketplace_product_settings')
          .update({ custom_price: price })
          .eq('id', existing.id)
          .eq('store_id', store.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketplace_product_settings')
          .insert({
            store_id: store.id,
            product_id: productId,
            custom_price: price,
            is_visible: false,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProductSettings.all });
      // Invalidate storefront product caches for instant sync
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      toast.success("Price updated!");
    },
    onError: (error) => {
      logger.error('Failed to update price', error, { component: 'StorefrontProducts' });
      toast.error("Failed to update price.", { description: humanizeError(error) });
    },
  });

  // Bulk visibility mutation
  const bulkVisibilityMutation = useMutation({
    mutationFn: async (isVisible: boolean) => {
      if (!store?.id || selectedProducts.size === 0) return;

      const productIds = Array.from(selectedProducts);

      // Get existing settings
      const existingIds = productIds.filter((id) => settingsMap.has(id));
      const newIds = productIds.filter((id) => !settingsMap.has(id));

      // Update existing
      if (existingIds.length > 0) {
        const settingIds = existingIds.map((id) => settingsMap.get(id)?.id).filter((id): id is string => !!id);
        const { error } = await supabase
          .from('marketplace_product_settings')
          .update({ is_visible: isVisible })
          .in('id', settingIds)
          .eq('store_id', store.id);
        if (error) throw error;
      }

      // Insert new
      if (newIds.length > 0) {
        const { error } = await supabase
          .from('marketplace_product_settings')
          .insert(
            newIds.map((productId) => ({
              store_id: store.id,
              product_id: productId,
              is_visible: isVisible,
            }))
          );
        if (error) throw error;
      }
    },
    onSuccess: (_, _isVisible) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProductSettings.all });
      // Invalidate storefront product caches for instant sync
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
      const count = selectedProducts.size;
      setSelectedProducts(new Set());
      toast.success(`${count} ${count === 1 ? 'product' : 'products'} ${_isVisible ? 'shown' : 'hidden'}`);
    },
    onError: (error: Error) => {
      logger.error('Failed to update product visibility', { error });
      toast.error("Failed to update visibility", { description: humanizeError(error) });
    },
  });

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleSelect = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handlePriceChange = (productId: string, value: string) => {
    setEditingPrices((prev) => ({ ...prev, [productId]: value }));
  };

  const handlePriceSave = (productId: string, _originalPrice: number) => {
    const newPrice = editingPrices[productId];
    if (newPrice === undefined) return;

    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice)) {
      // Reset to original
      updatePriceMutation.mutate({ productId, price: null });
    } else {
      updatePriceMutation.mutate({ productId, price: parsedPrice });
    }
    setEditingPrices((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  // Update display order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ productId, newOrder }: { productId: string; newOrder: number }) => {
      if (!store?.id) throw new Error('No store');

      const existing = settingsMap.get(productId);

      if (existing) {
        const { error } = await supabase
          .from('marketplace_product_settings')
          .update({ display_order: newOrder })
          .eq('id', existing.id)
          .eq('store_id', store.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketplace_product_settings')
          .insert({
            store_id: store.id,
            product_id: productId,
            display_order: newOrder,
            is_visible: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProductSettings.all });
      // Invalidate storefront product caches for instant sync
      queryClient.invalidateQueries({ queryKey: queryKeys.shopProducts.all });
    },
    onError: (error) => {
      logger.error('Failed to update order', error, { component: 'StorefrontProducts' });
      toast.error("Failed to update display order.", { description: humanizeError(error) });
    },
  });

  const handleMoveUp = (productId: string, currentOrder: number) => {
    updateOrderMutation.mutate({ productId, newOrder: Math.max(0, currentOrder - 1) });
  };

  const handleMoveDown = (productId: string, currentOrder: number) => {
    updateOrderMutation.mutate({ productId, newOrder: currentOrder + 1 });
  };

  const isLoading = productsLoading || settingsLoading;

  if (!store) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please create a store first.</p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const visibleCount = products.filter((p) => settingsMap.get(p.id)?.is_visible).length;

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catalog Management</h1>
          <p className="text-muted-foreground">
            {visibleCount} of {products.length} products visible in store
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/shop/${tenantSlug}`, '_blank', 'noopener,noreferrer')}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          Preview Store
        </Button>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                aria-label="Search products"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={(v) => startFilterTransition(() => setCategoryFilter(v))}>
              <SelectTrigger className="w-[180px]">
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

            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="visible">Visible</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedProducts.size > 0 && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedProducts.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkVisibilityMutation.mutate(true)}
                disabled={bulkVisibilityMutation.isPending}
              >
                {bulkVisibilityMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                Show All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkVisibilityMutation.mutate(false)}
                disabled={bulkVisibilityMutation.isPending}
              >
                {bulkVisibilityMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <EyeOff className="w-4 h-4 mr-2" />}
                Hide All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedProducts(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className={cn("p-0 transition-opacity", isFilterPending && "opacity-60")}>
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No products found</p>
              {products.length === 0 && (
                <p className="text-sm mt-2">Add products in your inventory first</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-16">Order</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Original Price</TableHead>
                  <TableHead>Store Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Visible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const setting = settingsMap.get(product.id);
                  const isVisible = setting?.is_visible ?? false;
                  const displayPrice = setting?.display_price;
                  const isEditing = editingPrices[product.id] !== undefined;

                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleSelect(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-11 w-11 sm:h-6 sm:w-6"
                            onClick={() => handleMoveUp(product.id, setting?.display_order ?? 999)}
                            disabled={updateOrderMutation.isPending}
                            title="Move up"
                            aria-label="Move up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-11 w-11 sm:h-6 sm:w-6"
                            onClick={() => handleMoveDown(product.id, setting?.display_order ?? 999)}
                            disabled={updateOrderMutation.isPending}
                            title="Move down"
                            aria-label="Move down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category || 'Uncategorized'}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(product.price)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={isEditing ? editingPrices[product.id] : (displayPrice ?? '')}
                            onChange={(e) => handlePriceChange(product.id, e.target.value)}
                            placeholder={formatCurrency(product.price)}
                            aria-label={`Store price for ${product.name}`}
                            className="w-24 h-8"
                          />
                          {isEditing && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePriceSave(product.id, product.price)}
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {product.in_stock ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700">
                              In Stock
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-700">
                              Out of Stock
                            </Badge>
                          )}
                          {!product.menu_visibility && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">
                              Hidden in Catalog
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={isVisible}
                          onCheckedChange={(checked) =>
                            toggleVisibilityMutation.mutate({
                              productId: product.id,
                              isVisible: checked,
                            })
                          }
                          disabled={toggleVisibilityMutation.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div >
  );
}






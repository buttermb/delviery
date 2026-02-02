/**
 * ProductsListPage
 * Clean, focused products list page with grid and table view toggle.
 * Part of the Products Hub functionality.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Shared Components
import { SearchInput } from '@/components/shared/SearchInput';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { InventoryStatusBadge } from '@/components/admin/InventoryStatusBadge';
import { ProductCard } from '@/components/admin/ProductCard';

// Icons
import Package from "lucide-react/dist/esm/icons/package";
import Plus from "lucide-react/dist/esm/icons/plus";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import List from "lucide-react/dist/esm/icons/list";
import Filter from "lucide-react/dist/esm/icons/filter";
import MoreVertical from "lucide-react/dist/esm/icons/more-vertical";
import Edit from "lucide-react/dist/esm/icons/edit";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Printer from "lucide-react/dist/esm/icons/printer";
import Store from "lucide-react/dist/esm/icons/store";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";

import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

type ViewMode = 'grid' | 'table';
type SortOption = 'name' | 'price' | 'stock' | 'category';
type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export function ProductsListPage() {
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  const navigateTenant = useTenantNavigate();
  const queryClient = useQueryClient();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');

  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Virtual scrolling ref for grid view
  const gridParentRef = useRef<HTMLDivElement>(null);

  // Fetch products
  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.products.byTenant(tenant?.id || ''),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('Tenant required');

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products', { error });
        throw error;
      }

      return data as Product[];
    },
    enabled: !!tenant?.id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!tenant?.id) throw new Error('Tenant required');

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Product deleted');
    },
    onError: (error) => {
      logger.error('Failed to delete product', { error });
      toast.error('Failed to delete product');
    },
  });

  // Derived: unique categories
  const categories = useMemo(() => {
    const cats = products
      .map((p) => p.category)
      .filter((c): c is string => Boolean(c));
    return Array.from(new Set(cats)).sort();
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();

    return products
      .filter((product) => {
        // Search filter
        if (searchLower) {
          const matchesSearch =
            product.name?.toLowerCase().includes(searchLower) ||
            product.sku?.toLowerCase().includes(searchLower) ||
            product.category?.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;
        }

        // Category filter
        if (categoryFilter !== 'all' && product.category !== categoryFilter) {
          return false;
        }

        // Stock filter
        const qty = product.available_quantity || 0;
        const lowThreshold = product.low_stock_alert || 10;

        if (stockFilter === 'in_stock' && qty <= 0) return false;
        if (stockFilter === 'out_of_stock' && qty > 0) return false;
        if (stockFilter === 'low_stock' && (qty <= 0 || qty > lowThreshold))
          return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return (a.name || '').localeCompare(b.name || '');
          case 'price':
            return (b.wholesale_price || 0) - (a.wholesale_price || 0);
          case 'stock':
            return (b.available_quantity || 0) - (a.available_quantity || 0);
          case 'category':
            return (a.category || '').localeCompare(b.category || '');
          default:
            return 0;
        }
      });
  }, [products, debouncedSearch, categoryFilter, stockFilter, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalUnits = products.reduce(
      (sum, p) => sum + (p.available_quantity || 0),
      0
    );
    const inventoryValue = products.reduce(
      (sum, p) =>
        sum + (p.available_quantity || 0) * (p.wholesale_price || 0),
      0
    );
    const lowStockCount = products.filter((p) => {
      const qty = p.available_quantity || 0;
      const threshold = p.low_stock_alert || 10;
      return qty > 0 && qty <= threshold;
    }).length;

    return { totalProducts, totalUnits, inventoryValue, lowStockCount };
  }, [products]);

  // Handlers
  const handleEdit = useCallback(
    (productId: string) => {
      navigateTenant(`/admin/inventory-hub?tab=products&edit=${productId}`);
    },
    [navigateTenant]
  );

  const handleDelete = useCallback(
    (productId: string) => {
      if (window.confirm('Are you sure you want to delete this product?')) {
        deleteMutation.mutate(productId);
      }
    },
    [deleteMutation]
  );

  const handleAddProduct = useCallback(() => {
    navigateTenant('/admin/inventory-hub?tab=products&new=true');
  }, [navigateTenant]);

  const handleToggleSelect = useCallback((productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  }, [selectedProducts.length, filteredProducts]);

  // Virtual scrolling for grid view
  // Calculate items per row dynamically based on viewport
  const getColumnsPerRow = () => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width < 768) return 1; // mobile
    if (width < 1024) return 2; // tablet
    if (width < 1280) return 3; // desktop
    return 4; // xl
  };

  const columnsPerRow = getColumnsPerRow();
  const gridRowCount = Math.ceil(filteredProducts.length / columnsPerRow);

  const gridVirtualizer = useVirtualizer({
    count: gridRowCount,
    getScrollElement: () => gridParentRef.current,
    estimateSize: () => 400, // Estimated height of each row (card height + gap)
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  // Table columns
  const columns: ResponsiveColumn<Product>[] = [
    {
      header: (
        <Checkbox
          checked={
            filteredProducts.length > 0 &&
            selectedProducts.length === filteredProducts.length
          }
          onCheckedChange={handleSelectAll}
          aria-label="Select all"
        />
      ),
      className: 'w-[50px]',
      cell: (product) => (
        <Checkbox
          checked={selectedProducts.includes(product.id)}
          onCheckedChange={() => handleToggleSelect(product.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      header: 'Image',
      accessorKey: 'image_url',
      cell: (product) => (
        <img
          src={product.image_url || '/placeholder.svg'}
          alt={product.name}
          className="h-10 w-10 rounded-md object-cover border"
          loading="lazy"
        />
      ),
    },
    {
      header: 'Product',
      accessorKey: 'name',
      cell: (product) => (
        <div className="flex flex-col">
          <span className="font-medium">{product.name}</span>
          {product.sku && (
            <span className="text-xs text-muted-foreground">
              SKU: {product.sku}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Category',
      accessorKey: 'category',
      cell: (product) => (
        <Badge variant="outline" className="capitalize">
          {product.category || 'Uncategorized'}
        </Badge>
      ),
    },
    {
      header: 'Price',
      accessorKey: 'wholesale_price',
      className: 'text-right',
      cell: (product) => (
        <span className="font-mono font-medium">
          {product.wholesale_price ? `$${product.wholesale_price}` : '-'}
        </span>
      ),
    },
    {
      header: 'Stock',
      accessorKey: 'available_quantity',
      cell: (product) => (
        <div className="flex items-center gap-2">
          <span className="font-mono">{product.available_quantity || 0}</span>
          <InventoryStatusBadge
            quantity={product.available_quantity || 0}
            lowStockThreshold={product.low_stock_alert || 10}
          />
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (product) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(product.id)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Printer className="mr-2 h-4 w-4" /> Print Label
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Store className="mr-2 h-4 w-4" /> Publish to Store
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => handleDelete(product.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Mobile card renderer
  const renderMobileProduct = (product: Product) => (
    <ProductCard
      product={{
        id: product.id,
        name: product.name,
        category: product.category || undefined,
        image_url: product.image_url || undefined,
        sku: product.sku || undefined,
        available_quantity: product.available_quantity || 0,
        low_stock_alert: product.low_stock_alert || 10,
        wholesale_price: product.wholesale_price || 0,
        cost_per_unit: product.cost_per_unit || 0,
      }}
      onEdit={() => handleEdit(product.id)}
      onDelete={() => handleDelete(product.id)}
    />
  );

  // Loading state
  if (tenantLoading || isLoading) {
    return (
      <div className="w-full max-w-full px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Products grid skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <Skeleton className="h-32 w-full rounded" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-full px-4 sm:px-6 py-4 sm:py-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load products</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: queryKeys.products.all,
                })
              }
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your product catalog
          </p>
        </div>
        <Button onClick={handleAddProduct}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalUnits}</p>
                <p className="text-sm text-muted-foreground">Available Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  ${stats.inventoryValue.toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.lowStockCount}</p>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          {/* Search */}
          <div className="w-full sm:flex-1">
            <SearchInput
              placeholder="Search products, SKU, category..."
              onSearch={setSearchTerm}
              defaultValue={searchTerm}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-between">
          <div className="flex gap-2 flex-wrap sm:flex-nowrap w-full">
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
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

            {/* Stock Filter */}
            <Select
              value={stockFilter}
              onValueChange={(v) => setStockFilter(v as StockFilter)}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="price">Price (High-Low)</SelectItem>
                <SelectItem value="stock">Stock (High-Low)</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border rounded-md overflow-hidden bg-background">
            <Toggle
              pressed={viewMode === 'grid'}
              onPressedChange={() => setViewMode('grid')}
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none h-9 w-9 p-0"
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === 'table'}
              onPressedChange={() => setViewMode('table')}
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border-0 rounded-none border-l h-9 w-9 p-0"
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </div>
        </div>
      </div>

      {/* Products Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Products ({filteredProducts.length})</CardTitle>
            {selectedProducts.length > 0 && (
              <Badge variant="secondary">
                {selectedProducts.length} selected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {filteredProducts.length > 0 ? (
            viewMode === 'grid' ? (
              <div
                ref={gridParentRef}
                className="overflow-auto p-4 sm:p-0"
                style={{ height: '600px' }}
              >
                <div
                  style={{
                    height: `${gridVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {gridVirtualizer.getVirtualItems().map((virtualRow) => {
                    const startIndex = virtualRow.index * columnsPerRow;
                    const rowProducts = filteredProducts.slice(
                      startIndex,
                      startIndex + columnsPerRow
                    );

                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {rowProducts.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={{
                                id: product.id,
                                name: product.name,
                                category: product.category || undefined,
                                image_url: product.image_url || undefined,
                                sku: product.sku || undefined,
                                available_quantity: product.available_quantity || 0,
                                low_stock_alert: product.low_stock_alert || 10,
                                wholesale_price: product.wholesale_price || 0,
                                cost_per_unit: product.cost_per_unit || 0,
                              }}
                              onEdit={() => handleEdit(product.id)}
                              onDelete={() => handleDelete(product.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="-mx-4 sm:mx-0">
                <ResponsiveTable
                  columns={columns}
                  data={filteredProducts}
                  keyExtractor={(item) => item.id}
                  isLoading={false}
                  mobileRenderer={renderMobileProduct}
                  virtualize={true}
                  virtualizeHeight={600}
                  virtualizeRowHeight={73}
                  virtualizeThreshold={10}
                />
              </div>
            )
          ) : (
            <EnhancedEmptyState
              type="no_products"
              title={
                searchTerm || categoryFilter !== 'all' || stockFilter !== 'all'
                  ? 'No products found'
                  : undefined
              }
              description={
                searchTerm || categoryFilter !== 'all' || stockFilter !== 'all'
                  ? 'Try adjusting your filters to find products'
                  : undefined
              }
              primaryAction={
                !searchTerm && categoryFilter === 'all' && stockFilter === 'all'
                  ? {
                      label: 'Add Product',
                      onClick: handleAddProduct,
                      icon: <Plus className="h-4 w-4" />,
                    }
                  : undefined
              }
              designSystem="tenant-admin"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProductsListPage;

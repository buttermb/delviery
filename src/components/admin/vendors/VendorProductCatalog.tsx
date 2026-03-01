import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Database } from '@/integrations/supabase/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Search,
  Plus,
  Loader2,
  DollarSign,
  Boxes,
  AlertTriangle,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { usePagination } from '@/hooks/usePagination';

type Product = Database['public']['Tables']['products']['Row'];

interface VendorProductCatalogProps {
  vendorId: string;
  vendorName: string;
}

type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export function VendorProductCatalog({ vendorId, vendorName }: VendorProductCatalogProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockStatus>('all');

  // Fetch products for this vendor
  const { data: products, isLoading, error } = useQuery({
    queryKey: queryKeys.vendors.products(tenant?.id ?? '', vendorId),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, category, price, stock_quantity, low_stock_alert, image_url, vendor_name')
        .eq('tenant_id', tenant.id)
        .eq('vendor_name', vendorName)
        .order('name');

      if (error) {
        logger.error('Failed to fetch vendor products', error, { component: 'VendorProductCatalog' });
        throw error;
      }

      return (data ?? []) as Product[];
    },
    enabled: !!tenant?.id && !!vendorName,
  });

  // Get unique categories from products
  const categories = useMemo(() => {
    if (!products) return [];
    const uniqueCategories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return uniqueCategories.sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    return products.filter((product) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase());

      // Category filter
      const matchesCategory =
        categoryFilter === 'all' || product.category === categoryFilter;

      // Stock status filter
      const stockQuantity = product.stock_quantity ?? 0;
      const lowStockThreshold = product.low_stock_alert || 10;
      let matchesStock = true;

      if (stockFilter === 'in_stock') {
        matchesStock = stockQuantity > lowStockThreshold;
      } else if (stockFilter === 'low_stock') {
        matchesStock = stockQuantity > 0 && stockQuantity <= lowStockThreshold;
      } else if (stockFilter === 'out_of_stock') {
        matchesStock = stockQuantity === 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, categoryFilter, stockFilter]);

  // Pagination
  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedData,
    goToPage,
    previousPage: _prevPage,
    nextPage: _nextPage,
    changePageSize,
  } = usePagination(filteredProducts, {
    defaultPageSize: 10,
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!products) return { totalProducts: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 };

    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((product) => {
      const quantity = product.stock_quantity ?? 0;
      const price = product.price ?? 0;
      const lowThreshold = product.low_stock_alert || 10;

      totalStockValue += quantity * price;

      if (quantity === 0) {
        outOfStockCount++;
      } else if (quantity <= lowThreshold) {
        lowStockCount++;
      }
    });

    return {
      totalProducts: products.length,
      totalStockValue,
      lowStockCount,
      outOfStockCount,
    };
  }, [products]);

  const getStockStatusBadge = (product: Product) => {
    const quantity = product.stock_quantity ?? 0;
    const lowThreshold = product.low_stock_alert || 10;

    if (quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (quantity <= lowThreshold) {
      return <Badge variant="outline" className="border-amber-500 text-amber-500">Low Stock</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">In Stock</Badge>;
  };

  const handleProductClick = (productId: string) => {
    navigateToAdmin(`products/${productId}`);
  };

  const handleAddProduct = () => {
    // Navigate to product creation with vendor pre-filled
    navigateToAdmin(`products/new?vendor=${encodeURIComponent(vendorName)}`);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load products. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalStockValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.lowStockCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <Boxes className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.outOfStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Product Catalog</CardTitle>
              <CardDescription>
                All products sourced from {vendorName}
              </CardDescription>
            </div>
            <Button onClick={handleAddProduct}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name or SKU..."
                  aria-label="Search by name or SKU"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[180px]" aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={(val) => setStockFilter(val as StockStatus)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <EnhancedEmptyState
              icon={Package}
              title={searchTerm || categoryFilter !== 'all' || stockFilter !== 'all' ? 'No Products Found' : 'No Products Yet'}
              description={
                searchTerm || categoryFilter !== 'all' || stockFilter !== 'all'
                  ? 'No products match your filters.'
                  : `No products from ${vendorName} have been added yet.`
              }
              primaryAction={
                !searchTerm && categoryFilter === 'all' && stockFilter === 'all'
                  ? {
                      label: 'Add Product',
                      onClick: handleAddProduct,
                      icon: Plus,
                    }
                  : undefined
              }
              secondaryAction={
                searchTerm || categoryFilter !== 'all' || stockFilter !== 'all'
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        setSearchTerm('');
                        setCategoryFilter('all');
                        setStockFilter('all');
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((product) => (
                      <TableRow
                        key={product.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleProductClick(product.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="h-8 w-8 rounded object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <span>{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.sku || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.stock_quantity ?? 0}
                        </TableCell>
                        <TableCell>{getStockStatusBadge(product)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <StandardPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                    onPageSizeChange={changePageSize}
                    totalItems={filteredProducts.length}
                    pageSize={10}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

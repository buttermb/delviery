/**
 * Vendor Catalog Sync Component
 *
 * Ability to import or sync vendor's product catalog.
 * Features:
 * - Upload vendor catalog CSV
 * - Match to existing products
 * - Identify new products to add
 * - Price comparison — vendor price vs current selling price
 * - Margin calculation
 * - Bulk update product costs from vendor catalog
 * - Schedule periodic sync
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import type { Database } from '@/integrations/supabase/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Upload,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Calendar,
  Package,
  DollarSign,
  Percent,
  Plus,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/utils/formatters';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { StandardPagination } from '@/components/shared/StandardPagination';

// ============================================================================
// Types
// ============================================================================

type Product = Database['public']['Tables']['products']['Row'];

interface CatalogSyncProps {
  vendorId: string;
  vendorName: string;
}

interface CatalogItem {
  sku: string;
  name: string;
  vendorPrice: number;
  category?: string;
  description?: string;
}

interface MatchedProduct {
  catalogItem: CatalogItem;
  existingProduct: Product | null;
  matchType: 'exact_sku' | 'name_match' | 'new';
  priceChange: number | null;
  marginPercent: number | null;
  selected: boolean;
}

interface SyncSchedule {
  id: string;
  tenant_id: string;
  vendor_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  last_sync: string | null;
  next_sync: string | null;
  is_active: boolean;
}

type SortField = 'name' | 'sku' | 'vendorPrice' | 'priceChange' | 'marginPercent';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'matched' | 'new' | 'price_increase' | 'price_decrease';

// ============================================================================
// CSV Parsing Helper
// ============================================================================

function parseCSV(csvText: string): CatalogItem[] {
  const lines = csvText.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const skuIndex = headers.findIndex((h) => h === 'sku' || h === 'product_code' || h === 'item_code');
  const nameIndex = headers.findIndex((h) => h === 'name' || h === 'product_name' || h === 'item_name');
  const priceIndex = headers.findIndex((h) => h === 'price' || h === 'cost' || h === 'vendor_price' || h === 'unit_price');
  const categoryIndex = headers.findIndex((h) => h === 'category' || h === 'type');
  const descriptionIndex = headers.findIndex((h) => h === 'description' || h === 'desc');

  if (skuIndex === -1 || nameIndex === -1 || priceIndex === -1) {
    throw new Error('CSV must contain SKU, Name, and Price columns');
  }

  const items: CatalogItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    if (values.length >= Math.max(skuIndex, nameIndex, priceIndex) + 1) {
      const price = parseFloat(values[priceIndex].replace(/[$,]/g, ''));
      if (!isNaN(price)) {
        items.push({
          sku: values[skuIndex],
          name: values[nameIndex],
          vendorPrice: price,
          category: categoryIndex >= 0 ? values[categoryIndex] : undefined,
          description: descriptionIndex >= 0 ? values[descriptionIndex] : undefined,
        });
      }
    }
  }

  return items;
}

// ============================================================================
// Main Component
// ============================================================================

export function CatalogSync({ vendorId, vendorName }: CatalogSyncProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // State
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [matchedProducts, setMatchedProducts] = useState<MatchedProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const pageSize = 15;

  // Fetch existing products for this vendor
  const { data: existingProducts, isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.vendors.products(tenant?.id || '', vendorId),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('vendor_name', vendorName)
        .order('name');

      if (error) {
        logger.error('Failed to fetch vendor products', error, { component: 'CatalogSync' });
        throw error;
      }

      return (data || []) as Product[];
    },
    enabled: !!tenant?.id && !!vendorName,
  });

  // Fetch sync schedule
  const { data: syncSchedule, isLoading: scheduleLoading } = useQuery({
    queryKey: [...queryKeys.vendors.detail(tenant?.id || '', vendorId), 'sync-schedule'],
    queryFn: async () => {
      if (!tenant?.id) return null;

      // This would be a real table in production
      // For now, we simulate with localStorage or return null
      return null as SyncSchedule | null;
    },
    enabled: !!tenant?.id,
  });

  // Update products mutation
  const updateProductsMutation = useMutation({
    mutationFn: async (updates: { productId: string; newCost: number }[]) => {
      if (!tenant?.id) throw new Error('No tenant');

      const results = await Promise.all(
        updates.map(async ({ productId, newCost }) => {
          const { error } = await (supabase as any)
            .from('products')
            .update({
              cost_price: newCost,
              updated_at: new Date().toISOString(),
            })
            .eq('id', productId)
            .eq('tenant_id', tenant.id);

          if (error) throw error;
          return productId;
        })
      );

      return results;
    },
    onSuccess: (updatedIds) => {
      toast.success(`Updated ${updatedIds.length} product costs`);
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.products(tenant?.id || '', vendorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: (error) => {
      logger.error('Failed to update product costs', error, { component: 'CatalogSync' });
      toast.error('Failed to update product costs');
    },
  });

  // Create new products mutation
  const createProductsMutation = useMutation({
    mutationFn: async (newProducts: CatalogItem[]) => {
      if (!tenant?.id) throw new Error('No tenant');

      const productsToCreate = newProducts.map((item) => ({
        tenant_id: tenant.id,
        name: item.name,
        sku: item.sku,
        cost_price: item.vendorPrice,
        price: item.vendorPrice * 1.3, // Default 30% markup
        category: item.category || 'Uncategorized',
        description: item.description || '',
        vendor_name: vendorName,
        stock_quantity: 0,
        is_active: true,
      }));

      const { data, error } = await (supabase as any)
        .from('products')
        .insert(productsToCreate)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      toast.success(`Created ${created.length} new products`);
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.products(tenant?.id || '', vendorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: (error) => {
      logger.error('Failed to create new products', error, { component: 'CatalogSync' });
      toast.error('Failed to create new products');
    },
  });

  // Handle file upload
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }

      setIsProcessing(true);
      setUploadProgress(10);

      try {
        const text = await file.text();
        setUploadProgress(30);

        const items = parseCSV(text);
        setCatalogItems(items);
        setUploadProgress(50);

        if (items.length === 0) {
          toast.error('No valid items found in CSV');
          setIsProcessing(false);
          return;
        }

        // Match with existing products
        const matched: MatchedProduct[] = items.map((item) => {
          // Try exact SKU match first
          let existingProduct = existingProducts?.find(
            (p) => p.sku?.toLowerCase() === item.sku.toLowerCase()
          );

          // Try name match if no SKU match
          if (!existingProduct) {
            existingProduct = existingProducts?.find(
              (p) => p.name.toLowerCase() === item.name.toLowerCase()
            );
          }

          let matchType: 'exact_sku' | 'name_match' | 'new' = 'new';
          let priceChange: number | null = null;
          let marginPercent: number | null = null;

          if (existingProduct) {
            matchType = existingProduct.sku?.toLowerCase() === item.sku.toLowerCase()
              ? 'exact_sku'
              : 'name_match';

            const currentCost = (existingProduct as any).cost_price || 0;
            priceChange = item.vendorPrice - currentCost;

            // Calculate margin based on selling price
            const sellingPrice = existingProduct.price || 0;
            if (sellingPrice > 0) {
              marginPercent = ((sellingPrice - item.vendorPrice) / sellingPrice) * 100;
            }
          }

          return {
            catalogItem: item,
            existingProduct: existingProduct || null,
            matchType,
            priceChange,
            marginPercent,
            selected: false,
          };
        });

        setMatchedProducts(matched);
        setUploadProgress(100);
        setIsUploadDialogOpen(false);
        toast.success(`Processed ${items.length} catalog items`);

        logger.info('Catalog CSV processed', {
          component: 'CatalogSync',
          itemCount: items.length,
          matchedCount: matched.filter((m) => m.matchType !== 'new').length,
          newCount: matched.filter((m) => m.matchType === 'new').length,
        });
      } catch (error) {
        logger.error('Failed to process CSV', error, { component: 'CatalogSync' });
        toast.error(error instanceof Error ? error.message : 'Failed to process CSV');
      } finally {
        setIsProcessing(false);
        setUploadProgress(0);
      }
    },
    [existingProducts]
  );

  // Toggle selection
  const toggleSelection = useCallback((index: number) => {
    setMatchedProducts((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  }, []);

  // Select all visible
  const selectAllVisible = useCallback(() => {
    const filteredIndices = new Set(
      filteredAndSortedProducts.map((item) =>
        matchedProducts.findIndex((m) => m === item)
      )
    );

    setMatchedProducts((prev) =>
      prev.map((item, i) =>
        filteredIndices.has(i) ? { ...item, selected: true } : item
      )
    );
  }, [matchedProducts]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setMatchedProducts((prev) => prev.map((item) => ({ ...item, selected: false })));
  }, []);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...matchedProducts];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.catalogItem.name.toLowerCase().includes(term) ||
          item.catalogItem.sku.toLowerCase().includes(term)
      );
    }

    // Apply type filter
    switch (filterType) {
      case 'matched':
        result = result.filter((item) => item.matchType !== 'new');
        break;
      case 'new':
        result = result.filter((item) => item.matchType === 'new');
        break;
      case 'price_increase':
        result = result.filter((item) => item.priceChange !== null && item.priceChange > 0);
        break;
      case 'price_decrease':
        result = result.filter((item) => item.priceChange !== null && item.priceChange < 0);
        break;
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = a.catalogItem.name;
          bVal = b.catalogItem.name;
          break;
        case 'sku':
          aVal = a.catalogItem.sku;
          bVal = b.catalogItem.sku;
          break;
        case 'vendorPrice':
          aVal = a.catalogItem.vendorPrice;
          bVal = b.catalogItem.vendorPrice;
          break;
        case 'priceChange':
          aVal = a.priceChange ?? 0;
          bVal = b.priceChange ?? 0;
          break;
        case 'marginPercent':
          aVal = a.marginPercent ?? -1000;
          bVal = b.marginPercent ?? -1000;
          break;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [matchedProducts, searchTerm, filterType, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProducts.length / pageSize);
  const paginatedItems = useMemo(
    () => filteredAndSortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredAndSortedProducts, currentPage, pageSize]
  );

  // Stats
  const stats = useMemo(() => {
    const selected = matchedProducts.filter((m) => m.selected);
    const matched = matchedProducts.filter((m) => m.matchType !== 'new');
    const newItems = matchedProducts.filter((m) => m.matchType === 'new');
    const priceIncreases = matchedProducts.filter((m) => m.priceChange !== null && m.priceChange > 0);
    const priceDecreases = matchedProducts.filter((m) => m.priceChange !== null && m.priceChange < 0);

    return {
      total: matchedProducts.length,
      selected: selected.length,
      matched: matched.length,
      new: newItems.length,
      priceIncreases: priceIncreases.length,
      priceDecreases: priceDecreases.length,
      selectedForUpdate: selected.filter((m) => m.matchType !== 'new').length,
      selectedForCreate: selected.filter((m) => m.matchType === 'new').length,
    };
  }, [matchedProducts]);

  // Handle bulk update
  const handleBulkUpdate = useCallback(() => {
    const selectedForUpdate = matchedProducts
      .filter((m) => m.selected && m.matchType !== 'new' && m.existingProduct)
      .map((m) => ({
        productId: m.existingProduct!.id,
        newCost: m.catalogItem.vendorPrice,
      }));

    if (selectedForUpdate.length === 0) {
      toast.error('No matched products selected for update');
      return;
    }

    updateProductsMutation.mutate(selectedForUpdate);
  }, [matchedProducts, updateProductsMutation]);

  // Handle bulk create
  const handleBulkCreate = useCallback(() => {
    const selectedForCreate = matchedProducts
      .filter((m) => m.selected && m.matchType === 'new')
      .map((m) => m.catalogItem);

    if (selectedForCreate.length === 0) {
      toast.error('No new products selected for creation');
      return;
    }

    createProductsMutation.mutate(selectedForCreate);
  }, [matchedProducts, createProductsMutation]);

  // Sort toggle
  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  // Loading state
  if (productsLoading) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Catalog Sync
            </CardTitle>
            <CardDescription>
              Import and sync {vendorName}&apos;s product catalog with your inventory
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsScheduleDialogOpen(true)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Sync
            </Button>
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Catalog
            </Button>
          </div>
        </CardHeader>

        {/* Sync Schedule Info */}
        {syncSchedule && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <span className="font-medium">Auto-sync enabled:</span>{' '}
                {syncSchedule.frequency} •{' '}
                {syncSchedule.last_sync && (
                  <>
                    Last sync: {format(new Date(syncSchedule.last_sync), 'MMM d, h:mm a')} •{' '}
                  </>
                )}
                {syncSchedule.next_sync && (
                  <>Next sync: {format(new Date(syncSchedule.next_sync), 'MMM d, h:mm a')}</>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Results Section */}
      {matchedProducts.length > 0 && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matched</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Products</CardTitle>
                <Plus className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Price Increases</CardTitle>
                <ArrowUp className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.priceIncreases}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Price Decreases</CardTitle>
                <ArrowDown className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.priceDecreases}</div>
              </CardContent>
            </Card>
          </div>

          {/* Actions Bar */}
          {stats.selected > 0 && (
            <Card className="border-primary">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {stats.selected} item{stats.selected !== 1 ? 's' : ''} selected
                    </span>
                    {stats.selectedForUpdate > 0 && (
                      <Badge variant="outline">
                        {stats.selectedForUpdate} to update
                      </Badge>
                    )}
                    {stats.selectedForCreate > 0 && (
                      <Badge variant="outline" className="bg-blue-50">
                        {stats.selectedForCreate} to create
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                    {stats.selectedForUpdate > 0 && (
                      <Button
                        size="sm"
                        onClick={handleBulkUpdate}
                        disabled={updateProductsMutation.isPending}
                      >
                        {updateProductsMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Update Costs
                      </Button>
                    )}
                    {stats.selectedForCreate > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleBulkCreate}
                        disabled={createProductsMutation.isPending}
                      >
                        {createProductsMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Create Products
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle>Catalog Comparison</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllVisible}>
                    Select All
                  </Button>
                </div>
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
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select
                  value={filterType}
                  onValueChange={(val) => {
                    setFilterType(val as FilterType);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="matched">Matched Only</SelectItem>
                    <SelectItem value="new">New Only</SelectItem>
                    <SelectItem value="price_increase">Price Increases</SelectItem>
                    <SelectItem value="price_decrease">Price Decreases</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={
                            paginatedItems.length > 0 &&
                            paginatedItems.every((item) => item.selected)
                          }
                          onCheckedChange={(checked) => {
                            const itemSet = new Set(paginatedItems);
                            setMatchedProducts((prev) =>
                              prev.map((item) =>
                                itemSet.has(item)
                                  ? { ...item, selected: !!checked }
                                  : item
                              )
                            );
                          }}
                        />
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSort('name')}
                          className="-ml-4"
                        >
                          Product {getSortIcon('name')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSort('sku')}
                          className="-ml-4"
                        >
                          SKU {getSortIcon('sku')}
                        </Button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSort('vendorPrice')}
                          className="-mr-4"
                        >
                          Vendor Price {getSortIcon('vendorPrice')}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Current Cost</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSort('priceChange')}
                          className="-mr-4"
                        >
                          Change {getSortIcon('priceChange')}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSort('marginPercent')}
                          className="-mr-4"
                        >
                          Margin {getSortIcon('marginPercent')}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No items match your filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((item, index) => {
                        const globalIndex = matchedProducts.findIndex((m) => m === item);
                        return (
                          <TableRow
                            key={`${item.catalogItem.sku}-${index}`}
                            className={item.selected ? 'bg-primary/5' : ''}
                          >
                            <TableCell>
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={() => toggleSelection(globalIndex)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {item.existingProduct?.image_url ? (
                                  <img
                                    src={item.existingProduct.image_url}
                                    alt={item.catalogItem.name}
                                    className="h-8 w-8 rounded object-cover"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="truncate max-w-[200px]">{item.catalogItem.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.catalogItem.sku}
                            </TableCell>
                            <TableCell>
                              {item.matchType === 'exact_sku' && (
                                <Badge variant="default" className="bg-green-500">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  SKU Match
                                </Badge>
                              )}
                              {item.matchType === 'name_match' && (
                                <Badge variant="outline" className="border-amber-500 text-amber-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Name Match
                                </Badge>
                              )}
                              {item.matchType === 'new' && (
                                <Badge variant="secondary">
                                  <Plus className="h-3 w-3 mr-1" />
                                  New
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.catalogItem.vendorPrice)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {(item.existingProduct as any)?.cost_price !== undefined
                                ? formatCurrency((item.existingProduct as any).cost_price || 0)
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.priceChange !== null ? (
                                <span
                                  className={
                                    item.priceChange > 0
                                      ? 'text-red-600'
                                      : item.priceChange < 0
                                      ? 'text-green-600'
                                      : ''
                                  }
                                >
                                  {item.priceChange > 0 ? '+' : ''}
                                  {formatCurrency(item.priceChange)}
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.marginPercent !== null ? (
                                <span
                                  className={
                                    item.marginPercent < 10
                                      ? 'text-red-600'
                                      : item.marginPercent < 20
                                      ? 'text-amber-600'
                                      : 'text-green-600'
                                  }
                                >
                                  {item.marginPercent.toFixed(1)}%
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <StandardPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={() => {}}
                    totalItems={filteredAndSortedProducts.length}
                    pageSize={pageSize}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {matchedProducts.length === 0 && (
        <Card>
          <CardContent className="py-16">
            <EnhancedEmptyState
              icon={FileSpreadsheet}
              title="No catalog uploaded"
              description="Upload a vendor catalog CSV to compare prices and sync products."
              primaryAction={{
                label: 'Upload Catalog',
                onClick: () => setIsUploadDialogOpen(true),
                icon: Upload,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Vendor Catalog</DialogTitle>
            <DialogDescription>
              Upload a CSV file containing the vendor&apos;s product catalog. The file must include
              columns for SKU, Name, and Price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              {isProcessing ? (
                <div className="space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground">Processing catalog...</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <div className="mb-4">
                    <p className="text-sm font-medium">Drop your CSV file here, or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Required columns: SKU (or product_code), Name (or product_name), Price (or cost)
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                  />
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Auto-Sync</DialogTitle>
            <DialogDescription>
              Set up automatic catalog synchronization from the vendor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sync Frequency</label>
              <Select
                value={scheduleFrequency}
                onValueChange={(val) => setScheduleFrequency(val as 'daily' | 'weekly' | 'monthly')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="text-sm font-medium mb-2">How it works</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Configure vendor API or file source in settings</li>
                <li>• System automatically fetches catalog at scheduled time</li>
                <li>• Review changes in this dashboard before applying</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.info('Schedule feature requires vendor API configuration');
                setIsScheduleDialogOpen(false);
              }}
            >
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
